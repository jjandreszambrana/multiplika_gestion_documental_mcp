"""Herramientas MCP del bloc de notas: notas sueltas de los usuarios,
enlazables entre sí, con documentos y con registros de datos — ver
docs/gestion-documental.md → "Bloc de notas".

Quién es "yo": el usuario del chat del panel (ver _quien en
_herr_actividad.py), si no la persona dueña de la API key (columna
id_usuario de mcpc_api_keys), y si no nadie. Sin nadie (una key de
todos), solo existen las notas compartidas con todos y lo que se crea es
para todos."""

from typing import Literal

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ._herr_actividad import _quien, _usuarios
from ..database.dependencias._dep_bloc_notas import COLORES_ES
from ..database.modelos._mod_bloc_notas import (
    actualizar_nota,
    buscar_notas,
    crear_nota,
    desenlazar,
    eliminar_nota,
    enlazar,
    etiquetas_en_uso,
    obtener_nota,
)

Visibilidad = Literal["privada", "personas", "todos"]
TipoEnlace = Literal["nota", "documento", "registro"]
Color = Literal["rojo", "naranja", "amarillo", "verde", "azul", "morado", "rosa", "gris"]


async def _contexto() -> tuple[dict, int, int | None, str]:
    """(config, id_proyecto, id_usuario o None, nombre de quien llama)."""
    proyecto = await resolver_proyecto_actual()
    quien = await _quien(proyecto)
    id_usuario = quien.get("id_usuario") or proyecto.get("id_usuario_api_key")
    nombre = quien["quien"]
    if id_usuario and not quien.get("id_usuario"):
        usuario = await _usuarios.obtener(id_usuario)
        nombre = usuario["nombre"] if usuario else nombre
    return get_db_config(proyecto["id"]), proyecto["id"], id_usuario, nombre


async def _ejecutar(corutina):
    try:
        return await corutina
    except (ValueError, LookupError, PermissionError) as e:
        raise ToolError(str(e)) from e


@mcp_app.tool(annotations=SOLO_LECTURA)
async def buscar_notas_bloc_gd(
    texto: str | None = None,
    etiqueta: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    id_documento: int | None = None,
    id_registro: int | None = None,
    id_nota: int | None = None,
    archivadas: Literal["no", "si", "todas"] = "no",
    solo_mias: bool = False,
    color: Color | None = None,
    limite: int = 30,
) -> list[dict]:
    """Busca en el bloc de notas: lo que los usuarios han apuntado de
    reuniones, llamadas, acuerdos, ideas... Úsala cuando pregunten "¿qué
    apunté sobre X?", "¿qué notas hay de la reunión con Y?" o antes de
    responder algo que pueda estar apuntado ahí.

    Solo salen las notas que puede ver quien pregunta. Todos los filtros
    son opcionales y combinables:
    - `texto`: cada palabra tiene que salir en el título, la descripción,
      el contenido o las etiquetas.
    - `etiqueta`: notas con esa etiqueta (ver listar_etiquetas_bloc_gd).
    - `desde` / `hasta`: AAAA-MM-DD (hasta incluye el día entero), sobre
      la fecha de la nota.
    - `id_documento` / `id_registro` / `id_nota`: notas enlazadas a ese
      documento, registro de datos u otra nota.
    - `archivadas`: "no" (lo normal), "si" o "todas".
    - `solo_mias`: solo las que escribió quien pregunta.
    - `color`: notas con ese distintivo de color.

    En el resultado, `color` va con el nombre interno (red, orange, yellow,
    green, blue, grape = morado, pink, gray).

    El contenido sale recortado (`contenido_recortado`): para leer una
    nota entera usa obtener_nota_bloc_gd. Fijadas primero, luego de la más
    reciente a la más antigua."""
    config, _, id_usuario, _ = await _contexto()
    return await _ejecutar(buscar_notas(
        config, id_usuario, texto, etiqueta, desde, hasta, id_documento, id_registro, id_nota,
        {"no": False, "si": True, "todas": None}[archivadas], solo_mias, limite,
        COLORES_ES[color] if color else None,
    ))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_nota_bloc_gd(id_nota: int) -> dict:
    """Una nota del bloc entera: contenido, etiquetas, con quién se
    comparte, y lo que tiene enlazado (otras notas, documentos, registros
    de datos y sus recordatorios)."""
    config, id_proyecto, id_usuario, _ = await _contexto()
    return await _ejecutar(obtener_nota(config, id_usuario, id_nota, id_proyecto))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_etiquetas_bloc_gd() -> list[dict]:
    """Etiquetas usadas en el bloc de notas, con cuántas notas tiene cada
    una. Úsala antes de etiquetar una nota, para reutilizar las que ya hay
    en vez de inventar otra parecida."""
    config, _, id_usuario, _ = await _contexto()
    return await etiquetas_en_uso(config, id_usuario)


@mcp_app.tool()
async def crear_nota_bloc_gd(
    titulo: str,
    contenido: str | None = None,
    descripcion: str | None = None,
    fecha: str | None = None,
    etiquetas: list[str] | None = None,
    visibilidad: Visibilidad = "todos",
    ids_personas: list[int] | None = None,
    fijada: bool = False,
    color: Color | None = None,
    ids_notas: list[int] | None = None,
    ids_documentos: list[int] | None = None,
    ids_registros: list[int] | None = None,
) -> dict:
    """Escribe una nota en el bloc de notas: "apunta que hemos quedado con
    el proveedor en revisar el precio en enero".

    - `contenido`: el texto, en markdown. `descripcion`: resumen de una
      línea, opcional, que es lo que se lee en los listados.
    - `fecha`: a qué momento se refiere ("AAAA-MM-DD HH:MM", hora de
      Madrid), p.ej. la de la reunión. Por defecto, ahora.
    - `etiquetas`: reutiliza las que ya existen (listar_etiquetas_bloc_gd).
    - `color`: distintivo de color con el que se ve en el panel, opcional.
    - `visibilidad`: "todos" (cualquiera del proyecto, lo normal),
      "privada" (solo quien la escribe) o "personas" (quien la escribe y
      `ids_personas`, ver listar_usuarios_proyecto_gd). Si la conexión no
      sabe quién eres (API key de todos), solo puede ser "todos".
    - `ids_notas` / `ids_documentos` / `ids_registros`: lo que se enlaza
      ya al crearla (también luego con enlazar_nota_bloc_gd).

    Para un recordatorio sobre la nota, crea después un aviso con
    crear_programacion_gd(id_nota_bloc=...)."""
    config, id_proyecto, id_usuario, nombre = await _contexto()
    return await _ejecutar(crear_nota(config, id_proyecto, id_usuario, nombre, {
        "titulo": titulo, "contenido": contenido, "descripcion": descripcion, "fecha": fecha,
        "etiquetas": etiquetas, "visibilidad": visibilidad, "ids_personas": ids_personas, "fijada": fijada,
        "color": COLORES_ES[color] if color else None, "ids_notas": ids_notas, "ids_documentos": ids_documentos, "ids_registros": ids_registros,
    }))


@mcp_app.tool()
async def actualizar_nota_bloc_gd(
    id_nota: int,
    titulo: str | None = None,
    contenido: str | None = None,
    descripcion: str | None = None,
    fecha: str | None = None,
    etiquetas: list[str] | None = None,
    visibilidad: Visibilidad | None = None,
    ids_personas: list[int] | None = None,
    fijada: bool | None = None,
    archivada: bool | None = None,
    color: Color | Literal["ninguno"] | None = None,
) -> dict:
    """Cambia una nota del bloc. Solo cambia lo que pases: `contenido` y
    `etiquetas` sustituyen a los que hubiera (para añadir texto, lee antes
    la nota con obtener_nota_bloc_gd y manda el contenido entero).

    Cualquiera que vea la nota puede cambiarla, pero cambiar con quién se
    comparte (`visibilidad`, `ids_personas`) y archivarla (`archivada`)
    solo quien la escribió. Archivada = fuera de los listados, sin borrarla.
    `color`: distintivo de color; "ninguno" se lo quita."""
    config, id_proyecto, id_usuario, nombre = await _contexto()
    datos = {
        "titulo": titulo, "contenido": contenido, "descripcion": descripcion, "fecha": fecha,
        "etiquetas": etiquetas, "visibilidad": visibilidad, "ids_personas": ids_personas,
        "fijada": fijada, "archivada": archivada,
    }
    datos = {k: v for k, v in datos.items() if v is not None}
    if color:
        datos["color"] = COLORES_ES.get(color)  # "ninguno" → None, lo quita
    return await _ejecutar(actualizar_nota(config, id_proyecto, id_usuario, nombre, id_nota, datos))


@mcp_app.tool()
async def enlazar_nota_bloc_gd(id_nota: int, tipo: TipoEnlace, id_destino: int) -> dict:
    """Enlaza una nota del bloc con otra nota, con un documento o con un
    registro de datos (`tipo` + su id en `id_destino`). El enlace se ve
    desde los dos lados: abriendo el documento salen sus notas."""
    config, id_proyecto, id_usuario, nombre = await _contexto()
    return await _ejecutar(enlazar(config, id_usuario, nombre, id_nota, tipo, id_destino, id_proyecto))


@mcp_app.tool()
async def desenlazar_nota_bloc_gd(id_nota: int, tipo: TipoEnlace, id_destino: int) -> dict:
    """Quita un enlace de una nota del bloc (no borra nada más)."""
    config, id_proyecto, id_usuario, nombre = await _contexto()
    return await _ejecutar(desenlazar(config, id_usuario, nombre, id_nota, tipo, id_destino, id_proyecto))


@mcp_app.tool()
async def eliminar_nota_bloc_gd(id_nota: int) -> dict:
    """Borra para siempre una nota del bloc, con sus enlaces y sus
    recordatorios. Solo quien la escribió. Confirma con el usuario antes:
    si solo quiere quitarla de en medio, mejor archivarla
    (actualizar_nota_bloc_gd con archivada=True)."""
    config, _, id_usuario, _ = await _contexto()
    nota = await _ejecutar(eliminar_nota(config, id_usuario, id_nota))
    return {"eliminada": True, "id": nota["id"], "titulo": nota["titulo"]}
