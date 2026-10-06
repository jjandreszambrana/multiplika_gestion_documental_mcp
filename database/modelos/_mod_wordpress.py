"""Cliente de la API oficial de WordPress (REST, /wp-json/wp/v2) con una
contraseña de aplicación — ver docs/gestion-documental.md → "Webs y redes
sociales". Solo habla con la web; qué se puede cambiar y cómo se aprueba
lo decide _mod_cambios_externos.py.

Los nombres que ve la IA están en castellano (entradas, paginas...) y se
traducen aquí a los de WordPress. Una conexión por petición, igual que el
correo: nada de sesiones abiertas entre llamadas."""

import asyncio
import ipaddress
import os
import re
import socket
from html import unescape
from urllib.parse import urlparse

import httpx

TIMEOUT_SEGUNDOS = 25
POR_PAGINA_MAXIMO = 50

# tipo en castellano -> ruta de la API de WordPress
RUTAS = {
    "entradas": "/wp/v2/posts",
    "paginas": "/wp/v2/pages",
    "comentarios": "/wp/v2/comments",
    "medios": "/wp/v2/media",
    "plugins": "/wp/v2/plugins",
    "usuarios": "/wp/v2/users",
}

ESTADOS_PUBLICACION = {"borrador": "draft", "publicado": "publish", "pendiente": "pending",
                       "privado": "private", "programado": "future"}
ESTADOS_COMENTARIO = {"aprobado": "approved", "retenido": "hold", "spam": "spam", "papelera": "trash"}
# Al leer, WordPress devuelve "approved"/"hold"... y al filtrar pide "approve"/"hold"
_FILTRO_COMENTARIO = {"aprobado": "approve", "retenido": "hold", "spam": "spam", "papelera": "trash"}
_ESTADO_COMENTARIO_ES = {"approved": "aprobado", "approve": "aprobado", "hold": "retenido",
                         "unapproved": "retenido", "spam": "spam", "trash": "papelera"}
_ESTADO_PUBLICACION_ES = {v: k for k, v in ESTADOS_PUBLICACION.items()} | {"trash": "papelera"}


class WordPressError(Exception):
    pass


def _texto_plano(html: str | None, maximo: int = 300) -> str:
    texto = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto if len(texto) <= maximo else texto[: maximo - 1] + "…"


def _comprobar_destino_publico(url: str) -> None:
    """Que la dirección no apunte a la propia máquina ni a la red interna
    del servidor (una web de cliente siempre es pública). En local se
    puede saltar con GD_PERMITIR_URLS_LOCALES=1 para probar."""
    if os.environ.get("GD_PERMITIR_URLS_LOCALES") == "1":
        return
    host = urlparse(url).hostname
    if not host:
        raise WordPressError("La dirección de la web no es válida")
    try:
        direcciones = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except socket.gaierror:
        raise WordPressError(f"No se encuentra la web «{host}»: revisa la dirección")
    for direccion in direcciones:
        ip = ipaddress.ip_address(direccion)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise WordPressError(f"La dirección «{host}» apunta a una red interna y no se permite")


class ClienteWordPress:
    def __init__(self, url: str, usuario: str, contrasena: str):
        self.url = url.rstrip("/")
        self._auth = (usuario, contrasena.replace(" ", ""))
        # Webs sin "enlaces permanentes" no tienen /wp-json: se usa ?rest_route=
        self._usar_rest_route = False

    def _destino(self, ruta: str) -> tuple[str, dict]:
        if self._usar_rest_route:
            return f"{self.url}/", {"rest_route": ruta}
        return f"{self.url}/wp-json{ruta}", {}

    async def _peticion(self, metodo: str, ruta: str, params: dict | None = None, json: dict | None = None,
                        contenido: bytes | None = None, cabeceras: dict | None = None, timeout: int | None = None):
        await asyncio.to_thread(_comprobar_destino_publico, self.url)
        async with httpx.AsyncClient(timeout=timeout or TIMEOUT_SEGUNDOS, follow_redirects=True, auth=self._auth) as cliente:
            for intento in range(2):
                url, extra = self._destino(ruta)
                try:
                    respuesta = await cliente.request(metodo, url, params={**extra, **(params or {})},
                                                      json=json, content=contenido, headers=cabeceras)
                except httpx.TimeoutException:
                    raise WordPressError("La web no ha contestado a tiempo")
                except httpx.HTTPError as e:
                    raise WordPressError(f"No se ha podido conectar con la web: {e}")
                es_json = respuesta.headers.get("content-type", "").startswith("application/json")
                if respuesta.status_code == 404 and not es_json and intento == 0 and not self._usar_rest_route:
                    self._usar_rest_route = True
                    continue
                break
        if not es_json:
            raise WordPressError(f"La web no responde como un WordPress (código {respuesta.status_code}). "
                                 "Revisa la dirección o si algún plugin de seguridad bloquea la API.")
        datos = respuesta.json()
        if respuesta.status_code >= 400:
            mensaje = datos.get("message") if isinstance(datos, dict) else None
            if respuesta.status_code in (401, 403):
                raise WordPressError("WordPress no deja hacerlo con este usuario"
                                     + (f": {_texto_plano(mensaje).rstrip('.')}" if mensaje else "")
                                     + ". Revisa el usuario, la contraseña de aplicación y su rol.")
            raise WordPressError(_texto_plano(mensaje) or f"WordPress ha devuelto un error {respuesta.status_code}")
        return datos

    # --- Lectura ---

    async def sitio(self) -> dict:
        datos = await self._peticion("GET", "/")
        return {"nombre": datos.get("name"), "descripcion": datos.get("description"),
                "direccion": datos.get("home") or datos.get("url")}

    async def yo(self) -> dict:
        datos = await self._peticion("GET", "/wp/v2/users/me", params={"context": "edit"})
        return {"id": datos.get("id"), "nombre": datos.get("name"), "roles": datos.get("roles", [])}

    async def listar(self, tipo: str, buscar: str | None = None, estado: str | None = None,
                     pagina: int = 1, por_pagina: int = 20) -> list[dict]:
        if tipo not in RUTAS:
            raise WordPressError(f"Tipo no válido. Opciones: {', '.join(RUTAS)}")
        params: dict = {}
        if tipo != "plugins":
            params.update({"page": max(1, pagina), "per_page": max(1, min(por_pagina, POR_PAGINA_MAXIMO))})
        if buscar:
            params["search"] = buscar
        if tipo in ("entradas", "paginas"):
            params["status"] = ESTADOS_PUBLICACION.get(estado, "any") if estado else "any"
            params["context"] = "edit"
        elif tipo == "comentarios":
            params["status"] = _FILTRO_COMENTARIO.get(estado or "aprobado", "approve")
            params["context"] = "edit"
        elif tipo in ("usuarios",):
            params["context"] = "edit"
        elif tipo == "plugins" and estado:
            params["status"] = {"activo": "active", "inactivo": "inactive"}.get(estado, estado)
        filas = await self._peticion("GET", RUTAS[tipo], params=params)
        return [self._resumen(tipo, f) for f in filas]

    async def administradores(self) -> list[dict]:
        """Usuarios con rol de administrador — para la vigilancia (avisar de
        uno nuevo). Solo lo puede pedir un usuario de WordPress administrador."""
        filas = await self._peticion("GET", RUTAS["usuarios"],
                                     params={"roles": "administrator", "context": "edit", "per_page": 100})
        return [self._resumen("usuarios", f) for f in filas]

    async def obtener(self, tipo: str, id_objeto: int | str) -> dict:
        if tipo not in RUTAS or tipo == "plugins":
            raise WordPressError(f"Tipo no válido para obtener uno: {', '.join(t for t in RUTAS if t != 'plugins')}")
        datos = await self._peticion("GET", f"{RUTAS[tipo]}/{id_objeto}", params={"context": "edit"})
        return self._completo(tipo, datos)

    def _resumen(self, tipo: str, f: dict) -> dict:
        if tipo in ("entradas", "paginas"):
            return {"id": f["id"], "titulo": (f.get("title") or {}).get("raw") or _texto_plano((f.get("title") or {}).get("rendered")),
                    "estado": _ESTADO_PUBLICACION_ES.get(f.get("status"), f.get("status")),
                    "fecha": f.get("date"), "modificado": f.get("modified"), "enlace": f.get("link")}
        if tipo == "comentarios":
            return {"id": f["id"], "id_entrada": f.get("post"), "autor": f.get("author_name"),
                    "fecha": f.get("date"), "estado": _ESTADO_COMENTARIO_ES.get(f.get("status"), f.get("status")),
                    "texto": _texto_plano((f.get("content") or {}).get("raw") or (f.get("content") or {}).get("rendered"))}
        if tipo == "medios":
            return {"id": f["id"], "titulo": _texto_plano((f.get("title") or {}).get("rendered")),
                    "tipo": f.get("mime_type"), "direccion": f.get("source_url"), "fecha": f.get("date")}
        if tipo == "plugins":
            return {"plugin": f.get("plugin"), "nombre": f.get("name"), "version": f.get("version"),
                    "estado": {"active": "activo", "inactive": "inactivo"}.get(f.get("status"), f.get("status")),
                    "autor": _texto_plano(f.get("author"), 100)}
        if tipo == "usuarios":
            return {"id": f["id"], "nombre": f.get("name"), "usuario": f.get("username"),
                    "roles": f.get("roles", []), "alta": f.get("registered_date")}
        return f

    def _completo(self, tipo: str, f: dict) -> dict:
        if tipo in ("entradas", "paginas"):
            return {**self._resumen(tipo, f), "contenido": (f.get("content") or {}).get("raw", ""),
                    "extracto": (f.get("excerpt") or {}).get("raw", ""), "slug": f.get("slug")}
        if tipo == "comentarios":
            return {**self._resumen(tipo, f), "texto": (f.get("content") or {}).get("raw", ""),
                    "email_autor": f.get("author_email")}
        if tipo == "medios":
            return {**self._resumen(tipo, f), "texto_alternativo": f.get("alt_text")}
        return self._resumen(tipo, f)

    # --- Escritura (solo la llama _mod_cambios_externos.py, tras aprobar) ---

    async def crear(self, tipo: str, datos: dict) -> dict:
        return self._completo(tipo, await self._peticion("POST", RUTAS[tipo], json=datos, params={"context": "edit"}))

    async def actualizar(self, tipo: str, id_objeto: int | str, datos: dict) -> dict:
        return self._completo(tipo, await self._peticion("POST", f"{RUTAS[tipo]}/{id_objeto}", json=datos,
                                                         params={"context": "edit"}))

    async def borrar(self, tipo: str, id_objeto: int | str, definitivo: bool = False) -> None:
        await self._peticion("DELETE", f"{RUTAS[tipo]}/{id_objeto}", params={"force": "true"} if definitivo else None)

    async def subir_medio(self, nombre_archivo: str, tipo_mime: str, contenido: bytes,
                          titulo: str | None, texto_alternativo: str | None) -> dict:
        nombre_seguro = re.sub(r'[^\w.\- ]', "_", nombre_archivo)
        datos = await self._peticion(
            "POST", RUTAS["medios"], contenido=contenido,
            cabeceras={"Content-Type": tipo_mime, "Content-Disposition": f'attachment; filename="{nombre_seguro}"'},
        )
        extra = {k: v for k, v in {"title": titulo, "alt_text": texto_alternativo}.items() if v}
        if extra:
            datos = await self._peticion("POST", f"{RUTAS['medios']}/{datos['id']}", json=extra,
                                         params={"context": "edit"})
        return self._completo("medios", datos)

    async def portada_responde(self) -> int | None:
        """Código HTTP de la portada, o None si ni contesta — para la
        comprobación posterior a cada cambio."""
        await asyncio.to_thread(_comprobar_destino_publico, self.url)
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SEGUNDOS, follow_redirects=True) as cliente:
                return (await cliente.get(f"{self.url}/")).status_code
        except httpx.HTTPError:
            return None
