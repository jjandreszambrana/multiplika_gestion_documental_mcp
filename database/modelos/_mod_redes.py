"""Pieza común para hablar con las redes sociales (fase 5 de webs y redes) —
ver docs/gestion-documental.md → "Webs y redes sociales". Lo mismo para
todas: publicar, borrar, métricas, comentarios y responder. Por detrás, según
el activo (modo_conexion):

- intermediario: Ayrshare (una sola API para Facebook, Instagram, LinkedIn,
  Google Business, X, TikTok, YouTube...). Credencial: la clave de API de
  Ayrshare en el valor y, si la cuenta es de empresa con varios perfiles, el
  campo extra «profile_key».
- directo: la API de Meta (Graph API) para Facebook e Instagram, con la
  aplicación del propio cliente. Credencial: un token de acceso de página de
  larga duración en el valor y el campo extra «page_id» (Facebook) o
  «ig_user_id» (Instagram profesional).

El resto de redes en directo (LinkedIn, X, TikTok...) se añadirían aquí como
otra clase con la misma forma. Las condiciones de cada API cambian a menudo:
ver [COMPROBAR] en el plan antes de dar por buena una respuesta concreta."""

import os

import httpx

from ._mod_credenciales import CredencialesCRUD
from ._mod_credenciales_campos import CredencialesCamposCRUD

URL_AYRSHARE = os.environ.get("GD_URL_AYRSHARE", "https://api.ayrshare.com/api")
URL_META = os.environ.get("GD_URL_META", "https://graph.facebook.com/v21.0")
TIMEOUT = 60

# plataforma de la GD -> nombre en Ayrshare
RED_AYRSHARE = {"facebook": "facebook", "instagram": "instagram", "linkedin": "linkedin", "google_business": "gmb",
                "x": "twitter", "tiktok": "tiktok", "youtube": "youtube"}
LIMITE_TEXTO = {"x": 280, "instagram": 2200, "linkedin": 3000, "google_business": 1500, "facebook": 63206,
                "tiktok": 2200, "youtube": 5000}
NECESITA_IMAGEN = {"instagram", "tiktok", "youtube"}
DIRECTO_DISPONIBLE = {"facebook", "instagram"}


class RedError(Exception):
    pass


def comprobar_publicable(plataforma: str, texto: str, num_medios: int) -> None:
    if len(texto) > LIMITE_TEXTO.get(plataforma, 5000):
        raise RedError(f"El texto es demasiado largo para {plataforma}: {len(texto)} caracteres, como mucho {LIMITE_TEXTO[plataforma]}")
    if plataforma in NECESITA_IMAGEN and not num_medios:
        raise RedError(f"En {plataforma} hace falta al menos una imagen o un vídeo")


async def _respuesta(r: httpx.Response, quien: str):
    try:
        datos = r.json()
    except ValueError:
        datos = {}
    if r.status_code in (401, 403):
        raise RedError(f"{quien} rechaza la clave o el token: revisa la credencial")
    if r.status_code >= 400 or (isinstance(datos, dict) and datos.get("status") == "error"):
        mensaje = (datos.get("message") or (datos.get("error") or {}).get("message") if isinstance(datos, dict) else None)
        raise RedError(f"{quien} ha devuelto un error: {mensaje or r.status_code}")
    return datos


class ClienteAyrshare:
    def __init__(self, clave: str, perfil: str | None, plataforma: str):
        if plataforma not in RED_AYRSHARE:
            raise RedError(f"Ayrshare no publica en «{plataforma}»")
        self._cabeceras = {"Authorization": f"Bearer {clave}", **({"Profile-Key": perfil} if perfil else {})}
        self.plataforma, self.red = plataforma, RED_AYRSHARE[plataforma]

    async def _llamar(self, metodo: str, ruta: str, json: dict | None = None, params: dict | None = None):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.request(metodo, f"{URL_AYRSHARE}{ruta}", headers=self._cabeceras, json=json, params=params)
        except httpx.HTTPError as e:
            raise RedError(f"No se ha podido hablar con Ayrshare: {e}")
        return await _respuesta(r, "Ayrshare")

    async def comprobar(self) -> str:
        datos = await self._llamar("GET", "/user")
        activas = datos.get("activeSocialAccounts") or []
        if self.red not in activas:
            raise RedError(f"La cuenta de Ayrshare no tiene conectada {self.plataforma} (tiene: {', '.join(activas) or 'ninguna'})")
        return f"Conectado por Ayrshare a {self.plataforma}"

    async def publicar(self, texto: str, medios: list[str], enlace: str | None) -> dict:
        cuerpo = {"post": texto + (f"\n\n{enlace}" if enlace else ""), "platforms": [self.red]}
        if medios:
            cuerpo["mediaUrls"] = medios
        datos = await self._llamar("POST", "/post", json=cuerpo)
        envio = next((p for p in datos.get("postIds", []) if p.get("platform") == self.red), {})
        if envio.get("status") == "error" or not envio:
            raise RedError(f"{self.plataforma} no aceptó la publicación: {envio.get('message') or datos.get('errors') or 'sin detalle'}")
        return {"id_red": datos.get("id"), "id_en_red": envio.get("id"), "url": envio.get("postUrl")}

    async def borrar(self, resultado: dict) -> None:
        await self._llamar("DELETE", "/post", json={"id": resultado["id_red"]})

    async def metricas(self, resultado: dict) -> dict:
        datos = await self._llamar("POST", "/analytics/post", json={"id": resultado["id_red"], "platforms": [self.red]})
        a = (datos.get(self.red) or {}).get("analytics") or {}
        return {"alcance": a.get("reach") or a.get("impressions") or a.get("impressionCount"),
                "me_gusta": a.get("likes") or a.get("likeCount") or a.get("reactions"),
                "comentarios": a.get("comments") or a.get("commentsCount") or a.get("commentCount"),
                "compartidos": a.get("shares") or a.get("sharesCount"), "clics": a.get("clicks")}

    async def comentarios(self, resultado: dict) -> list[dict]:
        datos = await self._llamar("GET", f"/comments/{resultado['id_red']}")
        return [{"id": c.get("commentId") or c.get("id"), "autor": (c.get("from") or {}).get("name") or c.get("userName"),
                 "texto": c.get("comment"), "fecha": c.get("created")} for c in datos.get(self.red, [])]

    async def responder(self, resultado: dict, id_comentario: str, texto: str) -> dict:
        datos = await self._llamar("POST", f"/comments/reply/{id_comentario}", json={"platforms": [self.red], "comment": texto})
        r = datos.get(self.red) or {}
        return {"id": r.get("commentId") or r.get("id")}

    async def borrar_comentario(self, id_comentario: str) -> None:
        await self._llamar("DELETE", f"/comments/{id_comentario}", params={"platforms": self.red})


class ClienteMeta:
    """Facebook (página) o Instagram (cuenta profesional) con la Graph API."""

    def __init__(self, token: str, plataforma: str, id_cuenta: str):
        if plataforma not in DIRECTO_DISPONIBLE:
            raise RedError(f"La conexión directa con «{plataforma}» todavía no está disponible: usa el intermediario")
        self.token, self.plataforma, self.id_cuenta = token, plataforma, id_cuenta

    async def _llamar(self, metodo: str, ruta: str, datos: dict | None = None):
        params = {"access_token": self.token, **(datos if metodo == "GET" and datos else {})}
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.request(metodo, f"{URL_META}{ruta}", params=params, data=datos if metodo != "GET" else None)
        except httpx.HTTPError as e:
            raise RedError(f"No se ha podido hablar con Meta: {e}")
        return await _respuesta(r, "Meta")

    async def comprobar(self) -> str:
        campo = "username" if self.plataforma == "instagram" else "name"
        datos = await self._llamar("GET", f"/{self.id_cuenta}", {"fields": campo})
        return f"Conectado directamente a {self.plataforma}: {datos.get(campo)}"

    async def publicar(self, texto: str, medios: list[str], enlace: str | None) -> dict:
        if self.plataforma == "instagram":
            if not medios:
                raise RedError("En Instagram hace falta una imagen")
            contenedor = await self._llamar("POST", f"/{self.id_cuenta}/media", {"image_url": medios[0], "caption": texto})
            hecho = await self._llamar("POST", f"/{self.id_cuenta}/media_publish", {"creation_id": contenedor["id"]})
            enlace_red = (await self._llamar("GET", f"/{hecho['id']}", {"fields": "permalink"})).get("permalink")
            return {"id_red": hecho["id"], "id_en_red": hecho["id"], "url": enlace_red}
        if medios:
            hecho = await self._llamar("POST", f"/{self.id_cuenta}/photos", {"url": medios[0], "caption": texto + (f"\n\n{enlace}" if enlace else "")})
            id_post = hecho.get("post_id") or hecho["id"]
        else:
            hecho = await self._llamar("POST", f"/{self.id_cuenta}/feed", {"message": texto, **({"link": enlace} if enlace else {})})
            id_post = hecho["id"]
        return {"id_red": id_post, "id_en_red": id_post, "url": f"https://www.facebook.com/{id_post}"}

    async def borrar(self, resultado: dict) -> None:
        if self.plataforma == "instagram":
            raise RedError("Instagram no deja borrar publicaciones por su API: hay que borrarla desde la aplicación")
        await self._llamar("DELETE", f"/{resultado['id_red']}")

    async def metricas(self, resultado: dict) -> dict:
        if self.plataforma == "instagram":
            datos = await self._llamar("GET", f"/{resultado['id_red']}/insights", {"metric": "reach,likes,comments,shares,saved"})
            v = {m["name"]: (m.get("values") or [{}])[0].get("value") for m in datos.get("data", [])}
            return {"alcance": v.get("reach"), "me_gusta": v.get("likes"), "comentarios": v.get("comments"),
                    "compartidos": v.get("shares"), "guardados": v.get("saved")}
        datos = await self._llamar("GET", f"/{resultado['id_red']}", {"fields": "reactions.summary(true),comments.summary(true),shares"})
        return {"me_gusta": ((datos.get("reactions") or {}).get("summary") or {}).get("total_count"),
                "comentarios": ((datos.get("comments") or {}).get("summary") or {}).get("total_count"),
                "compartidos": (datos.get("shares") or {}).get("count")}

    async def comentarios(self, resultado: dict) -> list[dict]:
        campos = "id,text,username,timestamp" if self.plataforma == "instagram" else "id,message,from,created_time"
        datos = await self._llamar("GET", f"/{resultado['id_red']}/comments", {"fields": campos})
        return [{"id": c["id"], "autor": c.get("username") or (c.get("from") or {}).get("name"),
                 "texto": c.get("text") or c.get("message"), "fecha": c.get("timestamp") or c.get("created_time")}
                for c in datos.get("data", [])]

    async def responder(self, resultado: dict, id_comentario: str, texto: str) -> dict:
        ruta = f"/{id_comentario}/replies" if self.plataforma == "instagram" else f"/{id_comentario}/comments"
        return {"id": (await self._llamar("POST", ruta, {"message": texto}))["id"]}

    async def borrar_comentario(self, id_comentario: str) -> None:
        await self._llamar("DELETE", f"/{id_comentario}")


async def cliente_red(config: dict, activo: dict):
    """El cliente de la red de un activo, según su forma de conectar."""
    if not activo["id_credencial"]:
        raise RedError(f"«{activo['nombre']}» no tiene credencial")
    credenciales = CredencialesCRUD(config)
    credencial = await credenciales.obtener(activo["id_credencial"])
    if not credencial:
        raise RedError("La credencial elegida ya no existe")
    valor = await credenciales.valor_descifrado(credencial["id"])
    extra = await CredencialesCamposCRUD(config).valores_descifrados(credencial["id"])
    if (activo.get("modo_conexion") or "intermediario") == "intermediario":
        return ClienteAyrshare(valor, extra.get("profile_key"), activo["plataforma"])
    id_cuenta = extra.get("ig_user_id") if activo["plataforma"] == "instagram" else extra.get("page_id")
    if not id_cuenta:
        raise RedError("Falta en la credencial el campo «" + ("ig_user_id" if activo["plataforma"] == "instagram" else "page_id") + "»")
    return ClienteMeta(valor, activo["plataforma"], id_cuenta)
