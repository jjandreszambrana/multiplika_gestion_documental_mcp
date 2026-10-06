"""Herramientas MCP de gestión documental — ver docs/gestion-documental.md
→ "Tools MCP" y "Pipeline de ingesta". El proyecto se resuelve siempre a
partir de la API key autenticada, nunca de un parámetro (ver
guia_nuevo_proyecto.md, paso 6)."""

import base64
import binascii

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp import Context
from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import File, Image
from mcp.shared.exceptions import MCPError
from pydantic import BaseModel, Field, create_model

from ._anotaciones import SOLO_LECTURA, TAGS_GD_ENLAZADA, es_gd_enlazada, origen_enlazada
from ._capacidades_elicitacion import puede_elicitar_formulario
from ..database.ayuda_gd import indice_ayuda, obtener_seccion, texto_seccion
from ..database.modelos._mod_chunks import ChunksCRUD, limpiar_chunks_no_buscables, reindexar_version
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_documentos_pendientes import DocumentosPendientesCRUD
from ..database.modelos._mod_embeddings import generar_embeddings, obtener_api_key
from ..database.modelos._mod_enlaces import UsoEnlacesCRUD, anotar_sin_resultados, consultar_centrales
from ..database.modelos._mod_estilos import EstilosCRUD
from ..database.modelos._mod_registros import RegistrosCRUD
from ..database.modelos._mod_tipos_documento import TiposDocumentoCRUD
from ..database.modelos._mod_versiones import VersionesCRUD, guardar_documento
from ..database.modelos._tipos_archivo import comprobar_tipo_archivo


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


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_ayuda_gd(seccion: str | None = None) -> str:
    """Ayuda para el usuario sobre cómo funciona la Gestión Documental,
    por partes en el mismo orden que el menú del panel — mismo texto que
    la pantalla "Ayuda". Úsala SOLO cuando el usuario pida ayuda o
    pregunte cómo funciona algo, no por iniciativa propia.

    Sin `seccion` devuelve el índice (id, título y resumen de cada parte):
    enséñaselo al usuario y trae la parte que elija. Si ya está claro qué
    le interesa, pide directamente esa `seccion` (p.ej. "documentos",
    "enviar", "registros"). Un id que no existe devuelve también el
    índice."""
    encontrada = obtener_seccion(seccion) if seccion else None
    if encontrada:
        return texto_seccion(encontrada)
    lista = "\n".join(f"- `{s['id']}`: {s['titulo']} — {s['resumen']}" for s in indice_ayuda())
    aviso = f"No hay ninguna sección «{seccion}». " if seccion else ""
    return f"{aviso}Partes de la ayuda (pide una con `seccion`):\n\n{lista}"


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_tipos_documento_gd() -> list[dict]:
    """Tipos de documento ya usados en este proyecto (p.ej. "factura",
    "contrato"...) — no es una lista cerrada, es solo para reutilizar un
    tipo ya existente en vez de crear uno nuevo por una variación del
    nombre (p.ej. "Factura" vs "facturas"). Consúltala antes de preguntar
    el tipo al guardar un documento; si el que hace falta no está,
    guardar_documento_gd lo añade solo la primera vez que se usa.

    Algunos tipos llevan `formato_requerido` y/o `normativa_aplicable`
    (los gestiona el admin del proyecto desde el panel) — si el tipo del
    documento que vas a guardar los tiene, compáralo contra ese texto
    antes de llamar a guardar_documento_gd y pasa lo que no cumpla en su
    parámetro `incumplimientos` (ver esa tool)."""
    config, _ = await _contexto_actual()
    return await TiposDocumentoCRUD(config).listar_nombres()


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_documentos_pendientes_gd() -> list[dict]:
    """Documentos que llegaron sin que nadie estuviera delante (subida
    masiva desde el panel, o un correo recibido) y siguen sin procesar —
    ni tipo, ni nombre, ni nada decidido todavía. Llama a esta tool al
    empezar una conversación para poder avisar al cliente si hay algo en
    cola ("tienes 2 documentos nuevos, ¿los proceso?"). Para leer uno de
    verdad antes de preguntar, usa obtener_documento_pendiente_gd(id)."""
    config, _ = await _contexto_actual()
    return await DocumentosPendientesCRUD(config).listar_metadatos()


@mcp_app.tool(annotations=SOLO_LECTURA)
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


class _DatosDocumento(BaseModel):
    """Datos que decide el cliente al guardar un documento — la IA se los
    pregunta por chat si no los tiene y los pasa como parámetros de
    guardar_documento_gd; el formulario de esta tool solo entra en juego,
    cuando el cliente MCP lo soporta, para completar lo que falte."""

    nombre: str = Field(description="Nombre o referencia corta del documento")
    tipo_documento: str = Field(description='Tipo de documento, p.ej. "factura", "contrato"...')
    fecha_documento: str = Field(description="Fecha del propio documento (no la de hoy), formato AAAA-MM-DD")
    fecha_caducidad: str = Field(
        default="", description="Fecha de caducidad, si aplica (contratos, certificados...) — vacío si no aplica"
    )
    ambito: str = Field(
        default="",
        description='Solo para tipos como normativas: "nacional", "autonómica", "privada"... — vacío si no aplica',
    )
    todas_versiones_buscables: bool = Field(
        default=False, description="¿Debe quedar buscable todo el histórico de este documento, no solo la última versión?"
    )


def _modelo_documento_a_completar(
    nombre: str | None, tipo_documento: str | None, fecha_documento: str | None,
    fecha_caducidad: str | None, ambito: str | None, todas_versiones_buscables: bool,
) -> type[_DatosDocumento]:
    """Mismo formulario que _DatosDocumento, pero con los datos ya
    conocidos puestos como valor por defecto: así el formulario solo
    exige de verdad los que faltan, y los que ya llegaron como parámetro
    no se pierden si el cliente los deja tal cual al enviarlo."""
    conocidos = {
        "nombre": nombre, "tipo_documento": tipo_documento, "fecha_documento": fecha_documento,
        "fecha_caducidad": fecha_caducidad, "ambito": ambito,
        "todas_versiones_buscables": todas_versiones_buscables or None,
    }
    overrides = {
        campo: (_DatosDocumento.model_fields[campo].annotation, valor)
        for campo, valor in conocidos.items() if valor
    }
    return create_model("_DatosDocumentoCompletar", __base__=_DatosDocumento, **overrides)


def _error_faltan_datos_documento(faltan: list[str], pista_tipos: str) -> ToolError:
    return ToolError(
        f"Faltan datos del documento para guardarlo: {', '.join(faltan)}. Pregúntaselos al usuario "
        "por chat (nombre o referencia corta, tipo de documento, fecha del propio documento en "
        "formato AAAA-MM-DD, y si aplica fecha de caducidad y ámbito) y vuelve a llamar a "
        f"guardar_documento_gd con esos datos ya rellenos en sus parámetros.{pista_tipos}"
    )


@mcp_app.tool()
async def guardar_documento_gd(
    markdown: str,
    ctx: Context,
    id_documento_existente: int | None = None,
    id_documento_pendiente: int | None = None,
    url_origen: str | None = None,
    borrador: bool = False,
    incumplimientos: str | None = None,
    nombre: str | None = None,
    tipo_documento: str | None = None,
    fecha_documento: str | None = None,
    fecha_caducidad: str | None = None,
    ambito: str | None = None,
    todas_versiones_buscables: bool = False,
) -> dict:
    """Guarda un documento convertido a markdown. Antes de llamarla, si es
    una versión nueva de un documento ya guardado, confírmalo con
    buscar_documentos_gd (no lo adivines) y pasa su id en
    `id_documento_existente` — si no, se crea un documento nuevo.

    Pásale `nombre`, `tipo_documento` y `fecha_documento` (obligatorios) y,
    si los conoces, `fecha_caducidad`, `ambito` y
    `todas_versiones_buscables` — pregúntaselos al usuario por chat si no
    los tienes. `tipo_documento` debe reutilizar uno ya existente en este
    proyecto (consulta listar_tipos_documento_gd) siempre que el documento
    encaje en alguno; solo escribe uno nuevo si de verdad no hay ninguno
    parecido — no hace falta que coincida letra por letra, mayúsculas,
    tildes o singular/plural no cuentan como un tipo distinto.

    Si al llamarla falta algún obligatorio y el cliente MCP soporta
    formularios (elicitation), esta misma tool le lanza uno para pedir
    solo lo que falte — no hace falta que se lo preguntes tú antes por
    eso. Si el cliente no los soporta, o el formulario falla o el usuario
    lo cierra sin rellenarlo, la tool falla con un aviso listando qué
    falta: pregúntaselo al usuario por chat y vuelve a llamarla con esos
    datos ya en sus parámetros.

    Si `id_documento_existente` se indica, esto es una nueva versión de ese
    documento (la versión anterior deja de ser la vigente).

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
    `id_documento_pendiente`: al guardar con éxito sale solo de la cola, y
    su archivo queda guardado como archivo original de esta versión.
    Si el documento viene de una URL pública (p.ej. una normativa
    publicada en el BOE) que tú mismo has descargado y convertido a
    markdown, pasa esa URL en `url_origen` — queda guardada solo como
    referencia para poder volver a consultarla, no la vuelve a descargar
    esta tool.

    `incumplimientos`: si el tipo de este documento tiene
    `formato_requerido` y/o `normativa_aplicable` (consulta
    listar_tipos_documento_gd antes de guardar), compara el documento
    contra ellos y describe aquí, en tus propias palabras, lo que no
    cumpla (p.ej. "falta el desglose de IVA por tipo impositivo"). Déjalo
    vacío si cumple o su tipo no tiene requisitos definidos. Si más
    adelante se corrige y ya cumple, usa actualizar_incumplimientos_gd
    para dejarlo vacío — no se limpia solo."""
    config, id_proyecto = await _contexto_actual()

    tipos_existentes = [t["nombre"] for t in await TiposDocumentoCRUD(config).listar_nombres()]
    pista_tipos = f" Tipos ya usados en este proyecto: {', '.join(tipos_existentes)} (o escribe uno nuevo)." if tipos_existentes else ""

    faltan = [
        campo for campo, valor in
        [("nombre", nombre), ("tipo_documento", tipo_documento), ("fecha_documento", fecha_documento)]
        if not valor
    ]

    if not faltan:
        datos = _DatosDocumento(
            nombre=nombre, tipo_documento=tipo_documento, fecha_documento=fecha_documento,
            fecha_caducidad=fecha_caducidad or "", ambito=ambito or "",
            todas_versiones_buscables=todas_versiones_buscables,
        )
    elif puede_elicitar_formulario(ctx):
        modelo = _modelo_documento_a_completar(
            nombre, tipo_documento, fecha_documento, fecha_caducidad, ambito, todas_versiones_buscables
        )
        try:
            resultado_form = await ctx.elicit("Faltan datos del documento a guardar." + pista_tipos, response_type=modelo)
        except (ToolError, MCPError) as e:
            raise _error_faltan_datos_documento(faltan, pista_tipos) from e
        if resultado_form.action != "accept":
            raise ToolError("El cliente no ha rellenado los datos del documento — no se ha guardado nada.")
        datos = resultado_form.data
    else:
        raise _error_faltan_datos_documento(faltan, pista_tipos)

    try:
        resultado = await guardar_documento(
            config, datos.nombre, datos.tipo_documento, markdown, datos.fecha_documento,
            id_documento_existente, datos.todas_versiones_buscables,
            datos.fecha_caducidad or None, url_origen, datos.ambito or None,
            borrador, incumplimientos,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e
    await _reindexar_si_semantico(config, id_proyecto, resultado["id_documento"], resultado["id_version"], markdown)
    if id_documento_pendiente is not None:
        pendientes = DocumentosPendientesCRUD(config)
        pendiente = await pendientes.obtener(id_documento_pendiente)
        if pendiente:
            await VersionesCRUD(config).guardar_archivo_original(
                resultado["id_version"], bytes(pendiente["archivo"]),
                pendiente["tipo_mime"] or "application/octet-stream", pendiente["nombre_original"],
            )
            await pendientes.eliminar(id_documento_pendiente)
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
async def actualizar_incumplimientos_gd(
    id_documento: int, incumplimientos: str | None, id_version: int | None = None
) -> dict:
    """Actualiza qué no cumple un documento respecto al formato/normativa
    de su tipo (ver `incumplimientos` en guardar_documento_gd), sin tocar
    su contenido. Úsala tras corregir_documento_gd o guardar_documento_gd
    si eso cambia el cumplimiento, o si simplemente vuelves a evaluarlo:
    pasa `incumplimientos=None` para dejarlo en blanco (ya cumple), o el
    texto actualizado si sigue sin cumplir. Actúa sobre la versión
    vigente por defecto, o `id_version` si se indica."""
    config, _ = await _contexto_actual()
    version = await VersionesCRUD(config).actualizar_incumplimientos(id_documento, incumplimientos, id_version)
    if not version:
        raise ToolError(
            f"No hay ninguna versión vigente para el documento {id_documento}"
            if id_version is None
            else f"La versión {id_version} no existe o no pertenece al documento {id_documento}"
        )
    return {
        "id_documento": id_documento,
        "id_version": version["id"],
        "incumplimientos": version["incumplimientos"],
    }


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_documentos_por_caducar_gd(dias: int = 30) -> list[dict]:
    """Documentos (versión vigente, no archivados) con fecha de caducidad
    dentro de los próximos `dias` días, incluidas las ya vencidas —
    responde si el cliente pregunta "¿qué tengo por caducar?". El aviso
    proactivo por email es independiente de esta tool (ver
    docs/gestion-documental.md → "Fechas de caducidad")."""
    config, _ = await _contexto_actual()
    return await VersionesCRUD(config).listar_por_caducar(dias)


@mcp_app.tool(annotations=SOLO_LECTURA, tags=TAGS_GD_ENLAZADA)
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
    proyecto = await resolver_proyecto_actual()
    return await DocumentosCRUD(get_db_config(proyecto["id"])).buscar(
        referencia, tipo_documento, limite, incluir_archivados, solo_compartidos=es_gd_enlazada(proyecto),
    )


async def _buscar_contenido(config: dict, id_proyecto: int, pregunta: str, limite: int, solo_compartidos: bool) -> list[dict]:
    configuracion = ConfiguracionCRUD(config)
    modo = await configuracion.obtener_modo_busqueda()
    if modo == "fulltext":
        return await VersionesCRUD(config).buscar_fulltext(pregunta, limite, solo_compartidos)

    proveedor_embedding = await configuracion.obtener_proveedor_embedding()
    api_key = await _clave_embedding_o_error(proveedor_embedding, id_proyecto)
    (embedding_pregunta,) = await generar_embeddings(proveedor_embedding, api_key, [pregunta])
    return await ChunksCRUD(config).buscar_semantico(embedding_pregunta, limite, solo_compartidos)


@mcp_app.tool(annotations=SOLO_LECTURA, tags=TAGS_GD_ENLAZADA)
async def consultar_documentos_gd(pregunta: str, limite: int = 5, cadena_gds: list[str] | None = None) -> list[dict]:
    """Responde preguntas del cliente buscando en el contenido de sus
    documentos. Devuelve los fragmentos más relevantes con su documento,
    tipo, fecha e identificadores, para citar la fuente y poder pedir el
    documento completo si un fragmento no basta.

    `cadena_gds` es de uso interno entre gestiones documentales enlazadas
    (ver docs → "GDs enlazadas"): no lo rellenes."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    enlazada = es_gd_enlazada(proyecto)
    resultados = await _buscar_contenido(config, proyecto["id"], pregunta, limite, solo_compartidos=enlazada)
    if not enlazada:
        return resultados

    # Nos pregunta otra GD: se le oculta lo reservado (ya hecho arriba), se
    # apunta el uso, la pregunta sube a nuestras propias centrales si las
    # hay, y si nadie tiene nada queda anotada como pendiente.
    origen = origen_enlazada(proyecto)
    await UsoEnlacesCRUD(config).registrar(origen, "consulta")
    resultados += await consultar_centrales(config, pregunta, limite, cadena_gds)
    if not any("fragmento" in r for r in resultados):
        await anotar_sin_resultados(config, pregunta, origen)
    return resultados


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


@mcp_app.tool(annotations=SOLO_LECTURA, tags=TAGS_GD_ENLAZADA)
async def obtener_documento_completo_gd(id_documento: int, id_version: int | None = None) -> dict:
    """Devuelve el markdown completo de un documento (la versión vigente,
    o `id_version` si se indica), para cuando un fragmento de
    consultar_documentos_gd no basta. Usa buscar_documentos_gd antes si no
    conoces el id_documento."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    documento = await DocumentosCRUD(config).obtener(id_documento)
    # A otra GD un documento reservado se le presenta como inexistente: ni
    # siquiera debe saber que está ahí.
    if not documento or (es_gd_enlazada(proyecto) and documento["reservado"]):
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    if es_gd_enlazada(proyecto):
        await UsoEnlacesCRUD(config).registrar(origen_enlazada(proyecto), "documento_completo")
    estilo = await EstilosCRUD(config).obtener(documento["id_estilo"]) if documento["id_estilo"] else None
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
        "estilo_informe": estilo["nombre_tipo"] if estilo else None,
        "fecha_documento": version["fecha_documento"],
        "vigente": version["vigente"],
        "borrador": version["borrador"],
        "revisado_manualmente": version["revisado_manualmente"],
        "incumplimientos": version["incumplimientos"],
        "url_origen": version["url_origen"],
        "archivo_original_nombre": version["archivo_original_nombre"],
        "markdown": version["markdown_actual"],
    }


LIMITE_BYTES_ARCHIVO_ORIGINAL = 20 * 1024 * 1024


@mcp_app.tool()
async def adjuntar_archivo_original_gd(
    archivo_base64: str, nombre: str, tipo_mime: str = "application/pdf",
    id_documento: int | None = None, id_registro: int | None = None,
) -> dict:
    """Guarda el archivo original tal cual (el PDF, la foto del parte) junto
    a un documento — en su versión vigente — o junto a un registro de datos.
    Indica uno de los dos: `id_documento` o `id_registro`. Si ya tenía uno,
    se sustituye.

    Último recurso: escribir el base64 gasta muchísimos tokens. Lo normal es
    que el archivo entre por la cola de documentos pendientes (el cliente lo
    sube al panel con "Subir documentos", o llega por correo) y se pase su
    `id_documento_pendiente` a guardar_documento_gd, crear_registro_gd o
    corregir_registro_gd, que lo guardan sin que pase por la conversación.

    `archivo_base64`: el contenido del archivo codificado en base64; aquí se
    pasa a binario y se guarda así. Solo viable si tienes el archivo al
    alcance (p.ej. en Claude Code o con ejecución de código). Hasta 20 MB.
    Solo PDF, imágenes, Word o Excel: vídeos, audios y demás se rechazan.
    `nombre`: el nombre de fichero con su extensión, p.ej. "analisis.pdf".

    Es solo para consultar/descargar el original: lo que se busca y lo que
    manda sigue siendo el markdown del documento o los valores del registro."""
    if (id_documento is None) == (id_registro is None):
        raise ToolError("Indica id_documento o id_registro (uno de los dos)")
    nombre = (nombre or "").strip()[:255]
    if not nombre:
        raise ToolError("Indica el nombre del archivo, p.ej. analisis.pdf")
    try:
        contenido = base64.b64decode("".join(archivo_base64.split()), validate=True)
    except binascii.Error as e:
        raise ToolError("archivo_base64 no es base64 válido") from e
    if not contenido:
        raise ToolError("El archivo está vacío")
    if len(contenido) > LIMITE_BYTES_ARCHIVO_ORIGINAL:
        raise ToolError(f"El archivo pesa más de {LIMITE_BYTES_ARCHIVO_ORIGINAL // (1024 * 1024)} MB")

    try:
        comprobar_tipo_archivo(tipo_mime, nombre)
    except ValueError as e:
        raise ToolError(str(e)) from e

    config, _ = await _contexto_actual()
    if id_registro is not None:
        registros = RegistrosCRUD(config)
        if not await registros.obtener(id_registro):
            raise ToolError(f"No existe ningún registro con id {id_registro}")
        await registros.guardar_archivo_original(id_registro, contenido, tipo_mime, nombre)
        return {"id_registro": id_registro, "archivo_original_nombre": nombre, "bytes": len(contenido)}

    version = await VersionesCRUD(config).obtener_vigente(id_documento)
    if not version:
        raise ToolError(f"No hay ninguna versión vigente para el documento {id_documento}")
    await VersionesCRUD(config).guardar_archivo_original(version["id"], contenido, tipo_mime, nombre)
    return {
        "id_documento": id_documento, "id_version": version["id"],
        "archivo_original_nombre": nombre, "bytes": len(contenido),
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
async def marcar_reservado_gd(id_documento: int, reservado: bool = True) -> dict:
    """Marca (o desmarca, con reservado=False) un documento como reservado:
    las gestiones documentales enlazadas a esta no lo verán en sus
    consultas ni podrán pedirlo completo. Para los usuarios de este
    proyecto no cambia nada. Solo tiene sentido si esta GD actúa de
    central para otras (ver listar_enlaces_gd)."""
    config, _ = await _contexto_actual()
    documento = await DocumentosCRUD(config).marcar_reservado(id_documento, reservado)
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
async def eliminar_documento_gd(id_documento: int) -> dict:
    """Borra un documento PARA SIEMPRE, con todas sus versiones, archivo
    original, notas y relaciones (entidades, grupos, scripts, registros).
    No se puede deshacer: confirma antes con el usuario.

    Solo se puede borrar un documento ya archivado (archivar_documento_gd
    primero) y que nunca se haya enviado por correo — si se envió, queda
    archivado como constancia de lo enviado."""
    config, _ = await _contexto_actual()
    resultado = await DocumentosCRUD(config).eliminar_definitivo(id_documento)
    if resultado == "no_existe":
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    if resultado == "no_archivado":
        raise ToolError("Solo se puede borrar un documento archivado: archívalo antes con archivar_documento_gd")
    if resultado == "enviado":
        raise ToolError("Este documento se ha enviado por correo y no se puede borrar: déjalo archivado")
    return {"id": id_documento, "eliminado": True}


@mcp_app.tool(annotations=SOLO_LECTURA)
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
        "incumplimientos": version["incumplimientos"],
    }
