"""Herramientas MCP de gestión documental — ver docs/gestion-documental.md
→ "Tools MCP" y "Pipeline de ingesta". El proyecto se resuelve siempre a
partir de la API key autenticada, nunca de un parámetro (ver
guia_nuevo_proyecto.md, paso 6)."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_versiones import VersionesCRUD, guardar_documento


async def _config_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["slug"])


@mcp_app.tool()
async def guardar_documento_gd(
    nombre: str,
    tipo_documento: str,
    markdown: str,
    fecha_documento: str,
    id_documento_existente: int | None = None,
    todas_versiones_buscables: bool = False,
) -> dict:
    """Guarda un documento convertido a markdown. Antes de llamarla,
    pregunta siempre al usuario: tipo de documento (factura/certificado/
    contrato/informe/otro), nombre o referencia corta, si es una versión
    nueva de un documento ya guardado (usa buscar_documentos_gd para
    confirmar cuál, no lo adivines) o uno distinto, la fecha del propio
    documento (no la de hoy), y si todo su histórico debe quedar buscable
    o solo la última versión (por defecto solo la última).
    Si `id_documento_existente` se indica, esto es una nueva versión de ese
    documento (la versión anterior deja de ser la vigente); si no, crea un
    documento nuevo."""
    config = await _config_actual()
    try:
        return await guardar_documento(
            config, nombre, tipo_documento, markdown, fecha_documento,
            id_documento_existente, todas_versiones_buscables,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def buscar_documentos_gd(
    referencia: str | None = None, tipo_documento: str | None = None, limite: int = 20
) -> list[dict]:
    """Busca documentos por nombre/referencia y/o tipo (no por contenido).
    Sirve tanto para consulta exploratoria como para confirmar si un
    documento ya existe antes de guardar una supuesta nueva versión."""
    config = await _config_actual()
    return await DocumentosCRUD(config).buscar(referencia, tipo_documento, limite)


@mcp_app.tool()
async def consultar_documentos_gd(pregunta: str, limite: int = 5) -> list[dict]:
    """Responde preguntas del cliente buscando en el contenido de sus
    documentos. Devuelve los fragmentos más relevantes con su documento,
    tipo, fecha e identificadores, para citar la fuente y poder pedir el
    documento completo si un fragmento no basta."""
    config = await _config_actual()
    modo = await ConfiguracionCRUD(config).obtener_modo_busqueda()
    if modo != "fulltext":
        raise ToolError(
            f"El modo de búsqueda '{modo}' todavía no está implementado (solo 'fulltext' por ahora)"
        )
    return await VersionesCRUD(config).buscar_fulltext(pregunta, limite)
