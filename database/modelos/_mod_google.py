"""Google para el SEO: Search Console (clics, impresiones, posiciones) y
PageSpeed Insights (velocidad) — ver docs/gestion-documental.md → "Webs y
redes sociales" (fase 3).

Search Console va con una cuenta de servicio de Google de Multiplika: el
cliente solo añade su correo como usuario (restringido basta) de su
propiedad en Search Console. La clave JSON vive en el servidor, en la ruta
de GD_GOOGLE_CUENTA_SERVICIO — no cabe en las credenciales de la GD y es
de Multiplika, no del cliente. Sin ella, Search Console no está disponible
y se dice así.

PageSpeed funciona sin clave (con pocas consultas); con GD_GOOGLE_API_KEY
en el entorno, con muchas más."""

import json
import os
import time
from datetime import date, timedelta
from urllib.parse import quote, urlparse

import httpx
import jwt

URL_TOKEN = os.environ.get("GD_URL_GOOGLE_TOKEN", "https://oauth2.googleapis.com/token")
URL_SEARCH_CONSOLE = os.environ.get("GD_URL_SEARCH_CONSOLE", "https://searchconsole.googleapis.com/webmasters/v3")
URL_PAGESPEED = os.environ.get("GD_URL_PAGESPEED", "https://www.googleapis.com/pagespeedonline/v5/runPagespeed")
ALCANCE = "https://www.googleapis.com/auth/webmasters.readonly"
TIMEOUT = 30
TIMEOUT_PAGESPEED = 120

_token = {"valor": None, "caduca": 0}


class GoogleError(Exception):
    pass


def cuenta_servicio() -> dict | None:
    ruta = os.environ.get("GD_GOOGLE_CUENTA_SERVICIO")
    if not ruta or not os.path.isfile(ruta):
        return None
    with open(ruta) as f:
        return json.load(f)


def correo_cuenta_servicio() -> str | None:
    """El correo que el cliente tiene que añadir en Search Console."""
    cuenta = cuenta_servicio()
    return cuenta.get("client_email") if cuenta else None


async def _token_acceso() -> str:
    if _token["valor"] and _token["caduca"] > time.time() + 60:
        return _token["valor"]
    cuenta = cuenta_servicio()
    if not cuenta:
        raise GoogleError("Search Console todavía no está disponible en este servidor (falta la cuenta de servicio de "
                          "Google de Multiplika). Avisa a soporte.")
    ahora = int(time.time())
    afirmacion = jwt.encode({"iss": cuenta["client_email"], "scope": ALCANCE, "aud": cuenta.get("token_uri", URL_TOKEN),
                             "iat": ahora, "exp": ahora + 3600}, cuenta["private_key"], algorithm="RS256")
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(os.environ.get("GD_URL_GOOGLE_TOKEN") or cuenta.get("token_uri", URL_TOKEN), data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": afirmacion})
    if r.status_code != 200:
        raise GoogleError(f"Google no ha aceptado la cuenta de servicio ({r.status_code})")
    datos = r.json()
    _token.update(valor=datos["access_token"], caduca=ahora + int(datos.get("expires_in", 3600)))
    return _token["valor"]


async def _google(metodo: str, url: str, json_cuerpo: dict | None = None) -> dict:
    token = await _token_acceso()
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.request(metodo, url, json=json_cuerpo, headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 403:
        raise GoogleError(f"Search Console no deja ver esta web a la cuenta de Multiplika: hay que añadir "
                          f"{correo_cuenta_servicio()} como usuario de la propiedad")
    if r.status_code >= 400:
        try:
            mensaje = r.json().get("error", {}).get("message")
        except ValueError:
            mensaje = None
        raise GoogleError(f"Search Console ha devuelto un error: {mensaje or r.status_code}")
    return r.json()


async def propiedades() -> list[str]:
    """Las propiedades de Search Console que la cuenta de Multiplika puede ver."""
    datos = await _google("GET", f"{URL_SEARCH_CONSOLE}/sites")
    return [s["siteUrl"] for s in datos.get("siteEntry", []) if s.get("permissionLevel") != "siteUnverifiedUser"]


async def propiedad_de(url_web: str, elegida: str | None = None) -> str:
    """La propiedad de Search Console de una web: la elegida en los ajustes
    o, si no, la que encaje con su dirección (de dominio o de prefijo)."""
    disponibles = await propiedades()
    if elegida:
        if elegida not in disponibles:
            raise GoogleError(f"La cuenta de Multiplika no ve la propiedad «{elegida}» en Search Console: hay que añadir "
                              f"{correo_cuenta_servicio()} como usuario")
        return elegida
    host = (urlparse(url_web).hostname or "").lower()
    sin_www = host.removeprefix("www.")
    for p in disponibles:
        if p.startswith("sc-domain:") and (sin_www == p[10:] or sin_www.endswith("." + p[10:])):
            return p
    for p in disponibles:
        if (urlparse(p).hostname or "").lower() == host:
            return p
    raise GoogleError(f"No hay ninguna propiedad de Search Console para «{host}» a la que tenga acceso la cuenta de "
                      f"Multiplika. En Search Console → Configuración → Usuarios y permisos, añade "
                      f"{correo_cuenta_servicio()} (con permiso restringido basta).")


async def rendimiento(propiedad: str, desde: date, hasta: date, dimension: str | None = None,
                      limite: int = 25, filtro_pagina: str | None = None) -> list[dict]:
    """Clics, impresiones, CTR y posición media. `dimension`: None (totales),
    query, page, date, country, device."""
    cuerpo = {"startDate": desde.isoformat(), "endDate": hasta.isoformat(), "rowLimit": max(1, min(limite, 1000)),
              "dataState": "final"}
    if dimension:
        cuerpo["dimensions"] = [dimension]
    if filtro_pagina:
        cuerpo["dimensionFilterGroups"] = [{"filters": [{"dimension": "page", "operator": "equals", "expression": filtro_pagina}]}]
    datos = await _google("POST", f"{URL_SEARCH_CONSOLE}/sites/{quote(propiedad, safe='')}/searchAnalytics/query", cuerpo)
    return [{"clave": (f.get("keys") or [None])[0], "clics": f.get("clicks", 0), "impresiones": f.get("impressions", 0),
             "ctr": round(f.get("ctr", 0) * 100, 1), "posicion": round(f.get("position", 0), 1)}
            for f in datos.get("rows", [])]


async def resumen_periodo(propiedad: str, dias: int = 28, hasta: date | None = None) -> dict:
    """Totales de los últimos `dias` frente a los `dias` anteriores (Search
    Console tarda unos 3 días en tener los datos completos)."""
    hasta = hasta or date.today() - timedelta(days=3)
    desde = hasta - timedelta(days=dias - 1)
    actual = (await rendimiento(propiedad, desde, hasta) or [{"clics": 0, "impresiones": 0, "ctr": 0, "posicion": 0}])[0]
    anterior = (await rendimiento(propiedad, desde - timedelta(days=dias), desde - timedelta(days=1))
                or [{"clics": 0, "impresiones": 0, "ctr": 0, "posicion": 0}])[0]
    return {"desde": desde.isoformat(), "hasta": hasta.isoformat(), "actual": actual, "anterior": anterior}


async def velocidad(url: str, estrategia: str = "mobile") -> dict:
    """PageSpeed Insights de una página: puntuaciones (0-100) y las métricas
    que usa Google (de usuarios reales si las hay; si no, de laboratorio)."""
    params = [("url", url), ("strategy", estrategia)] + [("category", c) for c in
                                                        ("performance", "seo", "accessibility", "best-practices")]
    if os.environ.get("GD_GOOGLE_API_KEY"):
        params.append(("key", os.environ["GD_GOOGLE_API_KEY"]))
    async with httpx.AsyncClient(timeout=TIMEOUT_PAGESPEED) as c:
        r = await c.get(URL_PAGESPEED, params=params)
    if r.status_code == 429:
        raise GoogleError("PageSpeed no admite más consultas ahora mismo (límite de Google); prueba más tarde")
    if r.status_code >= 400:
        try:
            mensaje = r.json().get("error", {}).get("message")
        except ValueError:
            mensaje = None
        raise GoogleError(f"PageSpeed no ha podido medir la página: {mensaje or r.status_code}")
    datos = r.json()
    categorias = datos.get("lighthouseResult", {}).get("categories", {})
    auditorias = datos.get("lighthouseResult", {}).get("audits", {})
    reales = datos.get("loadingExperience", {}).get("metrics", {})

    def real(clave):
        m = reales.get(clave)
        return m.get("percentile") if m else None

    def lab(clave):
        return auditorias.get(clave, {}).get("numericValue")

    lcp = real("LARGEST_CONTENTFUL_PAINT_MS") or lab("largest-contentful-paint")
    cls = real("CUMULATIVE_LAYOUT_SHIFT_SCORE")
    cls = cls / 100 if cls is not None else lab("cumulative-layout-shift")
    oportunidades = sorted(
        ({"que": a.get("title"), "ahorro_ms": int(a.get("details", {}).get("overallSavingsMs") or 0)}
         for a in auditorias.values()
         if a.get("details", {}).get("type") == "opportunity" and (a.get("details", {}).get("overallSavingsMs") or 0) > 200),
        key=lambda x: -x["ahorro_ms"])[:6]
    return {
        "url": url, "estrategia": estrategia,
        "puntuaciones": {k: round((v.get("score") or 0) * 100) for k, v in categorias.items()},
        "lcp_ms": int(lcp) if lcp is not None else None,
        "cls": round(cls, 3) if cls is not None else None,
        "inp_ms": real("INTERACTION_TO_NEXT_PAINT"),
        "datos_de_usuarios_reales": bool(reales),
        "oportunidades": oportunidades,
    }
