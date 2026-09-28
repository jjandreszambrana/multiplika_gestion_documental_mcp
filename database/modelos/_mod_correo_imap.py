"""Acceso IMAP a una cuenta de correo del registro de credenciales — ver
docs/gestion-documental.md → "Correo por IMAP". Lo usa
mcp_server/herramientas/_herr_correo.py.

Una conexión por petición (abrir, hacer la operación, cerrar), no una
sesión abierta en el servidor: aguanta reinicios y no deja decenas de
buzones conectados a la vez, a cambio de ~1 s más por llamada.

Cómo se lee la credencial (gd_credenciales + gd_credenciales_campos):
- `usuario`: la dirección/login de la cuenta. `valor`: la contraseña (en
  Gmail, una contraseña de aplicación).
- Campos extra opcionales: `imap_host` (si no, se deduce del dominio:
  proveedores conocidos, o `imap.<dominio>` y si no existe `mail.<dominio>`),
  `imap_port` (993), `imap_seguridad` (ssl | starttls | ninguna).
- Microsoft 365 no acepta contraseña: con los campos extra `tenant_id` y
  `client_id` se usa OAuth de aplicación (client credentials, permiso
  IMAP.AccessAsApp en Entra ID) y el secreto de la aplicación va en el
  campo extra `client_secret` o, si no está, en `valor`.

La contraseña/token nunca sale de este módulo."""

import asyncio
import base64
import email
import html
import imaplib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from datetime import date, timedelta
from email import policy
from email.message import Message
from email.utils import parsedate_to_datetime

from lib.cifrado import descifrar

from ._mod_credenciales import CredencialesCRUD
from ._mod_credenciales_campos import CredencialesCamposCRUD

TIMEOUT_SEGUNDOS = 30
LIMITE_TEXTO_CUERPO = 20_000
LIMITE_BYTES_ADJUNTO = 20 * 1024 * 1024
HOST_MICROSOFT = "outlook.office365.com"
HOSTS_CONOCIDOS = {
    "gmail.com": "imap.gmail.com",
    "googlemail.com": "imap.gmail.com",
    "outlook.com": HOST_MICROSOFT,
    "outlook.es": HOST_MICROSOFT,
    "hotmail.com": HOST_MICROSOFT,
    "hotmail.es": HOST_MICROSOFT,
    "live.com": HOST_MICROSOFT,
    "yahoo.com": "imap.mail.yahoo.com",
    "yahoo.es": "imap.mail.yahoo.com",
    "icloud.com": "imap.mail.me.com",
}
MESES_IMAP = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
USOS_CARPETA = {"\\sent", "\\trash", "\\junk", "\\drafts", "\\archive", "\\all", "\\flagged"}


class ErrorCorreo(Exception):
    """Fallo explicable al cliente (credencial incompleta, login rechazado,
    carpeta inexistente...) — la tool lo convierte en ToolError tal cual."""


# --- Cuenta a partir de la credencial ------------------------------------

async def cargar_cuenta(config: dict, nombre_credencial: str) -> dict:
    fila = await CredencialesCRUD(config).obtener_por_nombre(nombre_credencial)
    if not fila:
        raise ErrorCorreo(f'No existe ninguna credencial llamada "{nombre_credencial}" (ver listar_credenciales_gd)')
    extra = await CredencialesCamposCRUD(config).valores_descifrados(fila["id"])
    usuario = (fila["usuario"] or "").strip()
    if not usuario:
        raise ErrorCorreo(f'La credencial "{nombre_credencial}" no tiene usuario: ponle la dirección de correo desde el panel')

    oauth = bool(extra.get("tenant_id") and extra.get("client_id"))
    dominio = usuario.rsplit("@", 1)[-1].lower() if "@" in usuario else ""
    host = extra.get("imap_host") or (HOST_MICROSOFT if oauth else HOSTS_CONOCIDOS.get(dominio))
    hosts = [host] if host else [f"imap.{dominio}", f"mail.{dominio}"] if dominio else []
    if not hosts:
        raise ErrorCorreo(f'No sé a qué servidor conectar: añade el campo extra "imap_host" a la credencial "{nombre_credencial}"')
    seguridad = (extra.get("imap_seguridad") or "ssl").lower()
    if seguridad not in ("ssl", "starttls", "ninguna"):
        raise ErrorCorreo('El campo extra "imap_seguridad" debe ser ssl, starttls o ninguna')

    cuenta = {
        "nombre": nombre_credencial,
        "usuario": usuario,
        "hosts": hosts,
        "puerto": int(extra.get("imap_port") or (993 if seguridad == "ssl" else 143)),
        "seguridad": seguridad,
        "password": descifrar(fila["valor_cifrado"]),
    }
    if oauth:
        cuenta["token"] = await asyncio.to_thread(
            _token_microsoft, extra["tenant_id"], extra["client_id"], extra.get("client_secret") or cuenta["password"]
        )
    return cuenta


def _token_microsoft(tenant_id: str, client_id: str, client_secret: str) -> str:
    datos = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": f"https://{HOST_MICROSOFT}/.default",
    }).encode()
    url = f"https://login.microsoftonline.com/{urllib.parse.quote(tenant_id)}/oauth2/v2.0/token"
    try:
        with urllib.request.urlopen(url, data=datos, timeout=TIMEOUT_SEGUNDOS) as respuesta:
            return json.load(respuesta)["access_token"]
    except urllib.error.HTTPError as e:
        detalle = json.loads(e.read() or b"{}").get("error_description", "").split("\r\n")[0]
        raise ErrorCorreo(f"Microsoft rechazó la autorización de la aplicación: {detalle or e.code}") from e
    except (urllib.error.URLError, OSError, KeyError, ValueError) as e:
        raise ErrorCorreo(f"No se pudo obtener el permiso de Microsoft: {e}") from e


# --- Sesión IMAP ---------------------------------------------------------

@contextmanager
def _sesion(cuenta: dict):
    """Abre, autentica y activa UTF-8 si el servidor lo admite; siempre
    cierra al salir. Devuelve (imap, capacidades)."""
    imap, fallos = None, []
    for host in cuenta["hosts"]:  # sin imap_host: imap.<dominio> y, si no responde, mail.<dominio>
        try:
            if cuenta["seguridad"] == "ssl":
                imap = imaplib.IMAP4_SSL(host, cuenta["puerto"], timeout=TIMEOUT_SEGUNDOS)
            else:
                imap = imaplib.IMAP4(host, cuenta["puerto"], timeout=TIMEOUT_SEGUNDOS)
                if cuenta["seguridad"] == "starttls":
                    imap.starttls()
            break
        except OSError as e:
            fallos.append(f'{host}:{cuenta["puerto"]} ({e})')
    if imap is None:
        raise ErrorCorreo(
            f'No se pudo conectar con {" ni con ".join(fallos)}. Si el servidor de correo es otro, '
            f'añade desde el panel el campo extra "imap_host" a la credencial "{cuenta["nombre"]}".'
        )

    try:
        try:
            if cuenta.get("token"):
                cadena = f'user={cuenta["usuario"]}\x01auth=Bearer {cuenta["token"]}\x01\x01'.encode()
                imap.authenticate("XOAUTH2", lambda _: cadena)
            else:
                imap.login(cuenta["usuario"], cuenta["password"])
        except imaplib.IMAP4.error as e:
            raise ErrorCorreo(
                f'El servidor rechazó el acceso con la credencial "{cuenta["nombre"]}" ({_respuesta(e)}). Revisa usuario y '
                "contraseña desde el panel; en Gmail hace falta una contraseña de aplicación, y en "
                "Microsoft 365 los campos tenant_id/client_id/client_secret."
            ) from e
        _, datos = imap.capability()
        capacidades = set(datos[0].decode(errors="replace").upper().split()) if datos and datos[0] else set()
        imap.capabilities = tuple(capacidades)  # imaplib no las refresca tras el login
        if "UTF8=ACCEPT" in capacidades:
            imap.enable("UTF8=ACCEPT")
        yield imap, capacidades
    finally:
        try:
            imap.logout()
        except (imaplib.IMAP4.error, OSError):
            pass


async def _ejecutar(funcion, *args):
    """imaplib es bloqueante: a un hilo, y cualquier fallo de red o de
    protocolo se devuelve como ErrorCorreo."""
    try:
        return await asyncio.to_thread(funcion, *args)
    except ErrorCorreo:
        raise
    except (imaplib.IMAP4.error, OSError) as e:
        raise ErrorCorreo(f"Fallo hablando con el servidor de correo: {_respuesta(e)}") from e


def _fecha_imap(dia: date) -> str:
    """dd-Mmm-aaaa con el mes en inglés, sin depender del locale (%b)."""
    return f"{dia.day:02d}-{MESES_IMAP[dia.month - 1]}-{dia.year}"


def _respuesta(datos) -> str:
    """Texto legible de una respuesta de imaplib (lista de bytes o excepción)."""
    if isinstance(datos, Exception):
        datos = datos.args
    return " ".join(d.decode(errors="replace") if isinstance(d, bytes) else str(d) for d in datos or [])


def _entrecomillar(texto: str) -> str:
    return '"' + texto.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _utf7_codificar(texto: str) -> str:
    """UTF-7 modificado de IMAP (RFC 3501 §5.1.3) para nombres de carpeta
    cuando el servidor no admite UTF8=ACCEPT."""
    partes, tramo = [], []

    def volcar():
        if tramo:
            b64 = base64.b64encode("".join(tramo).encode("utf-16-be")).decode().rstrip("=").replace("/", ",")
            partes.append(f"&{b64}-")
            tramo.clear()

    for c in texto:
        if 0x20 <= ord(c) <= 0x7E:
            volcar()
            partes.append("&-" if c == "&" else c)
        else:
            tramo.append(c)
    volcar()
    return "".join(partes)


def _utf7_decodificar(texto: str) -> str:
    def trozo(m):
        if not m.group(1):
            return "&"
        b64 = m.group(1).replace(",", "/")
        return base64.b64decode(b64 + "=" * (-len(b64) % 4)).decode("utf-16-be")

    return re.sub(r"&([A-Za-z0-9+,]*)-", trozo, texto)


def _nombre_carpeta(imap: imaplib.IMAP4, carpeta: str) -> str:
    return _entrecomillar(carpeta if imap.utf8_enabled else _utf7_codificar(carpeta))


def _seleccionar(imap: imaplib.IMAP4, carpeta: str, solo_lectura: bool) -> None:
    tipo, _ = imap.select(_nombre_carpeta(imap, carpeta), readonly=solo_lectura)
    if tipo != "OK":
        raise ErrorCorreo(f'No existe la carpeta "{carpeta}" (ver listar_carpetas_correo_gd)')


def _conjunto_uids(uids: list[int]) -> str:
    if not uids:
        raise ErrorCorreo("Indica al menos un uid de correo")
    return ",".join(str(int(u)) for u in uids)


# --- Lectura de mensajes -------------------------------------------------

def _html_a_texto(contenido: str) -> str:
    contenido = re.sub(r"(?is)<(script|style|head)\b.*?</\1>", "", contenido)
    contenido = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d)>", "\n", contenido)
    contenido = html.unescape(re.sub(r"<[^>]+>", "", contenido))
    return re.sub(r"\n\s*\n+", "\n\n", contenido).strip()


def _texto_parte(parte: Message) -> str:
    try:
        return parte.get_content()
    except (LookupError, KeyError, ValueError):
        return (parte.get_payload(decode=True) or b"").decode("utf-8", errors="replace")


def _fecha_iso(valor: str | None) -> str | None:
    try:
        return parsedate_to_datetime(valor).isoformat() if valor else None
    except (TypeError, ValueError):
        return valor


def _adjuntos(mensaje: Message) -> list[Message]:
    """Mismo criterio que scripts/revisar_correo_entrante.py: toda parte
    hoja con nombre de fichero, también las de un correo reenviado."""
    return [p for p in mensaje.walk() if not p.is_multipart() and p.get_filename()]


def _fetch_mensaje(imap: imaplib.IMAP4, uid: int) -> tuple[Message, list[str]]:
    _, datos = imap.uid("FETCH", str(int(uid)), "(FLAGS BODY.PEEK[])")
    for item in datos:
        if isinstance(item, tuple):
            flags = re.search(rb"FLAGS \(([^)]*)\)", item[0])
            return (
                email.message_from_bytes(item[1], policy=policy.default),
                flags.group(1).decode().split() if flags else [],
            )
    raise ErrorCorreo(f"No existe ningún correo con uid {uid} en esa carpeta")


def _listar_carpetas(cuenta: dict) -> list[dict]:
    with _sesion(cuenta) as (imap, _):
        _, datos = imap.list()
        carpetas = []
        for linea in datos:
            if isinstance(linea, tuple):  # nombre enviado como literal
                linea = linea[0].rsplit(b"{", 1)[0] + _entrecomillar(linea[1].decode(errors="replace")).encode()
            m = re.match(rb'\((?P<flags>[^)]*)\) (?:"[^"]*"|NIL) (?P<nombre>.+)$', linea or b"")
            if not m:
                continue
            flags = m["flags"].decode().lower().split()
            if "\\noselect" in flags or "\\nonexistent" in flags:
                continue
            nombre = m["nombre"].decode("utf-8", errors="replace")
            if nombre.startswith('"'):
                nombre = nombre[1:-1].replace('\\"', '"').replace("\\\\", "\\")
            if not imap.utf8_enabled:
                nombre = _utf7_decodificar(nombre)
            uso = next((f[1:] for f in flags if f in USOS_CARPETA), None)
            carpetas.append({"carpeta": nombre, "uso": uso})
        return carpetas


def _buscar(
    cuenta: dict, carpeta: str, solo_no_leidos: bool, remitente: str | None, asunto: str | None,
    desde: date | None, hasta: date | None, limite: int,
) -> dict:
    with _sesion(cuenta) as (imap, _):
        _seleccionar(imap, carpeta, solo_lectura=True)
        criterios, filtros_locales = [], {}
        if solo_no_leidos:
            criterios.append("UNSEEN")
        if desde:
            criterios += ["SINCE", _fecha_imap(desde)]
        if hasta:
            criterios += ["BEFORE", _fecha_imap(hasta + timedelta(days=1))]
        for clave, valor in (("FROM", remitente), ("SUBJECT", asunto)):
            if not valor:
                continue
            if imap.utf8_enabled or valor.isascii():
                criterios += [clave, _entrecomillar(valor)]
            else:  # sin UTF8=ACCEPT el servidor no busca acentos: se filtra aquí
                filtros_locales[clave] = valor.lower()
        _, datos = imap.uid("SEARCH", *(criterios or ["ALL"]))
        uids = [int(u) for u in (datos[0] or b"").split()][::-1]  # más recientes primero

        correos = []
        for i in range(0, len(uids), 50):
            if len(correos) >= limite:
                break
            lote = ",".join(str(u) for u in uids[i:i + 50])
            _, datos = imap.uid("FETCH", lote, "(UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])")
            cabeceras = []
            for item in datos:
                if not isinstance(item, tuple):
                    continue
                uid = re.search(rb"UID (\d+)", item[0])
                flags = re.search(rb"FLAGS \(([^)]*)\)", item[0])
                cab = email.message_from_bytes(item[1], policy=policy.default)
                cabeceras.append({
                    "uid": int(uid.group(1)) if uid else None,
                    "fecha": _fecha_iso(cab["Date"]),
                    "de": str(cab["From"] or ""),
                    "para": str(cab["To"] or ""),
                    "asunto": str(cab["Subject"] or ""),
                    "leido": bool(flags and b"\\Seen" in flags.group(1)),
                })
            for c in sorted(cabeceras, key=lambda c: c["uid"] or 0, reverse=True):
                if "FROM" in filtros_locales and filtros_locales["FROM"] not in c["de"].lower():
                    continue
                if "SUBJECT" in filtros_locales and filtros_locales["SUBJECT"] not in c["asunto"].lower():
                    continue
                correos.append(c)
                if len(correos) >= limite:
                    break
        return {"carpeta": carpeta, "coincidencias": None if filtros_locales else len(uids), "correos": correos}


def _leer(cuenta: dict, carpeta: str, uid: int) -> dict:
    with _sesion(cuenta) as (imap, _):
        _seleccionar(imap, carpeta, solo_lectura=True)
        mensaje, flags = _fetch_mensaje(imap, uid)
    cuerpo = mensaje.get_body(preferencelist=("plain", "html"))
    texto = _texto_parte(cuerpo) if cuerpo else ""
    if cuerpo is not None and cuerpo.get_content_type() == "text/html":
        texto = _html_a_texto(texto)
    recortado = len(texto) > LIMITE_TEXTO_CUERPO
    return {
        "uid": uid,
        "carpeta": carpeta,
        "fecha": _fecha_iso(mensaje["Date"]),
        "de": str(mensaje["From"] or ""),
        "para": str(mensaje["To"] or ""),
        "cc": str(mensaje["Cc"] or ""),
        "asunto": str(mensaje["Subject"] or ""),
        "leido": "\\Seen" in flags,
        "texto": texto[:LIMITE_TEXTO_CUERPO] + ("\n[… texto recortado]" if recortado else ""),
        "adjuntos": [
            {"nombre": p.get_filename(), "tipo_mime": p.get_content_type(), "bytes": len(p.get_payload(decode=True) or b"")}
            for p in _adjuntos(mensaje)
        ],
    }


def _adjunto(cuenta: dict, carpeta: str, uid: int, nombre: str) -> tuple[bytes, str, str]:
    with _sesion(cuenta) as (imap, _):
        _seleccionar(imap, carpeta, solo_lectura=True)
        mensaje, _ = _fetch_mensaje(imap, uid)
    for parte in _adjuntos(mensaje):
        if parte.get_filename() == nombre:
            contenido = parte.get_payload(decode=True) or b""
            if len(contenido) > LIMITE_BYTES_ADJUNTO:
                raise ErrorCorreo(f"El adjunto pesa más de {LIMITE_BYTES_ADJUNTO // (1024 * 1024)} MB")
            return contenido, parte.get_content_type(), nombre
    raise ErrorCorreo(f'El correo {uid} no tiene ningún adjunto llamado "{nombre}" (ver leer_correo_gd)')


# --- Cambios en el buzón -------------------------------------------------

def _marcar_leido(cuenta: dict, carpeta: str, uids: list[int], leido: bool) -> None:
    with _sesion(cuenta) as (imap, _):
        _seleccionar(imap, carpeta, solo_lectura=False)
        tipo, datos = imap.uid("STORE", _conjunto_uids(uids), "+FLAGS" if leido else "-FLAGS", "(\\Seen)")
        if tipo != "OK":
            raise ErrorCorreo(f"El servidor no dejó cambiar el estado: {_respuesta(datos)}")


def _mover(cuenta: dict, carpeta: str, uids: list[int], destino: str) -> None:
    with _sesion(cuenta) as (imap, capacidades):
        _seleccionar(imap, carpeta, solo_lectura=False)
        conjunto, nombre_destino = _conjunto_uids(uids), _nombre_carpeta(imap, destino)
        if "MOVE" in capacidades:
            tipo, datos = imap.uid("MOVE", conjunto, nombre_destino)
        else:  # servidores antiguos: copiar, marcar como borrado y purgar solo esos
            tipo, datos = imap.uid("COPY", conjunto, nombre_destino)
            if tipo == "OK":
                imap.uid("STORE", conjunto, "+FLAGS", "(\\Deleted)")
                if "UIDPLUS" in capacidades:
                    imap.uid("EXPUNGE", conjunto)
                else:
                    imap.expunge()
        if tipo != "OK":
            raise ErrorCorreo(f'No se pudo mover a "{destino}" (¿existe esa carpeta?): {_respuesta(datos)}')


# --- API async para las tools --------------------------------------------

async def listar_carpetas(config: dict, credencial: str) -> list[dict]:
    return await _ejecutar(_listar_carpetas, await cargar_cuenta(config, credencial))


async def buscar_correos(config: dict, credencial: str, carpeta: str, solo_no_leidos: bool = False,
                         remitente: str | None = None, asunto: str | None = None,
                         desde: date | None = None, hasta: date | None = None, limite: int = 20) -> dict:
    cuenta = await cargar_cuenta(config, credencial)
    return await _ejecutar(_buscar, cuenta, carpeta, solo_no_leidos, remitente, asunto, desde, hasta, limite)


async def leer_correo(config: dict, credencial: str, carpeta: str, uid: int) -> dict:
    return await _ejecutar(_leer, await cargar_cuenta(config, credencial), carpeta, uid)


async def obtener_adjunto(config: dict, credencial: str, carpeta: str, uid: int, nombre: str) -> tuple[bytes, str, str]:
    return await _ejecutar(_adjunto, await cargar_cuenta(config, credencial), carpeta, uid, nombre)


async def marcar_leido(config: dict, credencial: str, carpeta: str, uids: list[int], leido: bool) -> None:
    await _ejecutar(_marcar_leido, await cargar_cuenta(config, credencial), carpeta, uids, leido)


async def mover_correos(config: dict, credencial: str, carpeta: str, uids: list[int], destino: str) -> None:
    await _ejecutar(_mover, await cargar_cuenta(config, credencial), carpeta, uids, destino)
