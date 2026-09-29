"""Herramientas MCP de programaciones: avisos puntuales o repetidos para
usuarios concretos, enlazables a documentos — ver
docs/gestion-documental.md → "Programaciones y notificaciones".

La API key es del proyecto, no de una persona: con una key normal no se
sabe quién está detrás, así que hay que decir a quién avisar. Desde el
chat del panel sí se sabe (ver _quien en _herr_actividad.py) y, si no se
dice otra cosa, se avisa a esa persona."""

from typing import Literal

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ._herr_actividad import _quien
from ..database.modelos._mod_programaciones import (
    actualizar_programacion,
    cambiar_pausa,
    crear_programacion,
    eliminar_programacion,
    listar_pendientes_hecho,
    listar_programaciones,
    marcar_hecho,
    obtener_programacion,
    usuarios_del_proyecto,
)

TipoRepeticion = Literal["una_vez", "cada_dias", "semanal", "mensual", "anual"]


def _regla(repeticion, fecha, hora, cada_dias, dias_semana, hasta) -> dict:
    return {
        "tipo": repeticion, "fecha": fecha, "hora": hora, "cada_dias": cada_dias,
        "dias_semana": dias_semana or [], "hasta": hasta,
    }


async def _ejecutar(corutina):
    try:
        return await corutina
    except (ValueError, LookupError) as e:
        raise ToolError(str(e)) from e


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_usuarios_proyecto_gd() -> list[dict]:
    """Personas de este proyecto a las que se puede avisar (id y nombre).
    Úsala antes de crear_programacion_gd para elegir destinatarios —
    pregunta al usuario a quién avisar si no lo ha dicho."""
    proyecto = await resolver_proyecto_actual()
    return [{"id": u["id"], "nombre": u["nombre"]} for u in await usuarios_del_proyecto(proyecto["id"])]


@mcp_app.tool()
async def crear_programacion_gd(
    titulo: str,
    repeticion: TipoRepeticion,
    fecha: str,
    hora: str = "09:00",
    ids_usuarios: list[int] | None = None,
    descripcion: str | None = None,
    ids_documentos: list[int] | None = None,
    cada_dias: int | None = None,
    dias_semana: list[int] | None = None,
    hasta: str | None = None,
    avisar_por_email: bool = True,
    requiere_hecho: bool = False,
    max_recordatorios: int | None = None,
    cada_dias_recordatorio: int = 1,
) -> dict:
    """Programa un aviso para una o varias personas del proyecto, una sola
    vez o repetido: "recuérdale a Ana el 15 de octubre que renueve el
    seguro", "cada lunes a las 8:00 avisa de revisar las temperaturas".
    Le llega en las notificaciones del panel y, si `avisar_por_email`, por
    email desde la cuenta de correo del proyecto.

    Cuándo (hora de Madrid):
    - `repeticion`: una_vez | cada_dias | semanal | mensual | anual.
    - `fecha` (AAAA-MM-DD): el día del aviso (una_vez) o desde cuándo se
      repite. En mensual se repite su día del mes (si el mes no lo tiene,
      el último día); en anual, su día y mes.
    - `hora`: "HH:MM", por defecto 09:00.
    - `cada_dias`: solo en cada_dias (1 = todos los días).
    - `dias_semana`: solo en semanal, 1 = lunes … 7 = domingo (vacío = el
      día de la semana de `fecha`).
    - `hasta` (AAAA-MM-DD): último día en que puede avisar, opcional.

    A quién: `ids_usuarios` (de listar_usuarios_proyecto_gd). Si no lo sabes,
    PREGUNTA a quién avisar; no avises a todos por tu cuenta.

    `ids_documentos`: documentos a los que se refiere el aviso (opcional,
    uno o varios).

    Tareas: con `requiere_hecho` el aviso lleva un botón "Hecho" y se
    vuelve a recordar cada `cada_dias_recordatorio` días hasta que alguien
    lo pulse, como mucho `max_recordatorios` veces (vacío = sin límite,
    hasta que se pulse). Pregunta cuántas veces si el usuario no lo dice.

    Confirma con el usuario el resumen (qué, cuándo, a quién) antes de
    crearla, y luego repítele `descripcion_repeticion` y `proxima_ejecucion`."""
    proyecto = await resolver_proyecto_actual()
    quien = await _quien(proyecto)
    if not ids_usuarios:
        if not quien.get("id_usuario"):
            raise ToolError(
                "Falta a quién avisar: pregunta al usuario y pasa sus ids en ids_usuarios "
                "(los tienes en listar_usuarios_proyecto_gd)."
            )
        ids_usuarios = [quien["id_usuario"]]
    return await _ejecutar(crear_programacion(
        get_db_config(proyecto["id"]), proyecto["id"],
        {
            "titulo": titulo, "descripcion": descripcion,
            "regla": _regla(repeticion, fecha, hora, cada_dias, dias_semana, hasta),
            "avisar_por_email": avisar_por_email, "requiere_hecho": requiere_hecho,
            "max_recordatorios": max_recordatorios, "cada_dias_recordatorio": cada_dias_recordatorio,
        },
        ids_usuarios, ids_documentos or [], quien["quien"], quien.get("id_usuario"),
    ))


@mcp_app.tool()
async def actualizar_programacion_gd(
    id_programacion: int,
    titulo: str | None = None,
    descripcion: str | None = None,
    repeticion: TipoRepeticion | None = None,
    fecha: str | None = None,
    hora: str | None = None,
    cada_dias: int | None = None,
    dias_semana: list[int] | None = None,
    hasta: str | None = None,
    ids_usuarios: list[int] | None = None,
    ids_documentos: list[int] | None = None,
    avisar_por_email: bool | None = None,
    requiere_hecho: bool | None = None,
    max_recordatorios: int | None = None,
    quitar_limite_recordatorios: bool = False,
    cada_dias_recordatorio: int | None = None,
) -> dict:
    """Cambia una programación. Solo se toca lo que pases.

    Para cambiar cuándo avisa hay que pasar `repeticion` y `fecha` (y lo
    demás de la repetición que aplique): se reemplaza la regla entera,
    mismos campos que en crear_programacion_gd. `ids_usuarios` e
    `ids_documentos`, si se pasan, sustituyen la lista entera (pasa [] en
    ids_documentos para quitar todos). `quitar_limite_recordatorios=True`
    deja que se recuerde hasta que alguien pulse Hecho."""
    proyecto = await resolver_proyecto_actual()
    datos = {
        "titulo": titulo, "descripcion": descripcion, "avisar_por_email": avisar_por_email,
        "requiere_hecho": requiere_hecho, "cada_dias_recordatorio": cada_dias_recordatorio,
    }
    datos = {k: v for k, v in datos.items() if v is not None}
    if max_recordatorios is not None or quitar_limite_recordatorios:
        datos["max_recordatorios"] = None if quitar_limite_recordatorios else max_recordatorios
    if repeticion or fecha:
        if not (repeticion and fecha):
            raise ToolError("Para cambiar cuándo avisa pasa a la vez `repeticion` y `fecha`")
        datos["regla"] = _regla(repeticion, fecha, hora, cada_dias, dias_semana, hasta)
    return await _ejecutar(actualizar_programacion(
        get_db_config(proyecto["id"]), proyecto["id"], id_programacion, datos, ids_usuarios, ids_documentos,
    ))


@mcp_app.tool()
async def pausar_programacion_gd(id_programacion: int) -> dict:
    """Deja de avisar hasta que se reanude (no se borra)."""
    proyecto = await resolver_proyecto_actual()
    return await _ejecutar(cambiar_pausa(get_db_config(proyecto["id"]), proyecto["id"], id_programacion, True))


@mcp_app.tool()
async def reanudar_programacion_gd(id_programacion: int) -> dict:
    """Vuelve a avisar. Lo que tocaba mientras estuvo pausada no se manda."""
    proyecto = await resolver_proyecto_actual()
    return await _ejecutar(cambiar_pausa(get_db_config(proyecto["id"]), proyecto["id"], id_programacion, False))


@mcp_app.tool()
async def eliminar_programacion_gd(id_programacion: int) -> dict:
    """Borra una programación con su historial y sus notificaciones. Pide
    confirmación al usuario antes; si solo quiere que deje de avisar un
    tiempo, mejor pausar_programacion_gd."""
    proyecto = await resolver_proyecto_actual()
    if not await eliminar_programacion(get_db_config(proyecto["id"]), id_programacion):
        raise ToolError(f"No existe ninguna programación con id {id_programacion}")
    return {"id_programacion": id_programacion, "eliminada": True}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_programaciones_gd(
    estado: Literal["activa", "pausada", "terminada"] | None = None, id_documento: int | None = None,
) -> list[dict]:
    """Avisos programados, con cuándo avisan (`descripcion_repeticion`),
    la próxima vez (`proxima_ejecucion`, hora de Madrid) y a quién.
    Filtros opcionales: estado, o solo los enlazados a un documento."""
    proyecto = await resolver_proyecto_actual()
    return await listar_programaciones(get_db_config(proyecto["id"]), proyecto["id"], estado, id_documento)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_programacion_gd(id_programacion: int) -> dict:
    """Detalle de una programación: documentos, destinatarios y las últimas
    veces que avisó (con a quién llegó y si falló el email)."""
    proyecto = await resolver_proyecto_actual()
    programacion = await obtener_programacion(get_db_config(proyecto["id"]), proyecto["id"], id_programacion)
    if not programacion:
        raise ToolError(f"No existe ninguna programación con id {id_programacion}")
    return programacion


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_avisos_pendientes_gd() -> list[dict]:
    """Avisos que esperan a que alguien pulse "Hecho" (tareas sin cerrar),
    con cuántos recordatorios llevan y cuándo toca el siguiente."""
    proyecto = await resolver_proyecto_actual()
    return await listar_pendientes_hecho(get_db_config(proyecto["id"]))


@mcp_app.tool()
async def marcar_hecho_gd(id_ejecucion: int) -> dict:
    """Marca como hecho un aviso pendiente (su id está en
    listar_avisos_pendientes_gd): deja de recordarse. Hazlo solo cuando el
    usuario te diga que ya está hecho."""
    proyecto = await resolver_proyecto_actual()
    quien = await _quien(proyecto)
    return await _ejecutar(marcar_hecho(get_db_config(proyecto["id"]), id_ejecucion, quien["quien"]))

