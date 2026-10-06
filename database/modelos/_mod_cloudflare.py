"""Cloudflare: el escudo delante de la web — ver docs/gestion-documental.md →
"Webs y redes sociales". La protección contra ataques la da Cloudflare; la
GD vigila que esté bien puesto y, con permiso, cambia el nivel de seguridad
(p.ej. el modo «estoy siendo atacado») como cualquier otra propuesta.

Credencial de la GD con el token de API de Cloudflare (valor), con permiso
de lectura de la zona y de edición de sus ajustes. Se elige en los ajustes
de la web (cloudflare_credencial). Sin probar todavía contra una cuenta
real de Cloudflare: ver el plan."""

import os
from datetime import datetime
from urllib.parse import urlparse

import httpx

from ._mod_activos_digitales import ajustes_efectivos
from ._mod_comprobaciones_web import dominio_registrado
from ._mod_credenciales import CredencialesCRUD

URL_API = os.environ.get("GD_URL_CLOUDFLARE", "https://api.cloudflare.com/client/v4")
TIMEOUT = 20
NIVELES = {"essentially_off": "casi desactivado", "low": "bajo", "medium": "medio", "high": "alto",
           "under_attack": "estoy siendo atacado"}


class CloudflareError(Exception):
    pass


class ClienteCloudflare:
    def __init__(self, token: str, url_web: str):
        self._cabeceras = {"Authorization": f"Bearer {token}"}
        self.dominio = dominio_registrado(urlparse(url_web).hostname or "")
        self._zona = None

    async def _llamar(self, metodo: str, ruta: str, json: dict | None = None, params: dict | None = None):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as c:
                r = await c.request(metodo, f"{URL_API}{ruta}", headers=self._cabeceras, json=json, params=params)
        except httpx.HTTPError as e:
            raise CloudflareError(f"No se ha podido hablar con Cloudflare: {e}")
        datos = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code in (401, 403):
            raise CloudflareError("Cloudflare rechaza el token: revisa que sea válido y tenga permiso sobre esta zona")
        if not datos.get("success"):
            errores = "; ".join(e.get("message", "") for e in datos.get("errors", [])) or f"código {r.status_code}"
            raise CloudflareError(f"Cloudflare ha devuelto un error: {errores}")
        return datos["result"]

    async def zona(self) -> dict:
        if self._zona is None:
            zonas = await self._llamar("GET", "/zones", params={"name": self.dominio})
            if not zonas:
                raise CloudflareError(f"El dominio «{self.dominio}» no está en esta cuenta de Cloudflare")
            self._zona = zonas[0]
        return self._zona

    async def ajuste(self, nombre: str) -> str:
        return (await self._llamar("GET", f"/zones/{(await self.zona())['id']}/settings/{nombre}"))["value"]

    async def cambiar_ajuste(self, nombre: str, valor: str) -> str:
        r = await self._llamar("PATCH", f"/zones/{(await self.zona())['id']}/settings/{nombre}", json={"value": valor})
        return r["value"]


async def cliente_de(config: dict, activo: dict, nombre_credencial: str) -> ClienteCloudflare:
    credenciales = CredencialesCRUD(config)
    credencial = await credenciales.obtener_por_nombre(nombre_credencial)
    if not credencial:
        raise CloudflareError(f"No existe la credencial «{nombre_credencial}» de Cloudflare")
    if not activo.get("url"):
        raise CloudflareError("La web no tiene dirección")
    return ClienteCloudflare(await credenciales.valor_descifrado(credencial["id"]), activo["url"])


async def comprobar(cliente: ClienteCloudflare, previo: dict) -> tuple[str, str, dict]:
    """Que la zona esté activa, con https completo y redirección a https; y
    el nivel de seguridad (avisa si «estoy siendo atacado» lleva puesto más
    de un día: ralentiza a todos los visitantes)."""
    zona = await cliente.zona()
    ssl = await cliente.ajuste("ssl")
    https = await cliente.ajuste("always_use_https")
    nivel = await cliente.ajuste("security_level")
    detalle = {"dominio": cliente.dominio, "estado_zona": zona.get("status"), "plan": (zona.get("plan") or {}).get("name"),
               "ssl": ssl, "siempre_https": https, "nivel_seguridad": nivel,
               "atacado_desde": previo.get("atacado_desde") if nivel == "under_attack" else None}
    if zona.get("status") != "active":
        return "grave", f"Cloudflare no está protegiendo «{cliente.dominio}» (estado: {zona.get('status')})", detalle
    avisos = []
    if ssl in ("off", "flexible"):
        avisos.append("el cifrado entre Cloudflare y el servidor no es completo (modo SSL «" + ssl + "»): conviene «full (strict)»")
    if https != "on":
        avisos.append("no obliga a usar https")
    if nivel == "under_attack":
        detalle["atacado_desde"] = detalle["atacado_desde"] or datetime.now().isoformat()
        horas = (datetime.now() - datetime.fromisoformat(detalle["atacado_desde"])).total_seconds() / 3600
        if horas > 24:
            avisos.append(f"lleva {int(horas)} horas en modo «estoy siendo atacado», que ralentiza a todos los visitantes")
    texto = f"Protegida por Cloudflare (nivel {NIVELES.get(nivel, nivel)})"
    if avisos:
        return "aviso", texto + "; " + "; ".join(avisos), detalle
    return "ok", texto, detalle


async def comprobacion(activo: dict, cliente, previo: dict, config: dict | None = None, **_) -> tuple[str, str, dict]:
    """La comprobación de vigilancia «cloudflare» (ver _mod_vigilancia.py)."""
    try:
        cf = await cliente_de(config, activo, ajustes_efectivos(activo)["cloudflare_credencial"])
        return await comprobar(cf, previo)
    except CloudflareError as e:
        return "error", str(e), {}
