"""Herramientas MCP de correo por IMAP — ver docs/gestion-documental.md →
"Correo por IMAP". La cuenta sale siempre de una credencial del registro
(gd_credenciales, por su nombre); la contraseña o el token se resuelven
dentro de _mod_correo_imap.py y nunca llegan a esta conversación.

Los correos se identifican por su `uid` dentro de una carpeta (no cambia
aunque lleguen o se borren otros). Leer no marca nada como leído: eso
solo lo hace marcar_correo_leido_gd.

Ninguna va marcada con SOLO_LECTURA, tampoco las que solo leen: una key
de invitado no debe poder leer un buzón (decisión del usuario, 2026-09-28)."""

from datetime import date

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import File, Image

from ..database.modelos import _mod_correo_imap as correo
from ..database.modelos._mod_correo_imap import ErrorCorreo
from ..database.modelos._mod_documentos_pendientes import DocumentosPendientesCRUD


async def _config() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


def _fecha(valor: str | None, campo: str) -> date | None:
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError as e:
        raise ToolError(f"`{campo}` debe ir en formato AAAA-MM-DD") from e


@mcp_app.tool()
async def listar_carpetas_correo_gd(credencial: str) -> list[dict]:
    """Carpetas de la cuenta de correo de la credencial `credencial` (su
    nombre, ver listar_credenciales_gd). `uso` indica las especiales
    (Sent, Trash, Junk, Drafts, Archive...) para saber cuál es cuál aunque
    se llamen distinto en cada proveedor. Úsala también como prueba de que
    la conexión funciona."""
    try:
        return await correo.listar_carpetas(await _config(), credencial)
    except ErrorCorreo as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def listar_correos_gd(
    credencial: str, carpeta: str = "INBOX", solo_no_leidos: bool = False,
    remitente: str | None = None, asunto: str | None = None,
    desde: str | None = None, hasta: str | None = None, limite: int = 20,
) -> dict:
    """Correos de una carpeta, los más recientes primero: uid, fecha,
    remitente, destinatario, asunto y si está leído — sin el texto (para
    eso, leer_correo_gd). Filtros opcionales: `remitente` y `asunto`
    (contienen el texto), `desde`/`hasta` (AAAA-MM-DD, ambos incluidos) y
    `solo_no_leidos`. `limite` máximo 100. No marca nada como leído."""
    try:
        return await correo.buscar_correos(
            await _config(), credencial, carpeta, solo_no_leidos, remitente, asunto,
            _fecha(desde, "desde"), _fecha(hasta, "hasta"), max(1, min(limite, 100)),
        )
    except ErrorCorreo as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def leer_correo_gd(credencial: str, uid: int, carpeta: str = "INBOX") -> dict:
    """Un correo completo: cabeceras, texto (el HTML se pasa a texto; más
    de 20.000 caracteres se recortan) y la lista de adjuntos con su nombre.
    No lo marca como leído — si el cliente lo quiere, llama después a
    marcar_correo_leido_gd."""
    try:
        return await correo.leer_correo(await _config(), credencial, carpeta, uid)
    except ErrorCorreo as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def obtener_adjunto_correo_gd(credencial: str, uid: int, nombre_adjunto: str, carpeta: str = "INBOX") -> list:
    """Devuelve un adjunto de un correo (como imagen o archivo) para que
    puedas leerlo. `nombre_adjunto` exactamente como sale en leer_correo_gd.
    Si además hay que archivarlo en la gestión documental, usa
    guardar_adjunto_correo_gd."""
    try:
        contenido, tipo_mime, nombre = await correo.obtener_adjunto(await _config(), credencial, carpeta, uid, nombre_adjunto)
    except ErrorCorreo as e:
        raise ToolError(str(e)) from e
    subtipo = tipo_mime.split("/", 1)[-1]
    archivo = Image(data=contenido, format=subtipo) if tipo_mime.startswith("image/") else File(data=contenido, format=subtipo, name=nombre)
    return [f'Adjunto "{nombre}" del correo {uid}:', archivo]


@mcp_app.tool()
async def guardar_adjunto_correo_gd(credencial: str, uid: int, nombre_adjunto: str, carpeta: str = "INBOX") -> dict:
    """Mete un adjunto de un correo en la cola de documentos pendientes
    (origen email), igual que la ingesta automática del correo del
    proyecto. Luego se procesa como cualquier pendiente: pregunta al cliente
    tipo, nombre... y guárdalo con guardar_documento_gd pasando el
    `id_documento_pendiente` que devuelve esta tool."""
    config = await _config()
    try:
        contenido, tipo_mime, nombre = await correo.obtener_adjunto(config, credencial, carpeta, uid, nombre_adjunto)
    except ErrorCorreo as e:
        raise ToolError(str(e)) from e
    if not contenido:
        raise ToolError("El adjunto está vacío")
    id_pendiente = await DocumentosPendientesCRUD(config).crear(contenido, tipo_mime, nombre, "email")
    return {"id_documento_pendiente": id_pendiente, "nombre": nombre, "tipo_mime": tipo_mime, "bytes": len(contenido)}


@mcp_app.tool()
async def marcar_correo_leido_gd(credencial: str, uids: list[int], carpeta: str = "INBOX", leido: bool = True) -> dict:
    """Marca como leídos (o no leídos, con `leido=False`) uno o varios
    correos de una carpeta, por su uid."""
    try:
        await correo.marcar_leido(await _config(), credencial, carpeta, uids, leido)
    except ErrorCorreo as e:
        raise ToolError(str(e)) from e
    return {"carpeta": carpeta, "uids": uids, "leido": leido}


@mcp_app.tool()
async def mover_correo_gd(credencial: str, uids: list[int], carpeta_destino: str, carpeta: str = "INBOX") -> dict:
    """Mueve uno o varios correos (por su uid) de `carpeta` a
    `carpeta_destino`, que tiene que existir ya — consulta los nombres
    exactos con listar_carpetas_correo_gd. Tras moverlos, en la carpeta
    destino tienen otro uid: vuelve a listar si hay que seguir con ellos."""
    try:
        await correo.mover_correos(await _config(), credencial, carpeta, uids, carpeta_destino)
    except ErrorCorreo as e:
        raise ToolError(str(e)) from e
    return {"movidos": uids, "de": carpeta, "a": carpeta_destino}
