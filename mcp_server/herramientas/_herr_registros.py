"""Herramientas MCP de gd_registros — comentarios, anotaciones,
observaciones, incidencias y sus resoluciones sobre un documento (ver
docs/gestion-documental.md → "Registros de seguimiento"). Cuelgan del
documento, no de una versión: siguen apareciendo enteros con cualquier
versión nueva."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ..database.dependencias._dep_registros import TIPOS_REGISTRO_CREABLES
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_registros import (
    RegistrosCRUD,
    RegistrosRelacionesCRUD,
    crear_registro,
    listar_registros_documento,
    resolver_incidencia,
)


async def _contexto_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


@mcp_app.tool()
async def crear_registro_documento_gd(
    id_documento: int,
    tipo: str,
    texto: str,
    creado_por: str,
    responsable: str | None = None,
    id_relacionado: int | None = None,
    tipo_relacion: str | None = None,
) -> dict:
    """Añade un comentario, anotación, observación o incidencia a un
    documento. `tipo` es uno de: comentario, anotacion, observacion,
    incidencia (para resoluciones usa resolver_incidencia_gd, no esto).
    Una incidencia queda abierta automáticamente al crearla.

    `creado_por`: nombre de quien abre el registro. Pregúntaselo al
    cliente por chat si no lo sabes ya por la conversación — no lo
    inventes ni pongas tu propio nombre.

    `responsable`: a quién se le asigna, si aplica — texto libre (no
    tiene por qué ser un usuario real del sistema), puedes dejarlo vacío
    y asignarlo luego con asignar_responsable_registro_gd.

    `id_relacionado`/`tipo_relacion`: si este registro está relacionado
    con otro ya existente de este mismo documento (p.ej. un comentario
    sobre una incidencia), pasa el id del otro y, si quieres, una
    etiqueta corta para la relación (p.ej. "relacionado", "duplica") —
    déjalo vacío si no aplica.

    El registro queda enganchado al documento (no a la versión actual),
    así que sigue disponible tal cual aunque más adelante se guarde una
    versión nueva."""
    config = await _contexto_actual()
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    try:
        id_registro = await crear_registro(
            config, id_documento, tipo, texto, creado_por,
            responsable=responsable, id_relacionado=id_relacionado, tipo_relacion=tipo_relacion,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e
    return await RegistrosCRUD(config).obtener(id_registro)


@mcp_app.tool()
async def listar_registros_documento_gd(id_documento: int, tipo: str | None = None) -> list[dict]:
    """Comentarios, anotaciones, observaciones, incidencias y
    resoluciones de un documento (todas sus versiones, no solo la
    vigente — un registro no distingue versión). Filtra por `tipo` si
    solo quieres uno de estos: comentario, anotacion, observacion,
    incidencia, resolucion. Cada registro incluye sus relaciones con
    otros registros, si tiene."""
    config = await _contexto_actual()
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    return await listar_registros_documento(config, id_documento, tipo)


@mcp_app.tool()
async def resolver_incidencia_gd(id_incidencia: int, texto_resolucion: str, creado_por: str) -> dict:
    """Cierra una incidencia abierta: crea su resolución (con el texto
    que le pases), la enlaza con la incidencia y la marca como resuelta,
    todo en un solo paso. `creado_por` es quien resuelve — pregúntaselo
    si no lo sabes ya. Falla si el id no es una incidencia o ya está
    resuelta."""
    config = await _contexto_actual()
    try:
        return await resolver_incidencia(config, id_incidencia, texto_resolucion, creado_por)
    except ValueError as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def asignar_responsable_registro_gd(id_registro: int, responsable: str | None) -> dict:
    """Asigna (o quita, pasando `responsable=None`) a quién se le
    encarga un registro ya existente — comentario, anotación,
    observación o incidencia. Texto libre, no un usuario del sistema."""
    config = await _contexto_actual()
    registro = await RegistrosCRUD(config).actualizar_responsable(id_registro, responsable)
    if not registro:
        raise ToolError(f"No existe ningún registro con id {id_registro}")
    return registro


@mcp_app.tool()
async def relacionar_registros_gd(id_origen: int, id_destino: int, tipo_relacion: str | None = None) -> dict:
    """Enlaza dos registros ya existentes de un documento (p.ej. "este
    comentario está relacionado con esa incidencia"). `tipo_relacion` es
    una etiqueta libre opcional (p.ej. "relacionado", "duplica") — no uses
    "resuelve", esa la pone solo resolver_incidencia_gd."""
    config = await _contexto_actual()
    registros = RegistrosCRUD(config)
    if not await registros.obtener(id_origen):
        raise ToolError(f"No existe ningún registro con id {id_origen}")
    if not await registros.obtener(id_destino):
        raise ToolError(f"No existe ningún registro con id {id_destino}")
    id_relacion = await RegistrosRelacionesCRUD(config).crear(id_origen, id_destino, tipo_relacion)
    return await RegistrosRelacionesCRUD(config).obtener(id_relacion)
