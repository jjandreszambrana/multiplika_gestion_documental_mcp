"""Herramientas MCP de gd_notas — comentarios, anotaciones,
observaciones, incidencias y sus resoluciones sobre un documento (ver
docs/gestion-documental.md → "Notas de seguimiento"). Cuelgan del
documento, no de una versión: siguen apareciendo enteras con cualquier
versión nueva.

Nada que ver con los registros de datos (gd_registros), que son
anotaciones estructuradas con su propio modelo — estas son texto libre
sobre un documento."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_notas import (
    NotasCRUD,
    NotasRelacionesCRUD,
    crear_nota,
    listar_notas_documento,
    resolver_incidencia,
)


async def _contexto_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


@mcp_app.tool()
async def crear_nota_documento_gd(
    id_documento: int,
    tipo: str,
    texto: str,
    creado_por: str,
    responsable: str | None = None,
    responsable_email: str | None = None,
    id_relacionado: int | None = None,
    tipo_relacion: str | None = None,
) -> dict:
    """Añade un comentario, anotación, observación o incidencia a un
    documento. `tipo` es uno de: comentario, anotacion, observacion,
    incidencia (para resoluciones usa resolver_incidencia_gd, no esto).
    Una incidencia queda abierta automáticamente al crearla.

    `creado_por`: nombre de quien abre la nota. Pregúntaselo al cliente
    por chat si no lo sabes ya por la conversación — no lo inventes ni
    pongas tu propio nombre.

    `responsable`/`responsable_email`: a quién se le asigna, si aplica —
    texto libre, no tiene por qué ser un usuario real del sistema. Si le
    pasas un email, el aviso automático de incidencias abiertas
    (avisar_incidencias.py) le escribe directo a él en vez de al correo
    general del proyecto — pregúntaselo solo si el cliente lo da, no lo
    inventes ni asumas uno a partir del nombre. Puedes dejar los dos
    vacíos y asignarlos luego con asignar_responsable_nota_gd.

    `id_relacionado`/`tipo_relacion`: si esta nota está relacionada con
    otra ya existente de este mismo documento (p.ej. un comentario sobre
    una incidencia), pasa el id de la otra y, si quieres, una etiqueta
    corta para la relación (p.ej. "relacionado", "duplica") — déjalo
    vacío si no aplica.

    La nota queda enganchada al documento (no a la versión actual), así
    que sigue disponible tal cual aunque más adelante se guarde una
    versión nueva."""
    config = await _contexto_actual()
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    try:
        id_nota = await crear_nota(
            config, id_documento, tipo, texto, creado_por,
            responsable=responsable, responsable_email=responsable_email,
            id_relacionado=id_relacionado, tipo_relacion=tipo_relacion,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e
    return await NotasCRUD(config).obtener(id_nota)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_notas_documento_gd(id_documento: int, tipo: str | None = None) -> list[dict]:
    """Comentarios, anotaciones, observaciones, incidencias y
    resoluciones de un documento (todas sus versiones, no solo la
    vigente — una nota no distingue versión). Filtra por `tipo` si solo
    quieres uno de estos: comentario, anotacion, observacion, incidencia,
    resolucion. Cada nota incluye sus relaciones con otras notas, si
    tiene."""
    config = await _contexto_actual()
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    return await listar_notas_documento(config, id_documento, tipo)


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
async def asignar_responsable_nota_gd(
    id_nota: int, responsable: str | None, responsable_email: str | None = None
) -> dict:
    """Asigna (o quita, pasando `responsable=None`) a quién se le
    encarga una nota ya existente — comentario, anotación, observación o
    incidencia. Texto libre, no un usuario del sistema. Si le pasas
    `responsable_email`, el aviso automático de incidencias abiertas le
    escribe directo a él — no lo inventes, solo si el cliente te lo da."""
    config = await _contexto_actual()
    nota = await NotasCRUD(config).actualizar_responsable(id_nota, responsable, responsable_email)
    if not nota:
        raise ToolError(f"No existe ninguna nota con id {id_nota}")
    return nota


@mcp_app.tool()
async def relacionar_notas_gd(id_origen: int, id_destino: int, tipo_relacion: str | None = None) -> dict:
    """Enlaza dos notas ya existentes de un documento (p.ej. "este
    comentario está relacionado con esa incidencia"). `tipo_relacion` es
    una etiqueta libre opcional (p.ej. "relacionado", "duplica") — no uses
    "resuelve", esa la pone solo resolver_incidencia_gd."""
    config = await _contexto_actual()
    notas = NotasCRUD(config)
    if not await notas.obtener(id_origen):
        raise ToolError(f"No existe ninguna nota con id {id_origen}")
    if not await notas.obtener(id_destino):
        raise ToolError(f"No existe ninguna nota con id {id_destino}")
    id_relacion = await NotasRelacionesCRUD(config).crear(id_origen, id_destino, tipo_relacion)
    return await NotasRelacionesCRUD(config).obtener(id_relacion)
