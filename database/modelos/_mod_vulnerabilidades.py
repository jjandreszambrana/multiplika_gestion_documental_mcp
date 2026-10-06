"""Fallos de seguridad conocidos de plugins de WordPress, consultados a
WPScan (https://wpscan.com/api) con el token del cliente — credencial de la
GD llamada «wpscan». Se guarda cada respuesta un día
(gd_cache_vulnerabilidades): el plan gratuito da pocas consultas al día.

Va aparte para poder añadir otros servicios (Wordfence, Patchstack...)
sin tocar las comprobaciones: basta con otra función que devuelva lo mismo
({"latest_version", "vulnerabilities": [{"title", "fixed_in"}]})."""

import json
import os
from datetime import datetime, timedelta

import httpx
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_vigilancia import TABLA_CACHE_VULNERABILIDADES

NOMBRE_CREDENCIAL = "wpscan"
URL_API = os.environ.get("GD_URL_WPSCAN", "https://wpscan.com/api/v3")
_RUTAS = {"plugin": "plugins", "tema": "themes"}


async def buscar_vulnerabilidades(config: dict, token: str, tipo: str, slug: str) -> dict | None:
    """Lo que sabe WPScan de un plugin o tema, o None si no lo conoce."""
    clave = f"{tipo}:{slug}"
    db = AsyncDatabase(**config)
    tabla = TABLA_CACHE_VULNERABILIDADES.nombre
    guardado = await db.query(f'SELECT fecha, datos FROM "{tabla}" WHERE clave = %s', (clave,), uno=True)
    if guardado and guardado["fecha"] > datetime.now() - timedelta(days=1):
        return json.loads(guardado["datos"]) if guardado["datos"] else None

    async with httpx.AsyncClient(timeout=20) as cliente:
        r = await cliente.get(f"{URL_API}/{_RUTAS[tipo]}/{slug}", headers={"Authorization": f"Token token={token}"})
    if r.status_code == 404:
        datos = None
    elif r.status_code in (401, 403):
        raise RuntimeError("WPScan rechaza el token de la credencial «wpscan»")
    elif r.status_code == 429:
        raise RuntimeError("se han acabado las consultas del día en WPScan")
    elif r.status_code != 200:
        raise RuntimeError(f"WPScan ha devuelto un error {r.status_code}")
    else:
        datos = r.json().get(slug)
    await db.query(
        f'INSERT INTO "{tabla}" (clave, fecha, datos) VALUES (%s, %s, %s) '
        "ON CONFLICT (clave) DO UPDATE SET fecha = EXCLUDED.fecha, datos = EXCLUDED.datos",
        (clave, datetime.now(), json.dumps(datos) if datos is not None else None),
    )
    return datos
