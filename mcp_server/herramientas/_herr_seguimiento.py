"""Herramientas MCP del seguimiento: en qué punto está una nota del bloc,
un documento o una nota de un documento — ver docs/gestion-documental.md
→ "Seguimiento".

Quién es "yo": como en el bloc de notas (ver _contexto en
_herr_bloc_notas.py). Sin nadie (una key de todos), de las notas del bloc
solo existen las de todos."""

from typing import Literal

from apps.mcp_server.core import mcp_app
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ._herr_bloc_notas import _contexto, _ejecutar
from ..database.modelos._mod_seguimiento import _SIN_CAMBIO, cambiar_seguimiento, listar_seguimiento

TipoElemento = Literal["nota_bloc", "documento", "nota_documento"]
Estado = Literal["pendiente", "en_curso", "realizado", "aplazado"]


@mcp_app.tool()
async def cambiar_seguimiento_gd(
    tipo: TipoElemento,
    id: int,
    estado: Estado | Literal["sin_estado"] | None = None,
    id_responsable: int | None = None,
    quitar_responsable: bool = False,
    aplazar_hasta: str | None = None,
) -> dict:
    """Pone el estado de seguimiento de una nota del bloc (`nota_bloc`),
    un documento (`documento`) o una nota de un documento
    (`nota_documento`, las de listar_notas_documento_gd), y/o quién se
    encarga. Sirve para no perder de vista lo que hay que hacer: "marca
    como en curso la revisión del APPCC", "aplaza hasta el lunes lo de
    Envases Sur".

    - `estado`: pendiente, en_curso, realizado o aplazado. "sin_estado"
      lo saca del seguimiento. Sin pasarlo, no cambia.
    - `id_responsable`: el usuario que se encarga (ver
      listar_usuarios_proyecto_gd; no puede ser un invitado).
      `quitar_responsable=True` lo deja sin nadie. Sin pasar ninguno de
      los dos, no cambia.
    - `aplazar_hasta`: obligatorio al aplazar. "AAAA-MM-DD" (a las 9:00)
      o "AAAA-MM-DD HH:MM", hora de Madrid. Se crea un aviso programado
      para ese momento (al responsable, o a quien lo aplaza) y entonces
      vuelve solo a pendiente.

    Cada mañana a las 8:00 le llega a cada persona un resumen con lo
    pendiente y en curso que tiene encargado, más lo que no tiene a nadie."""
    if id_responsable and quitar_responsable:
        raise ToolError("Pasa id_responsable o quitar_responsable, no los dos")
    config, id_proyecto, id_usuario, nombre = await _contexto()
    return await _ejecutar(cambiar_seguimiento(
        config, id_proyecto, id_usuario, nombre, tipo, id,
        estado=_SIN_CAMBIO if estado is None else (None if estado == "sin_estado" else estado),
        id_responsable=None if quitar_responsable else (id_responsable or _SIN_CAMBIO),
        aplazado_hasta=aplazar_hasta,
    ))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_seguimiento_gd(
    estados: list[Estado] | None = None,
    tipo: TipoElemento | None = None,
    id_responsable: int | None = None,
    solo_mios: bool = False,
    sin_responsable: bool = False,
    incluir_archivados: bool = False,
) -> list[dict]:
    """Lo que tiene estado de seguimiento (notas del bloc, documentos y
    notas de documentos): úsala para "¿qué tengo pendiente?", "¿qué hay en
    curso?", "¿qué se aplazó?".

    Filtros opcionales: `estados` (p.ej. ["pendiente", "en_curso"]),
    `tipo`, `id_responsable` (de un usuario), `solo_mios` (de quien
    pregunta), `sin_responsable` (sin nadie encargado). Los archivados no
    salen salvo `incluir_archivados`. Pendiente primero, luego en curso,
    aplazado y realizado."""
    config, id_proyecto, id_usuario, _ = await _contexto()
    if solo_mios:
        if not id_usuario:
            return []
        id_responsable = id_usuario
    return await _ejecutar(listar_seguimiento(
        config, id_proyecto, id_usuario, estados, tipo, id_responsable, sin_responsable, incluir_archivados,
    ))
