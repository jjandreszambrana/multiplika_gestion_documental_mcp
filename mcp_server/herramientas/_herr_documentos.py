"""Herramientas MCP de gestión documental — ver docs/gestion-documental.md
→ "Tools MCP" y "Pipeline de ingesta". El proyecto se resuelve siempre a
partir de la API key autenticada, nunca de un parámetro (ver
guia_nuevo_proyecto.md, paso 6)."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import File, Image

from ..database.ayuda_gd import TEXTO_AYUDA_GD
from ..database.modelos._mod_chunks import ChunksCRUD, limpiar_chunks_no_buscables, reindexar_version
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_documentos_pendientes import DocumentosPendientesCRUD
from ..database.modelos._mod_embeddings import generar_embeddings, obtener_api_key
from ..database.modelos._mod_tipos_documento import TiposDocumentoCRUD
from ..database.modelos._mod_versiones import VersionesCRUD, guardar_documento


async def _contexto_actual() -> tuple[dict, int]:
    """Config de conexión a la base del proyecto + su id — el id hace
    falta para resolver de qué EMPRESA (tenant) tirar la clave de API de
    embeddings, ya que cada una paga y gestiona la suya."""
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"]), proyecto["id"]


async def _clave_embedding_o_error(proveedor_embedding: str, id_proyecto: int) -> str:
    api_key = await obtener_api_key(proveedor_embedding, id_proyecto)
    if not api_key:
        proveedor_legible = proveedor_embedding.split(":", 1)[0].capitalize()
        raise ToolError(
            f"El modo de búsqueda es 'semantico' (proveedor {proveedor_embedding}) pero la empresa "
            f"dueña de este proyecto no tiene configurada ninguna clave de API de {proveedor_legible} "
            f"en el panel de administración"
        )
    return api_key


async def _reindexar_si_semantico(
    config: dict, id_proyecto: int, id_documento: int, id_version: int, markdown: str
) -> None:
    """Tras guardar o corregir una versión: si el modo es semántico,
    recalcula sus chunks (con el proveedor de embedding configurado para
    este cliente) y limpia los de versiones que hayan dejado de ser
    buscables."""
    configuracion = ConfiguracionCRUD(config)
    modo = await configuracion.obtener_modo_busqueda()
    if modo != "semantico":
        return
    proveedor_embedding = await configuracion.obtener_proveedor_embedding()
    api_key = await _clave_embedding_o_error(proveedor_embedding, id_proyecto)
    await reindexar_version(config, proveedor_embedding, api_key, id_version, markdown)
    await limpiar_chunks_no_buscables(config, id_documento)


@mcp_app.tool()
async def obtener_ayuda_gd() -> str:
    """Explicación en lenguaje sencillo de cómo funciona la Gestión
    Documental (guardar, buscar, corregir, archivar, caducidades,
    normativas, el panel web...). Úsala cuando el cliente pregunte cómo
    funciona esto, qué puede hacer, o esté perdido — mismo texto que la
    pantalla "Ayuda" del panel."""
    return TEXTO_AYUDA_GD


@mcp_app.tool()
async def listar_tipos_documento_gd() -> list[dict]:
    """Tipos de documento ya usados en este proyecto (p.ej. "factura",
    "contrato"...) — no es una lista cerrada, es solo para reutilizar un
    tipo ya existente en vez de crear uno nuevo por una variación del
    nombre (p.ej. "Factura" vs "facturas"). Consúltala antes de preguntar
    el tipo al guardar un documento; si el que hace falta no está,
    guardar_documento_gd lo añade solo la primera vez que se usa."""
    config, _ = await _contexto_actual()
    return await TiposDocumentoCRUD(config).listar_nombres()


@mcp_app.tool()
async def listar_documentos_pendientes_gd() -> list[dict]:
    """Documentos que llegaron sin que nadie estuviera delante (subida
    masiva desde el panel, o un correo recibido) y siguen sin procesar —
    ni tipo, ni nombre, ni nada decidido todavía. Llama a esta tool al
    empezar una conversación para poder avisar al cliente si hay algo en
    cola ("tienes 2 documentos nuevos, ¿los proceso?"). Para leer uno de
    verdad antes de preguntar, usa obtener_documento_pendiente_gd(id)."""
    config, _ = await _contexto_actual()
    return await DocumentosPendientesCRUD(config).listar_metadatos()


@mcp_app.tool()
async def obtener_documento_pendiente_gd(id: int) -> list:
    """Devuelve el fichero de un documento pendiente (como imagen o
    archivo nativo de la respuesta) para que puedas leerlo de verdad antes
    de hacerle al cliente las preguntas de siempre (tipo, nombre...). Una
    vez guardado con guardar_documento_gd (pasando este `id` como
    `id_documento_pendiente`), sale solo de esta cola."""
    config, _ = await _contexto_actual()
    pendiente = await DocumentosPendientesCRUD(config).obtener(id)
    if not pendiente:
        raise ToolError(f"No existe ningún documento pendiente con id {id}")

    contenido = bytes(pendiente["archivo"])
    tipo_mime = pendiente["tipo_mime"] or "application/octet-stream"
    subtipo = tipo_mime.split("/", 1)[-1]
    archivo = (
        Image(data=contenido, format=subtipo)
        if tipo_mime.startswith("image/")
        else File(data=contenido, format=subtipo, name=pendiente["nombre_original"])
    )
    return [f'Documento pendiente "{pendiente["nombre_original"]}" (origen: {pendiente["origen"]}):', archivo]


@mcp_app.tool()
async def guardar_documento_gd(
    nombre: str,
    tipo_documento: str,
    markdown: str,
    fecha_documento: str,
    id_documento_existente: int | None = None,
    todas_versiones_buscables: bool = False,
    id_documento_pendiente: int | None = None,
    fecha_caducidad: str | None = None,
    url_origen: str | None = None,
    ambito: str | None = None,
    borrador: bool = False,
) -> dict:
    """Guarda un documento convertido a markdown. Antes de llamarla,
    pregunta siempre al usuario: tipo de documento (consulta antes
    listar_tipos_documento_gd() y sugiere uno de los ya existentes si
    encaja; si no, se puede usar uno nuevo sin darlo de alta antes), nombre
    o referencia corta, si es una versión nueva de un documento ya guardado
    (usa buscar_documentos_gd para confirmar cuál, no lo adivines) o uno
    distinto, la fecha del propio documento (no la de hoy), si tiene fecha
    de caducidad (contratos, certificados...; si no aplica, déjalo vacío),
    y si todo su histórico debe quedar buscable o solo la última versión
    (por defecto solo la última).
    Si `id_documento_existente` se indica, esto es una nueva versión de ese
    documento (la versión anterior deja de ser la vigente); si no, crea un
    documento nuevo.

    `borrador`: pon `True` si el documento está incompleto o el cliente
    todavía no lo da por bueno (p.ej. le faltan páginas, o dice "todavía
    no es la definitiva, ya te la corrijo"). Mientras la versión vigente
    de un documento siga en borrador, cada guardado posterior con el mismo
    `id_documento_existente` SOBRESCRIBE esa misma versión en vez de crear
    una nueva — así las idas y vueltas de un documento sin cerrar no
    ensucian el histórico. Cuando el cliente confirme que ya es la buena,
    o bien llama a esta misma tool una última vez con `borrador=False`
    (guardando el contenido final y cerrándolo en el mismo paso), o bien
    usa `confirmar_documento_gd` si el contenido no cambia y solo hace
    falta darlo por bueno. Una vez confirmada (borrador=False), cualquier
    guardado posterior sobre ese documento vuelve a crear una versión
    nueva de verdad, como con cualquier documento normal. Por defecto
    `False` — no actives esto si el documento ya llega completo y
    correcto.
    Si este documento viene de la cola de pendientes (obtenido con
    obtener_documento_pendiente_gd), pasa su id en
    `id_documento_pendiente`: al guardar con éxito sale solo de la cola.
    Si el documento viene de una URL pública (p.ej. una normativa
    publicada en el BOE) que tú mismo has descargado y convertido a
    markdown, pasa esa URL en `url_origen` — queda guardada solo como
    referencia para poder volver a consultarla, no la vuelve a descargar
    esta tool.
    `ambito` es opcional y solo aplica a algunos tipos de documento (p.ej.
    una normativa: 'nacional', 'autonómica', 'privada'...) — déjalo vacío
    si no aplica. Solo se guarda al crear el documento, no se puede
    cambiar al subir una versión nueva de uno ya existente."""
    config, id_proyecto = await _contexto_actual()
    try:
        resultado = await guardar_documento(
            config, nombre, tipo_documento, markdown, fecha_documento,
            id_documento_existente, todas_versiones_buscables, fecha_caducidad, url_origen, ambito,
            borrador,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e
    await _reindexar_si_semantico(config, id_proyecto, resultado["id_documento"], resultado["id_version"], markdown)
    if id_documento_pendiente is not None:
        await DocumentosPendientesCRUD(config).eliminar(id_documento_pendiente)
    return resultado


@mcp_app.tool()
async def confirmar_documento_gd(id_documento: int, id_version: int | None = None) -> dict:
    """Da por bueno un documento guardado como borrador (ver `borrador`
    en guardar_documento_gd), sin cambiar su contenido: a partir de aquí
    queda fijo en el histórico y cualquier guardado posterior sobre este
    documento crea una versión nueva en vez de seguir sobrescribiendo
    esta. Úsala cuando el cliente confirme que el documento ya es
    correcto y no hace falta volver a subir el contenido para decirlo.
    Confirma la versión vigente por defecto, o `id_version` si se indica.
    No hace nada si la versión ya no era un borrador."""
    config, _ = await _contexto_actual()
    version = await VersionesCRUD(config).confirmar(id_documento, id_version)
    if not version:
        raise ToolError(
            f"No hay ninguna versión vigente para el documento {id_documento}"
            if id_version is None
            else f"La versión {id_version} no existe o no pertenece al documento {id_documento}"
        )
    return {
        "id_documento": id_documento,
        "id_version": version["id"],
        "borrador": version["borrador"],
    }


@mcp_app.tool()
async def listar_documentos_por_caducar_gd(dias: int = 30) -> list[dict]:
    """Documentos (versión vigente, no archivados) con fecha de caducidad
    dentro de los próximos `dias` días, incluidas las ya vencidas —
    responde si el cliente pregunta "¿qué tengo por caducar?". El aviso
    proactivo por email es independiente de esta tool (ver
    docs/gestion-documental.md → "Fechas de caducidad")."""
    config, _ = await _contexto_actual()
    return await VersionesCRUD(config).listar_por_caducar(dias)


@mcp_app.tool()
async def buscar_documentos_gd(
    referencia: str | None = None,
    tipo_documento: str | None = None,
    limite: int = 20,
    incluir_archivados: bool = False,
) -> list[dict]:
    """Busca documentos por nombre/referencia y/o tipo (no por contenido).
    Sirve tanto para consulta exploratoria como para confirmar si un
    documento ya existe antes de guardar una supuesta nueva versión. Por
    defecto no incluye documentos archivados; usa incluir_archivados=True
    para verlos también (por ejemplo, antes de desarchivar uno)."""
    config, _ = await _contexto_actual()
    return await DocumentosCRUD(config).buscar(referencia, tipo_documento, limite, incluir_archivados)


@mcp_app.tool()
async def consultar_documentos_gd(pregunta: str, limite: int = 5) -> list[dict]:
    """Responde preguntas del cliente buscando en el contenido de sus
    documentos. Devuelve los fragmentos más relevantes con su documento,
    tipo, fecha e identificadores, para citar la fuente y poder pedir el
    documento completo si un fragmento no basta."""
    config, id_proyecto = await _contexto_actual()
    configuracion = ConfiguracionCRUD(config)
    modo = await configuracion.obtener_modo_busqueda()
    if modo == "fulltext":
        return await VersionesCRUD(config).buscar_fulltext(pregunta, limite)

    proveedor_embedding = await configuracion.obtener_proveedor_embedding()
    api_key = await _clave_embedding_o_error(proveedor_embedding, id_proyecto)
    (embedding_pregunta,) = await generar_embeddings(proveedor_embedding, api_key, [pregunta])
    return await ChunksCRUD(config).buscar_semantico(embedding_pregunta, limite)


@mcp_app.tool()
async def activar_busqueda_semantica_gd() -> dict:
    """Cambia el modo de búsqueda de este proyecto a 'semantico' (de
    'fulltext') e indexa con embeddings todo lo que ya estaba guardado,
    usando el proveedor de embedding fijado para este cliente al crear su
    base de datos. Solo hace falta llamarla una vez, al activar la
    búsqueda semántica; los documentos guardados o corregidos después ya
    se indexan solos."""
    config, id_proyecto = await _contexto_actual()
    configuracion = ConfiguracionCRUD(config)
    proveedor_embedding = await configuracion.obtener_proveedor_embedding()
    api_key = await _clave_embedding_o_error(proveedor_embedding, id_proyecto)

    await configuracion.update(1, {"modo_busqueda": "semantico"})

    versiones_a_indexar = await VersionesCRUD(config).listar_buscables()
    for version in versiones_a_indexar:
        await reindexar_version(config, proveedor_embedding, api_key, version["id"], version["markdown_actual"])

    return {
        "modo_busqueda": "semantico",
        "proveedor_embedding": proveedor_embedding,
        "versiones_indexadas": len(versiones_a_indexar),
    }


@mcp_app.tool()
async def obtener_documento_completo_gd(id_documento: int, id_version: int | None = None) -> dict:
    """Devuelve el markdown completo de un documento (la versión vigente,
    o `id_version` si se indica), para cuando un fragmento de
    consultar_documentos_gd no basta. Usa buscar_documentos_gd antes si no
    conoces el id_documento."""
    config, _ = await _contexto_actual()
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
        "ambito": documento["ambito"],
        "fecha_documento": version["fecha_documento"],
        "vigente": version["vigente"],
        "borrador": version["borrador"],
        "revisado_manualmente": version["revisado_manualmente"],
        "url_origen": version["url_origen"],
        "markdown": version["markdown_actual"],
    }


@mcp_app.tool()
async def archivar_documento_gd(id_documento: int) -> dict:
    """Archiva un documento que ya no aplica (anulado, subido por error...):
    deja de aparecer en buscar_documentos_gd y consultar_documentos_gd, pero
    no se borra — sigue accesible por id y se puede recuperar con
    desarchivar_documento_gd."""
    config, _ = await _contexto_actual()
    documento = await DocumentosCRUD(config).archivar(id_documento)
    if not documento:
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    return documento


@mcp_app.tool()
async def desarchivar_documento_gd(id_documento: int) -> dict:
    """Recupera un documento archivado: vuelve a aparecer en las búsquedas."""
    config, _ = await _contexto_actual()
    documento = await DocumentosCRUD(config).desarchivar(id_documento)
    if not documento:
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    return documento


@mcp_app.tool()
async def obtener_estado_proyecto_gd() -> dict:
    """Estado actual de este proyecto: cuántos documentos hay guardados y
    cuándo se subió el más reciente (alta de documento o de versión nueva
    — una corrección de una versión ya existente no lo actualiza)."""
    config, _ = await _contexto_actual()
    _, total_documentos = await DocumentosCRUD(config).listar(limit=1)
    ultimas, _ = await VersionesCRUD(config).listar(limit=1, orden="fecha_subida DESC")
    return {
        "total_documentos": total_documentos,
        "ultima_actualizacion": ultimas[0]["fecha_subida"] if ultimas else None,
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
    config, id_proyecto = await _contexto_actual()
    version = await VersionesCRUD(config).corregir(id_documento, markdown_corregido, id_version)
    if not version:
        raise ToolError(
            f"No hay ninguna versión vigente para el documento {id_documento}"
            if id_version is None
            else f"La versión {id_version} no existe o no pertenece al documento {id_documento}"
        )
    await _reindexar_si_semantico(config, id_proyecto, id_documento, version["id"], markdown_corregido)
    return {
        "id_documento": id_documento,
        "id_version": version["id"],
        "markdown": version["markdown_actual"],
        "revisado_manualmente": version["revisado_manualmente"],
        "borrador": version["borrador"],
    }
