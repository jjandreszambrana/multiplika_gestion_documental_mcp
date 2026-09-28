"""Herramientas MCP de gd_compartidos — enlaces para que alguien de fuera
descargue un documento en PDF (y, opcionalmente, su archivo original).
Ver docs/gestion-documental.md → "Compartir un documento por enlace"."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_compartidos import CompartidosCRUD, anular_compartido, crear_compartido


@mcp_app.tool()
async def compartir_documento_gd(
    id_documento: int,
    creado_por: str,
    dias_validez: int = 7,
    incluir_archivo_original: bool = False,
    email_destino: str | None = None,
    mensaje: str | None = None,
) -> dict:
    """Crea un enlace público para que alguien de fuera (sin cuenta)
    descargue este documento en PDF y, si `incluir_archivo_original`,
    también el archivo original que se adjuntó (el PDF escaneado, la
    foto...). Devuelve la `url` para que se la pases al cliente.

    El PDF se genera ahora y queda fijo: si el documento se corrige
    después, quien abra el enlace sigue viendo lo que se compartió hoy.
    Para mandar la versión corregida, crea un enlace nuevo.

    - `dias_validez`: 7, 30 o 90. Pasado ese plazo el enlace deja de
      funcionar. Si el cliente no dice nada, 7.
    - `email_destino`: si lo indicas, el enlace se manda por email desde
      la cuenta de correo del proyecto, con `mensaje` (opcional) como
      texto personal. Si no, solo se devuelve la URL para que el
      cliente la mande él. Si el email falla, el enlace queda creado
      igual: mira `estado_email` y `error_email` de la respuesta.
    - `creado_por`: quién comparte — sale en el email ("Ana te ha
      compartido..."). Pregúntaselo al cliente si no lo sabes.

    Quien tenga el enlace puede descargar: confirma con el cliente el
    documento y el destinatario antes de llamar a esta tool. No se puede
    compartir un documento archivado."""
    proyecto = await resolver_proyecto_actual()
    try:
        return await crear_compartido(
            get_db_config(proyecto["id"]), proyecto["id"], id_documento, creado_por,
            dias_validez, incluir_archivo_original, email_destino, mensaje,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_compartidos_documento_gd(id_documento: int) -> list[dict]:
    """Enlaces para compartir creados para un documento, más recientes
    primero, con su `estado` (activo, caducado o anulado), a quién se
    mandó y cuántas veces se ha descargado el PDF y el original."""
    proyecto = await resolver_proyecto_actual()
    return await CompartidosCRUD(get_db_config(proyecto["id"])).listar_de_documento(proyecto["id"], id_documento)


@mcp_app.tool()
async def anular_compartido_gd(id_compartido: int) -> dict:
    """Anula un enlace para compartir antes de que caduque: desde ese
    momento ya no deja descargar nada. No se puede deshacer — si hace
    falta otra vez, crea uno nuevo con compartir_documento_gd."""
    proyecto = await resolver_proyecto_actual()
    try:
        return await anular_compartido(get_db_config(proyecto["id"]), proyecto["id"], id_compartido)
    except ValueError as e:
        raise ToolError(str(e)) from e
