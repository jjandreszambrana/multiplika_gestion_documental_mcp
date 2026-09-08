"""Herramientas MCP de gestión documental — ver docs/gestion-documental.md
→ "Tools MCP" y "Pipeline de ingesta". El proyecto se resuelve siempre a
partir de la API key autenticada, nunca de un parámetro (ver
guia_nuevo_proyecto.md, paso 6)."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config, get_mistral_api_key
from fastmcp.exceptions import ToolError

from ..database.modelos._mod_chunks import ChunksCRUD, limpiar_chunks_no_buscables, reindexar_version
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_embeddings import generar_embeddings
from ..database.modelos._mod_versiones import VersionesCRUD, guardar_documento


async def _config_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["slug"])


async def _reindexar_si_semantico(config: dict, id_documento: int, id_version: int, markdown: str) -> None:
    """Tras guardar o corregir una versión: si el modo es semántico,
    recalcula sus chunks y limpia los de versiones que hayan dejado de ser
    buscables. Si falla la llamada a Mistral, no revienta la tool que
    guardó el documento — el documento ya quedó guardado; solo avisa."""
    modo = await ConfiguracionCRUD(config).obtener_modo_busqueda()
    if modo != "semantico":
        return
    api_key = await get_mistral_api_key()
    if not api_key:
        raise ToolError(
            "El modo de búsqueda es 'semantico' pero no hay ninguna clave de API de Mistral "
            "configurada en el panel de administración — el documento se guardó, pero no quedará "
            "indexado para búsqueda semántica hasta que se configure"
        )
    await reindexar_version(config, api_key, id_version, markdown)
    await limpiar_chunks_no_buscables(config, id_documento)


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
        resultado = await guardar_documento(
            config, nombre, tipo_documento, markdown, fecha_documento,
            id_documento_existente, todas_versiones_buscables,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e
    await _reindexar_si_semantico(config, resultado["id_documento"], resultado["id_version"], markdown)
    return resultado


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
    if modo == "fulltext":
        return await VersionesCRUD(config).buscar_fulltext(pregunta, limite)

    api_key = await get_mistral_api_key()
    if not api_key:
        raise ToolError(
            "El modo de búsqueda es 'semantico' pero no hay ninguna clave de API de Mistral "
            "configurada en el panel de administración"
        )
    (embedding_pregunta,) = await generar_embeddings(api_key, [pregunta])
    return await ChunksCRUD(config).buscar_semantico(embedding_pregunta, limite)


@mcp_app.tool()
async def activar_busqueda_semantica_gd() -> dict:
    """Cambia el modo de búsqueda de este proyecto a 'semantico' (de
    'fulltext') e indexa con embeddings todo lo que ya estaba guardado.
    Solo hace falta llamarla una vez, al activar la búsqueda semántica;
    los documentos guardados o corregidos después ya se indexan solos."""
    config = await _config_actual()
    api_key = await get_mistral_api_key()
    if not api_key:
        raise ToolError("No hay ninguna clave de API de Mistral configurada en el panel de administración")

    await ConfiguracionCRUD(config).update(1, {"modo_busqueda": "semantico"})

    versiones_a_indexar = await VersionesCRUD(config).listar_buscables()
    for version in versiones_a_indexar:
        await reindexar_version(config, api_key, version["id"], version["markdown_actual"])

    return {"modo_busqueda": "semantico", "versiones_indexadas": len(versiones_a_indexar)}


@mcp_app.tool()
async def obtener_documento_completo_gd(id_documento: int, id_version: int | None = None) -> dict:
    """Devuelve el markdown completo de un documento (la versión vigente,
    o `id_version` si se indica), para cuando un fragmento de
    consultar_documentos_gd no basta. Usa buscar_documentos_gd antes si no
    conoces el id_documento."""
    config = await _config_actual()
    documento = await DocumentosCRUD(config).obtener(id_documento)
    if not documento:
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    version = await VersionesCRUD(config).obtener_completo(id_documento, id_version)
    if not version:
        raise ToolError(
            f"No hay ninguna versión vigente para el documento {id_documento}"
            if id_version is None
            else f"La versión {id_version} no existe o no pertenece al documento {id_documento}"
        )
    return {
        "id_documento": id_documento,
        "id_version": version["id"],
        "nombre": documento["nombre"],
        "tipo_documento": documento["tipo_documento"],
        "fecha_documento": version["fecha_documento"],
        "vigente": version["vigente"],
        "revisado_manualmente": version["revisado_manualmente"],
        "markdown": version["markdown_actual"],
    }


@mcp_app.tool()
async def corregir_documento_gd(
    id_documento: int, markdown_corregido: str, id_version: int | None = None
) -> dict:
    """Corrige un error de lectura de la IA en un documento ya guardado
    (por ejemplo, un importe o una fecha mal transcritos), sin subir un
    documento nuevo. Usa esta tool solo para arreglar errores de
    conversión, no para registrar cambios reales del propio documento —
    eso es una nueva versión con guardar_documento_gd. Corrige la versión
    vigente por defecto, o `id_version` si se indica. El cliente es
    responsable de confirmar que la corrección es correcta antes de
    llamar a esta tool: no hay revisión posterior de nadie más."""
    config = await _config_actual()
    version = await VersionesCRUD(config).corregir(id_documento, markdown_corregido, id_version)
    if not version:
        raise ToolError(
            f"No hay ninguna versión vigente para el documento {id_documento}"
            if id_version is None
            else f"La versión {id_version} no existe o no pertenece al documento {id_documento}"
        )
    await _reindexar_si_semantico(config, id_documento, version["id"], markdown_corregido)
    return {
        "id_documento": id_documento,
        "id_version": version["id"],
        "markdown": version["markdown_actual"],
        "revisado_manualmente": version["revisado_manualmente"],
    }
