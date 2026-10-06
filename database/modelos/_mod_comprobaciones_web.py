"""Las comprobaciones de vigilancia en sí: cada una mira algo de la web desde
fuera y devuelve (estado, resumen, detalle) — ver _mod_vigilancia.py, que
decide cuándo se lanzan, guarda el resultado y avisa.

Ninguna cambia nada en la web. Todas pasan por _comprobar_destino_publico
(no se llama a direcciones internas). `previo` es el detalle de la pasada
anterior, para comparar (p.ej. administradores nuevos)."""

import asyncio
import ipaddress
import json
import os
import socket
import ssl
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from ._mod_vulnerabilidades import buscar_vulnerabilidades
from ._mod_wordpress import ClienteWordPress, WordPressError, _comprobar_destino_publico

TIMEOUT = 15
URL_RDAP = os.environ.get("GD_URL_RDAP", "https://rdap.org")
LENTA_MS = 5000
CABECERA_NAVEGADOR = {"User-Agent": "Mozilla/5.0 (compatible; MultiplikaVigilancia/1.0)"}

# Segundos niveles habituales: para sacar el dominio registrado de un
# subdominio (www.tienda.com.es → tienda.com.es). Aproximado a propósito.
_SEGUNDOS_NIVELES = {"com.es", "org.es", "nom.es", "gob.es", "edu.es", "co.uk", "org.uk", "com.ar",
                     "com.mx", "com.br", "com.co", "com.pe", "com.au"}


def _host(url: str) -> str:
    return urlparse(url).hostname or ""


async def _get(url: str, limite_bytes: int = 4096) -> tuple[int, int, dict, str]:
    """(código, milisegundos, cabeceras, primeros bytes del cuerpo como texto)."""
    await asyncio.to_thread(_comprobar_destino_publico, url)
    inicio = time.monotonic()
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, headers=CABECERA_NAVEGADOR) as cliente:
        async with cliente.stream("GET", url) as r:
            trozo = b""
            async for bloque in r.aiter_bytes():
                trozo += bloque
                if len(trozo) >= limite_bytes:
                    break
            return r.status_code, int((time.monotonic() - inicio) * 1000), dict(r.headers), trozo[:limite_bytes].decode("utf-8", "replace")


async def disponibilidad(activo: dict, cliente: ClienteWordPress | None, previo: dict) -> tuple[str, str, dict]:
    error = None
    for intento in range(2):  # un fallo suelto de red no debe dar la alarma
        try:
            codigo, ms, _, _ = await _get(activo["url"] + "/", limite_bytes=1)
            break
        except (httpx.HTTPError, WordPressError) as e:
            error = str(e) or e.__class__.__name__
            if intento == 0:
                await asyncio.sleep(10)
    else:
        if "CERTIFICATE_VERIFY_FAILED" in error:
            return "grave", "La web no se abre con seguridad: su certificado (candado) no es válido", {"error": error}
        return "grave", f"La web no responde: {error}", {"error": error}
    detalle = {"codigo": codigo, "ms": ms}
    if codigo >= 500:
        return "grave", f"La web da error {codigo}", detalle
    if codigo >= 400:
        return "aviso", f"La portada responde con el código {codigo}", detalle
    if ms > LENTA_MS:
        return "aviso", f"La web responde, pero lenta: {ms / 1000:.1f} s", detalle
    return "ok", f"Responde bien ({ms} ms)", detalle


def _leer_certificado(host: str) -> dict:
    contexto = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=TIMEOUT) as s:
        with contexto.wrap_socket(s, server_hostname=host) as ss:
            return ss.getpeercert()


async def certificado(activo: dict, cliente, previo: dict) -> tuple[str, str, dict]:
    if not activo["url"].startswith("https://"):
        return "aviso", "La web no usa https (candado): los navegadores la marcan como no segura", {}
    host = _host(activo["url"])
    await asyncio.to_thread(_comprobar_destino_publico, activo["url"])
    try:
        cert = await asyncio.to_thread(_leer_certificado, host)
    except ssl.SSLCertVerificationError as e:
        return "grave", f"El certificado no es válido: {e.verify_message}", {"error": e.verify_message}
    except (OSError, ssl.SSLError) as e:
        return "error", f"No se ha podido leer el certificado: {e}", {"error": str(e)}
    caduca = datetime.fromtimestamp(ssl.cert_time_to_seconds(cert["notAfter"]), tz=timezone.utc)
    dias = (caduca - datetime.now(timezone.utc)).days
    emisor = dict(x[0] for x in cert.get("issuer", ())).get("organizationName")
    detalle = {"caduca": caduca.date().isoformat(), "dias": dias, "emisor": emisor}
    if dias < 7:
        return "grave", f"El certificado caduca en {dias} días ({caduca:%d/%m/%Y})", detalle
    if dias < 21:
        return "aviso", f"El certificado caduca en {dias} días ({caduca:%d/%m/%Y}); suele renovarse solo, conviene confirmarlo", detalle
    return "ok", f"Certificado válido hasta el {caduca:%d/%m/%Y}", detalle


def dominio_registrado(host: str) -> str:
    partes = host.lower().removeprefix("www.").split(".")
    if len(partes) >= 3 and ".".join(partes[-2:]) in _SEGUNDOS_NIVELES:
        return ".".join(partes[-3:])
    return ".".join(partes[-2:])


async def dominio(activo: dict, cliente, previo: dict) -> tuple[str, str, dict]:
    host = _host(activo["url"])
    try:
        ipaddress.ip_address(host)
        return "sin_datos", "La dirección es una IP, no un dominio: no hay caducidad que vigilar", {}
    except ValueError:
        pass
    nombre = dominio_registrado(host)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as c:
            r = await c.get(f"{URL_RDAP}/domain/{nombre}")
    except httpx.HTTPError as e:
        return "error", f"No se ha podido consultar el registro del dominio: {e}", {"dominio": nombre}
    if r.status_code != 200:
        return "sin_datos", (f"El registro de «{nombre}» no publica la fecha de caducidad (pasa, por ejemplo, con los "
                             ".es): conviene apuntarla como aviso programado"), {"dominio": nombre}
    eventos = {e.get("eventAction"): e.get("eventDate") for e in r.json().get("events", [])}
    if not eventos.get("expiration"):
        return "sin_datos", f"El registro de «{nombre}» no da la fecha de caducidad", {"dominio": nombre}
    caduca = datetime.fromisoformat(eventos["expiration"].replace("Z", "+00:00"))
    dias = (caduca - datetime.now(timezone.utc)).days
    detalle = {"dominio": nombre, "caduca": caduca.date().isoformat(), "dias": dias}
    if dias < 7:
        return "grave", f"El dominio «{nombre}» caduca en {dias} días ({caduca:%d/%m/%Y})", detalle
    if dias < 30:
        return "aviso", f"El dominio «{nombre}» caduca en {dias} días ({caduca:%d/%m/%Y})", detalle
    return "ok", f"Dominio «{nombre}» pagado hasta el {caduca:%d/%m/%Y}", detalle


_CABECERAS = {
    "strict-transport-security": "obliga al navegador a usar siempre https",
    "x-content-type-options": "evita que el navegador interprete archivos como otra cosa",
    "x-frame-options": "evita que otra web meta la tuya dentro de un marco para engañar",
    "referrer-policy": "controla qué se cuenta de tu web al salir hacia otras",
}


async def cabeceras(activo: dict, cliente, previo: dict) -> tuple[str, str, dict]:
    try:
        _, _, cab, _ = await _get(activo["url"] + "/", limite_bytes=1)
    except (httpx.HTTPError, WordPressError) as e:
        return "error", f"No se han podido leer las cabeceras: {e}", {}
    cab = {k.lower(): v for k, v in cab.items()}
    faltan = []
    for nombre, para in _CABECERAS.items():
        if nombre == "strict-transport-security" and not activo["url"].startswith("https://"):
            continue
        if nombre == "x-frame-options" and "frame-ancestors" in cab.get("content-security-policy", ""):
            continue
        if nombre not in cab:
            faltan.append({"cabecera": nombre, "para_que": para})
    detalle = {"faltan": faltan, "servidor": cab.get("server"), "x_powered_by": cab.get("x-powered-by")}
    if faltan:
        return "aviso", f"Faltan {len(faltan)} protecciones básicas del servidor: " + ", ".join(f["cabecera"] for f in faltan), detalle
    return "ok", "Tiene las protecciones básicas del servidor", detalle


# (ruta, gravedad, qué es, cómo reconocerlo en el contenido — si no, una web
# que contesta 200 a todo daría falsos positivos)
_EXPUESTOS = [
    ("/.env", "grave", "el archivo de configuración con contraseñas (.env)", ("DB_", "APP_KEY", "PASSWORD", "SECRET")),
    ("/.git/HEAD", "grave", "el historial de código (.git)", ("ref: refs/",)),
    ("/wp-config.php.bak", "grave", "una copia de wp-config.php con la contraseña de la base de datos", ("DB_PASSWORD",)),
    ("/wp-config.php~", "grave", "una copia de wp-config.php con la contraseña de la base de datos", ("DB_PASSWORD",)),
    ("/wp-config.old", "grave", "una copia de wp-config.php con la contraseña de la base de datos", ("DB_PASSWORD",)),
    ("/backup.sql", "grave", "una copia de la base de datos", ("INSERT INTO", "CREATE TABLE")),
    ("/database.sql", "grave", "una copia de la base de datos", ("INSERT INTO", "CREATE TABLE")),
    ("/dump.sql", "grave", "una copia de la base de datos", ("INSERT INTO", "CREATE TABLE")),
    ("/wp-content/debug.log", "aviso", "el registro de errores de WordPress (puede enseñar rutas y datos internos)", ("PHP ",)),
]


async def archivos_expuestos(activo: dict, cliente, previo: dict) -> tuple[str, str, dict]:
    encontrados = []
    for ruta, gravedad, que, marcas in _EXPUESTOS:
        try:
            codigo, _, _, cuerpo = await _get(activo["url"] + ruta)
        except (httpx.HTTPError, WordPressError):
            continue
        if codigo == 200 and any(m in cuerpo for m in marcas):
            encontrados.append({"ruta": ruta, "gravedad": gravedad, "que": que})
    if not encontrados:
        return "ok", "No se ve desde fuera ningún archivo que no debería", {"encontrados": []}
    estado = "grave" if any(e["gravedad"] == "grave" for e in encontrados) else "aviso"
    return estado, "Cualquiera puede descargar " + "; ".join(f"{e['que']} ({e['ruta']})" for e in encontrados), {"encontrados": encontrados}


def _version(texto: str | None) -> tuple:
    partes = []
    for trozo in (texto or "").split("."):
        numero = "".join(ch for ch in trozo if ch.isdigit())
        partes.append(int(numero) if numero else 0)
    return tuple(partes)


def es_anterior(instalada: str | None, otra: str | None) -> bool:
    if not instalada or not otra:
        return False
    a, b = _version(instalada), _version(otra)
    largo = max(len(a), len(b))
    return a + (0,) * (largo - len(a)) < b + (0,) * (largo - len(b))


async def wordpress(activo: dict, cliente: ClienteWordPress | None, previo: dict, config: dict | None = None,
                    token_vulnerabilidades: str | None = None) -> tuple[str, str, dict]:
    """Administradores nuevos y plugins con fallos de seguridad conocidos.
    Necesita que el usuario de WordPress sea administrador."""
    if cliente is None:
        return "error", "Falta la credencial de WordPress para poder revisarla por dentro", {}
    try:
        admins = await cliente.administradores()
        plugins = await cliente.listar("plugins")
    except WordPressError as e:
        if "no deja" in str(e):
            return "sin_datos", ("El usuario de WordPress que usa la gestión documental no es administrador: no se "
                                 "pueden revisar los administradores ni los plugins"), {}
        return "error", f"No se ha podido revisar WordPress: {e}", {}

    # Los conocidos solo cambian la primera vez o cuando alguien da por buenos
    # los nuevos (aceptar_administradores en _mod_vigilancia.py): así el aviso
    # sigue en pie hasta que una persona lo revisa.
    conocidos = previo.get("administradores_conocidos")
    if conocidos is None:
        conocidos = [a["id"] for a in admins]
    nuevos = [a for a in admins if a["id"] not in conocidos]
    problemas, avisos = [], []
    if nuevos:
        problemas.append("administrador nuevo sin revisar: " + ", ".join(f"{a['nombre']} ({a['usuario']})" for a in nuevos)
                         + " — si es de confianza, dalo por bueno; si no, puede ser un intruso")

    vulnerables, desactualizados, consultados = [], [], False
    if token_vulnerabilidades and config:
        consultados = True
        for p in plugins:
            slug = (p.get("plugin") or "").split("/")[0]
            if not slug:
                continue
            try:
                info = await buscar_vulnerabilidades(config, token_vulnerabilidades, "plugin", slug)
            except Exception as e:  # servicio caído o sin consultas: no tumba el resto
                avisos.append(f"no se pudo consultar fallos conocidos ({e})")
                break
            if not info:
                continue
            for v in info.get("vulnerabilities", []):
                if v.get("fixed_in") and es_anterior(p["version"], v["fixed_in"]):
                    vulnerables.append({"plugin": p["nombre"], "version": p["version"], "activo": p["estado"] == "activo",
                                        "fallo": v.get("title"), "arreglado_en": v["fixed_in"]})
            if es_anterior(p["version"], info.get("latest_version")):
                desactualizados.append({"plugin": p["nombre"], "version": p["version"], "ultima": info["latest_version"]})

    if any(v["activo"] for v in vulnerables):
        problemas.append(f"{len({v['plugin'] for v in vulnerables if v['activo']})} plugin(s) activos con fallos de "
                         "seguridad conocidos que ya tienen arreglo: hay que actualizarlos")
    elif vulnerables:
        avisos.append("hay plugins desactivados con fallos de seguridad conocidos: mejor borrarlos o actualizarlos")
    if desactualizados:
        avisos.append(f"{len(desactualizados)} plugin(s) con versión nueva disponible")
    if not consultados:
        avisos.append("para buscar fallos de seguridad conocidos en los plugins hace falta una credencial «wpscan»")

    detalle = {"administradores": admins, "administradores_conocidos": conocidos, "nuevos_administradores": nuevos, "plugins": len(plugins),
               "vulnerables": vulnerables, "desactualizados": desactualizados, "fallos_consultados": consultados}
    if problemas:
        texto = "; ".join(problemas)
        return "grave", texto[0].upper() + texto[1:], detalle
    texto = f"{len(admins)} administrador(es), {len(plugins)} plugins"
    if avisos and (vulnerables or desactualizados):
        return "aviso", f"{texto}; " + "; ".join(avisos), detalle
    return "ok", texto + (f" ({'; '.join(avisos)})" if avisos else ", sin fallos conocidos"), detalle


async def spam(activo: dict, cliente: ClienteWordPress | None, previo: dict) -> tuple[str, str, dict]:
    if cliente is None:
        return "error", "Falta la credencial de WordPress", {}
    try:
        retenidos = await cliente.listar("comentarios", estado="retenido", por_pagina=50)
        en_spam = await cliente.listar("comentarios", estado="spam", por_pagina=50)
    except WordPressError as e:
        return "error", f"No se han podido leer los comentarios: {e}", {}
    detalle = {"retenidos": len(retenidos), "spam": len(en_spam)}
    mas = "+" if len(retenidos) == 50 else ""
    if len(retenidos) >= 20:
        return "aviso", f"Hay {len(retenidos)}{mas} comentarios esperando moderación", detalle
    return "ok", f"{len(retenidos)}{mas} comentarios esperando moderación, {len(en_spam)} en spam", detalle


def a_json(detalle: dict) -> str:
    return json.dumps(detalle, ensure_ascii=False, default=str)
