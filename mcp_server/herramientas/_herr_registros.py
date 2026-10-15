"""Herramientas MCP de registros de datos y sus modelos — ver
docs/gestion-documental.md → "Registros de datos".

Un registro es un dato que el cliente anota una y otra vez con la misma
forma (una temperatura, un parte de limpieza, un resultado de análisis). No
es un documento ni una nota sobre un documento: es un dato, y por eso tiene
un modelo que dice qué campos lleva y cómo deben ser.

El contexto que necesita la IA para manejarlos vive en estos docstrings:
CUÁNDO usarlos (crear_modelo_registro_gd), CÓMO se construye un modelo y
cómo se rellena un registro. La sección "Registros de datos" de
ayuda_gd.py es para el usuario y solo llega si la pide."""

import json

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import File

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_estilos import EstilosCRUD
from ..database.modelos._mod_pdf import pdf_de_registros, subtitulo_de_filtros
from ..database.modelos._mod_registros_exportar import ORDENES_FIJOS, excel_de_registros, ordenar_registros
from ..database.modelos._mod_registros import (
    LIMITE_REGISTROS,
    ModelosRegistroCRUD,
    RegistrosCRUD,
    RegistrosDocumentosCRUD,
    plantilla_de_valores,
    sin_archivo,
)


async def _config_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


def _con_plantilla(modelo: dict) -> dict:
    """El modelo tal cual, más el esquema ya como objeto y un ejemplo de los
    valores que espera — para no tener que deducir la forma del JSON Schema."""
    esquema = json.loads(modelo["esquema"])
    return {**modelo, "esquema": esquema, "valores_de_ejemplo": plantilla_de_valores(esquema)}


async def _uno(registros: "RegistrosCRUD", id_registro: int) -> dict:
    documentos = await RegistrosDocumentosCRUD(registros.config).documentos_de_registros([id_registro])
    return {**sin_archivo(await registros.obtener(id_registro)), "documentos": documentos.get(id_registro, [])}


async def _comprobar_documentos(config: dict, ids_documento: list[int]) -> None:
    documentos = DocumentosCRUD(config)
    for id_documento in ids_documento:
        if not await documentos.obtener(id_documento):
            raise ToolError(f"No existe ningún documento con id {id_documento}")


async def _adjuntar_pendiente(registros: "RegistrosCRUD", id_registro: int, id_documento_pendiente: int | None) -> None:
    if id_documento_pendiente is None:
        return
    try:
        await registros.adjuntar_pendiente(id_registro, id_documento_pendiente)
    except ValueError as e:
        raise ToolError(f"El registro {id_registro} se ha guardado, pero sin archivo: {e}") from e


async def _modelo_o_error(config: dict, modelo: str | None, id_modelo: int | None, version: int | None = None) -> dict:
    """Resuelve el modelo por nombre (la última versión activa, o la `version`
    que se pida) o por id exacto."""
    modelos = ModelosRegistroCRUD(config)
    if id_modelo is not None:
        fila = await modelos.obtener(id_modelo)
        if not fila:
            raise ToolError(f"No existe ningún modelo de registro con id {id_modelo}")
        return fila
    if not modelo:
        raise ToolError("Dime de qué modelo es el registro: su nombre (modelo) o su id (id_modelo)")
    fila = await modelos.obtener_por_nombre(modelo, version)
    if not fila:
        raise ToolError(
            f'No hay ningún modelo de registro activo llamado "{modelo}" — mira listar_modelos_registro_gd, '
            f"y si de verdad no existe, créalo con crear_modelo_registro_gd"
        )
    return fila


async def _ids_de_la_familia(config: dict, modelo: dict) -> list[int]:
    """Todas las versiones del modelo: un registro anotado con la v1 sigue
    siendo de ese modelo aunque ahora vaya por la v3."""
    versiones = await ModelosRegistroCRUD(config).listar_versiones(modelo["nombre"])
    return [v["id"] for v in versiones] or [modelo["id"]]


# ---------- modelos ----------

@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_modelos_registro_gd(incluir_inactivos: bool = False) -> list[dict]:
    """Qué tipos de registro de datos tiene dado de alta este cliente (la
    última versión de cada uno). Mírala SIEMPRE antes de crear un modelo
    nuevo: si ya hay uno que sirve, se anota en él; si hay uno parecido pero
    incompleto, se le añade una versión, no se duplica."""
    return await ModelosRegistroCRUD(await _config_actual()).listar_modelos(incluir_inactivos)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_modelo_registro_gd(
    modelo: str | None = None, id_modelo: int | None = None, version: int | None = None
) -> dict:
    """El modelo completo: su descripción, su esquema y `valores_de_ejemplo`,
    que es la forma exacta que tiene que tener el JSON de un registro suyo.
    Llámala ANTES de anotar el primer registro de una conversación, y rellena
    los valores calcando esa forma (mismos nombres de campo, mismos tipos).

    Sin `version` te da la vigente, que es en la que hay que anotar."""
    config = await _config_actual()
    return _con_plantilla(await _modelo_o_error(config, modelo, id_modelo, version))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_versiones_modelo_registro_gd(modelo: str) -> list[dict]:
    """La historia completa de un modelo: cada versión, qué cambió en ella
    (`motivo_version`) y cuál está vigente. Es lo que responde "qué forma
    tenía este parte el día que se rellenó"."""
    versiones = await ModelosRegistroCRUD(await _config_actual()).listar_versiones(modelo)
    if not versiones:
        raise ToolError(f'No hay ningún modelo de registro llamado "{modelo}"')
    return [_con_plantilla(v) for v in versiones]


@mcp_app.tool()
async def crear_modelo_registro_gd(
    nombre: str, titulo: str, descripcion: str, esquema: dict, periodicidad: str | None = None,
) -> dict:
    """Da de alta un tipo de registro de datos: qué campos lleva y cómo deben
    ser. Un registro es para datos que se anotan una y otra vez con la misma
    forma (temperaturas de cámaras, parte de limpieza, resultado de un
    análisis) y que luego se filtran o se promedian; un documento con texto
    que interpretar va con guardar_documento_gd, y un comentario sobre un
    documento, con crear_nota_documento_gd. Construye el esquema HABLANDO con el cliente ("¿qué anotas cada vez
    en ese parte?", "¿qué valores puede tomar?", "¿entre qué límites es
    correcto?"), enséñaselo en palabras y confírmalo antes de crearlo — una
    vez tenga registros ya no se podrá tocar, solo versionar.

    `nombre`: corto, sin espacios, como se cita el modelo (p.ej.
    "temperaturas_camaras"). No se repite: si ya existe, va una versión nueva.

    `titulo` y `descripcion`: para una persona. En la descripción, di qué se
    anota, cuándo y quién — es lo que leerás tú la próxima vez.

    `esquema`: un JSON Schema de `"type": "object"`, con un `properties` por
    campo y `required` con los obligatorios. Usa `enum` cuando las opciones
    sean cerradas y `minimum`/`maximum` cuando haya límites: eso es lo que
    después impide anotar un disparate. Pon `"additionalProperties": false`
    para que no se cuelen campos inventados. Pon a cada campo un `title`: es
    la leyenda que ve la persona en el formulario y en los listados en vez
    del nombre técnico del campo. Ejemplo completo:

        {"type": "object",
         "required": ["camara", "temperatura"],
         "additionalProperties": false,
         "properties": {
           "camara": {"type": "string", "title": "Cámara", "enum": ["Cámara 1", "Cámara 2", "Congelador"]},
           "temperatura": {"type": "number", "title": "Temperatura (°C)", "minimum": -30, "maximum": 15},
           "termometro": {"type": "string", "title": "Termómetro usado"}}}

    Al enseñar registros a una persona, usa también esas leyendas, no los
    nombres de los campos.

    Lo que NO va en el esquema, porque ya son columnas del registro: la fecha
    y la hora a la que se refiere, quién lo anota, si es conforme, las
    observaciones, y a qué entidad o documento se refiere.

    `periodicidad`: "diaria", "semanal", "mensual" o "puntual" — opcional, es
    cada cuánto se espera un registro de estos."""
    config = await _config_actual()
    modelos = ModelosRegistroCRUD(config)
    try:
        id_modelo = await modelos.crear({
            "nombre": nombre, "titulo": titulo, "descripcion": descripcion,
            "esquema": esquema, "periodicidad": periodicidad,
        })
    except ValueError as e:
        raise ToolError(str(e)) from e
    return _con_plantilla(await modelos.obtener(id_modelo))


@mcp_app.tool()
async def corregir_modelo_registro_gd(
    id_modelo: int, titulo: str | None = None, descripcion: str | None = None,
    esquema: dict | None = None, periodicidad: str | None = None,
) -> dict:
    """Corrige un modelo que TODAVÍA NO tiene ningún registro (un borrador que
    nadie ha usado). En cuanto tiene el primero, esta tool falla y hay que
    usar nueva_version_modelo_registro_gd — salvo que lo único que cambie
    sean las leyendas (`title`) de los campos del esquema: eso no cambia qué
    se valida y se corrige aquí, sin versión nueva."""
    config = await _config_actual()
    try:
        modelo = await ModelosRegistroCRUD(config).actualizar(id_modelo, {
            "titulo": titulo, "descripcion": descripcion, "esquema": esquema, "periodicidad": periodicidad,
        })
    except ValueError as e:
        raise ToolError(str(e)) from e
    if not modelo:
        raise ToolError(f"No existe ningún modelo de registro con id {id_modelo}")
    return _con_plantilla(modelo)


@mcp_app.tool()
async def nueva_version_modelo_registro_gd(
    id_modelo: int, esquema: dict, motivo: str,
    titulo: str | None = None, descripcion: str | None = None, periodicidad: str | None = None,
) -> dict:
    """Crea la versión siguiente de un modelo que ya tiene registros: es la
    ÚNICA forma de cambiarle el esquema. La versión anterior se retira sola y
    sus registros se quedan como están, apuntando a ella — esa es la
    trazabilidad: se puede saber qué forma tenía el parte cada día.

    `esquema`: el esquema COMPLETO nuevo, no solo lo que cambia.

    `motivo`: qué cambia y por qué, en una frase ("se añade el campo
    termometro porque ahora hay dos"). Obligatorio: es la mitad de la
    trazabilidad. Confirma el cambio con el cliente antes de hacerlo.

    El nombre no se puede cambiar: identifica al modelo a lo largo de todas
    sus versiones."""
    config = await _config_actual()
    try:
        modelo = await ModelosRegistroCRUD(config).nueva_version(
            id_modelo, esquema, motivo,
            {"titulo": titulo, "descripcion": descripcion, "periodicidad": periodicidad},
        )
    except ValueError as e:
        raise ToolError(str(e)) from e
    return _con_plantilla(modelo)


@mcp_app.tool()
async def retirar_modelo_registro_gd(id_modelo: int, activo: bool = False) -> dict:
    """Retira un modelo (o lo vuelve a activar con `activo=True`): deja de
    aceptar registros nuevos, pero los que ya tiene siguen ahí y se siguen
    consultando. No borra nada."""
    modelo = await ModelosRegistroCRUD(await _config_actual()).cambiar_activo(id_modelo, activo)
    if not modelo:
        raise ToolError(f"No existe ningún modelo de registro con id {id_modelo}")
    return _con_plantilla(modelo)


@mcp_app.tool()
async def asignar_estilo_modelo_registro_gd(id_modelo: int, nombre_tipo_estilo: str | None = None) -> dict:
    """Vincula un modelo de registro a un estilo de informe (uno de
    listar_estilos_informe_gd): cuando se impriman sus registros
    (imprimir_registros_gd o el panel), saldrán con las imágenes de ese
    estilo (logo...). Vale para todas las versiones del modelo y no crea
    versión nueva aunque tenga registros. Sin `nombre_tipo_estilo`, lo quita."""
    config = await _config_actual()
    id_estilo = None
    if nombre_tipo_estilo:
        estilo = await EstilosCRUD(config).obtener_por_tipo(nombre_tipo_estilo)
        if not estilo:
            raise ToolError(f'No existe ningún estilo de informe llamado "{nombre_tipo_estilo}"')
        id_estilo = estilo["id"]
    modelo = await ModelosRegistroCRUD(config).asignar_estilo(id_modelo, id_estilo)
    if not modelo:
        raise ToolError(f"No existe ningún modelo de registro con id {id_modelo}")
    return _con_plantilla(modelo)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def imprimir_registros_gd(
    modelo: str | None = None, id_registro: int | None = None, formato: str = "pdf",
    desde: str | None = None, hasta: str | None = None, conforme: bool | None = None,
    orden: str | None = None, descendente: bool = True,
) -> list:
    """Saca en PDF (o en Excel con `formato="xlsx"`) los registros de un
    modelo, o uno solo con `id_registro`. Úsala SIEMPRE que pidan imprimir,
    sacar en PDF o descargar en Excel registros de datos, en vez de
    escribirlos tú en generar_informe_pdf_gd: se monta aquí sin gastar
    tokens y el PDF sale con el estilo de informe vinculado al modelo
    (asignar_estilo_modelo_registro_gd).

    Filtros como listar_registros_gd (`desde`/`hasta` AAAA-MM-DD,
    `conforme`). `orden`: "fecha" (por defecto), "conforme", "creado_por" o
    el nombre de un campo del esquema; `descendente=False` para de menor a
    mayor. Un solo registro sale como ficha; varios, como tabla."""
    config = await _config_actual()
    registros = RegistrosCRUD(config)
    if id_registro is not None:
        fila = await registros.obtener(id_registro)
        if not fila:
            raise ToolError(f"No existe ningún registro con id {id_registro}")
        vigente = await ModelosRegistroCRUD(config).obtener(fila["id_modelo"])
        filas = [sin_archivo(fila)]
        subtitulo = ""
    else:
        vigente = await _modelo_o_error(config, modelo, None)
        if orden and orden not in ORDENES_FIJOS and orden not in (json.loads(vigente["esquema"]).get("properties") or {}):
            raise ToolError(f'No se puede ordenar por "{orden}": usa {", ".join(ORDENES_FIJOS)} o un campo del modelo')
        filas = ordenar_registros(
            await registros.buscar(await _ids_de_la_familia(config, vigente), desde, hasta, None, conforme, None, 5000),
            orden, descendente,
        )
        subtitulo = subtitulo_de_filtros(desde, hasta, conforme, len(filas))

    if formato == "xlsx":
        nombre = f"{vigente['titulo']}.xlsx"
        return [f'Excel "{nombre}" con {len(filas)} registros.', File(data=excel_de_registros(vigente, filas), format="vnd.openxmlformats-officedocument.spreadsheetml.sheet", name=nombre)]
    try:
        pdf_bytes = await pdf_de_registros(config, vigente, filas, subtitulo)
    except RuntimeError as e:
        raise ToolError(str(e)) from e
    nombre = f"{vigente['titulo']}.pdf"
    return [f'PDF "{nombre}" con {len(filas)} registros.', File(data=pdf_bytes, format="pdf", name=nombre)]


# ---------- registros ----------

@mcp_app.tool()
async def crear_registro_gd(
    valores: dict, fecha: str, creado_por: str,
    modelo: str | None = None, id_modelo: int | None = None,
    hora: str | None = None, conforme: bool | None = None, observaciones: str | None = None,
    id_entidad: int | None = None, id_documentos: list[int] | None = None,
    id_documento_pendiente: int | None = None,
) -> dict:
    """Anota un registro de datos. Antes de llamarla, mira el modelo con
    obtener_modelo_registro_gd y calca la forma de `valores_de_ejemplo`: si
    los valores no encajan con el esquema, el registro NO se guarda y te dice
    qué campo falla. No inventes un valor que el cliente no te haya dado; si
    falta un campo obligatorio, pregúntaselo.

    `modelo`: el nombre del modelo (se usa su versión vigente). O `id_modelo`
    si quieres una versión concreta, que solo tiene sentido al corregir
    historia vieja.

    `valores`: solo los campos del esquema, en JSON.

    `fecha` (AAAA-MM-DD) y `hora` (HH:MM, opcional): el momento AL QUE SE
    REFIERE el registro, no cuándo lo anotas — un parte de ayer se puede
    anotar hoy. Si el cliente no lo dice y se entiende que es ahora, usa hoy.

    `creado_por`: quién lo anota. Pregúntaselo si no lo sabes ya por la
    conversación; no pongas tu propio nombre.

    `conforme`: True/False si este registro es una comprobación y sabes si
    está dentro de lo debido (p.ej. la temperatura está dentro del límite).
    Déjalo vacío si el modelo no va de cumplir o no se puede saber.

    `observaciones`: la desviación y qué se hizo, en palabras, si la hay.

    `id_entidad`: a qué entidad se refiere (el proveedor, el local, el
    equipo), si aplica.

    `id_documentos`: los documentos de la gestión documental que respaldan
    este registro, si los hay (el certificado de calibración del termómetro,
    el informe del laboratorio...). Se pueden añadir o quitar después con
    vincular_documento_registro_gd / desvincular_documento_registro_gd.

    `id_documento_pendiente`: si el archivo del que salen los datos (la foto
    del parte, el PDF del análisis) está en la cola de documentos pendientes
    (subido al panel con "Subir documentos", o guardado desde un correo con
    guardar_adjunto_correo_gd), pasa su id: queda como archivo original del
    registro y sale de la cola. Es la forma de guardar el archivo — no lo
    mandes en base64 con adjuntar_archivo_original_gd, que gasta muchísimo.
    Si el cliente te lo adjunta en el chat, pídele que lo suba al panel."""
    config = await _config_actual()
    fila_modelo = await _modelo_o_error(config, modelo, id_modelo)
    await _comprobar_documentos(config, id_documentos or [])
    registros = RegistrosCRUD(config)
    try:
        id_registro = await registros.crear(fila_modelo, {
            "valores": valores, "fecha": fecha, "hora": hora, "creado_por": creado_por,
            "conforme": conforme, "observaciones": observaciones, "id_entidad": id_entidad,
        })
    except ValueError as e:
        raise ToolError(str(e)) from e
    vinculos = RegistrosDocumentosCRUD(config)
    for id_documento in id_documentos or []:
        await vinculos.vincular(id_registro, id_documento)
    await _adjuntar_pendiente(registros, id_registro, id_documento_pendiente)
    return await _uno(registros, id_registro)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_registros_gd(
    modelo: str | None = None, desde: str | None = None, hasta: str | None = None,
    id_entidad: int | None = None, conforme: bool | None = None,
    filtros: dict | None = None, limite: int = 100, id_documento: int | None = None,
) -> list[dict]:
    """Los registros anotados que encajan con lo que pidas, del más reciente
    al más antiguo. Cada uno trae sus `valores` ya como objeto, más el nombre
    y la versión del modelo con el que se anotó.

    `modelo`: el nombre — incluye los registros de TODAS sus versiones, que
    es lo que se espera al preguntar por el histórico.

    `desde`/`hasta` (AAAA-MM-DD): por la fecha a la que se refiere el
    registro, no por cuándo se anotó.

    `conforme=False` es la pregunta útil de casi cualquier auditoría: qué se
    salió de lo debido.

    `filtros`: para buscar por un campo de dentro del JSON, en pares campo y
    valor, p.ej. {"camara": "Cámara 2"}. Compara como texto.

    `id_documento`: solo los registros vinculados a ese documento. Cada
    registro trae en `documentos` los que tiene vinculados.

    Si vas a hacer una media o buscar el máximo de un campo, usa mejor
    resumir_registros_gd: no te traes cientos de registros para eso."""
    config = await _config_actual()
    ids = None
    if modelo:
        ids = await _ids_de_la_familia(config, await _modelo_o_error(config, modelo, None))
    return await RegistrosCRUD(config).buscar(
        ids, desde, hasta, id_entidad, conforme, filtros, min(limite, LIMITE_REGISTROS), id_documento,
    )


@mcp_app.tool(annotations=SOLO_LECTURA)
async def resumir_registros_gd(
    modelo: str, campo: str, desde: str | None = None, hasta: str | None = None
) -> dict:
    """Cuántos registros hay y el mínimo, el máximo y la media de un campo
    numérico suyo, en el periodo que digas — sin traerse los registros uno a
    uno. `campo` es un campo del esquema del modelo (p.ej. "temperatura").
    Cuenta todas las versiones del modelo."""
    config = await _config_actual()
    fila_modelo = await _modelo_o_error(config, modelo, None)
    return await RegistrosCRUD(config).resumen(
        await _ids_de_la_familia(config, fila_modelo), campo, desde, hasta
    )


@mcp_app.tool()
async def corregir_registro_gd(
    id_registro: int, valores: dict | None = None, fecha: str | None = None, hora: str | None = None,
    conforme: bool | None = None, observaciones: str | None = None,
    id_entidad: int | None = None, id_documento_pendiente: int | None = None,
) -> dict:
    """Corrige un registro mal anotado (los campos que no pases no se tocan).
    Si cambias los `valores`, se validan contra el esquema de LA VERSIÓN con
    la que se anotó, no contra la vigente. Un registro no puede cambiar de
    modelo: eso sería otro registro.

    `id_documento_pendiente`: pone (o sustituye) el archivo original del
    registro con el de ese documento pendiente, igual que en
    crear_registro_gd. Los documentos vinculados se cambian con
    vincular_documento_registro_gd / desvincular_documento_registro_gd."""
    config = await _config_actual()
    registros = RegistrosCRUD(config)
    fila = await registros.obtener(id_registro)
    if not fila:
        raise ToolError(f"No existe ningún registro con id {id_registro}")
    modelo = await ModelosRegistroCRUD(config).obtener(fila["id_modelo"])
    try:
        await registros.corregir(id_registro, modelo, {
            "valores": valores, "fecha": fecha, "hora": hora, "conforme": conforme,
            "observaciones": observaciones, "id_entidad": id_entidad,
        })
    except ValueError as e:
        raise ToolError(str(e)) from e
    await _adjuntar_pendiente(registros, id_registro, id_documento_pendiente)
    return await _uno(registros, id_registro)


@mcp_app.tool()
async def eliminar_registro_gd(id_registro: int) -> dict:
    """Borra un registro para siempre — solo para uno anotado por error. Si el
    dato estaba mal, mejor corregir_registro_gd, que deja el registro donde
    estaba."""
    registros = RegistrosCRUD(await _config_actual())
    if not await registros.obtener(id_registro):
        raise ToolError(f"No existe ningún registro con id {id_registro}")
    await registros.eliminar(id_registro)
    return {"id": id_registro, "eliminado": True}


@mcp_app.tool()
async def vincular_documento_registro_gd(id_registro: int, id_documento: int) -> dict:
    """Vincula un documento de la gestión documental a un registro de datos
    (p.ej. el certificado de calibración del termómetro al parte de
    temperaturas). Un registro puede tener varios documentos y un documento
    estar en varios registros. No falla si ya estaban vinculados."""
    config = await _config_actual()
    registros = RegistrosCRUD(config)
    if not await registros.obtener(id_registro):
        raise ToolError(f"No existe ningún registro con id {id_registro}")
    await _comprobar_documentos(config, [id_documento])
    await RegistrosDocumentosCRUD(config).vincular(id_registro, id_documento)
    return await _uno(registros, id_registro)


@mcp_app.tool()
async def desvincular_documento_registro_gd(id_registro: int, id_documento: int) -> dict:
    """Quita el vínculo entre un documento y un registro — no se borra
    ninguno de los dos."""
    config = await _config_actual()
    registros = RegistrosCRUD(config)
    if not await registros.obtener(id_registro):
        raise ToolError(f"No existe ningún registro con id {id_registro}")
    estaba = await RegistrosDocumentosCRUD(config).desvincular(id_registro, id_documento)
    return {**await _uno(registros, id_registro), "estaba_vinculado": estaba}
