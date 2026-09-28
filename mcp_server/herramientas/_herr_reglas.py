"""Herramientas MCP de reglas de comportamiento — ver
docs/gestion-documental.md → "Reglas de comportamiento". Las reglas dicen
cómo tiene que actuar la IA en esta GD; no son contenido, así que no viven
en los documentos.

Tres niveles de carga:
1. Las globales entran solas en el contexto al abrir sesión (el middleware
   del núcleo llama a `obtener_reglas_globales_gd`, ver
   apps/mcp_server/core/instrucciones_iniciales.py).
2. El resto se pide con `obtener_reglas_gd` justo antes de la tarea que las
   necesita — por categoría, o por nombre cuando una regla global remita a
   otras por el suyo. Así solo cuestan tokens cuando vienen a cuento.
3. La regla meta (`REGLA_META`) va siempre dentro del bloque global y es la
   que le dice a la IA que existe el nivel 2."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA, TAGS_GD_ENLAZADA, es_gd_enlazada
from ..database.modelos._mod_reglas import ReglasCRUD, reglas_con_heredadas, texto_reglas_globales


async def _config_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_reglas_globales_gd() -> str:
    """Las reglas que valen para cualquier tarea de esta gestión documental,
    ya en tu contexto desde que abriste la sesión — solo hace falta llamarla
    si necesitas repasarlas. Para las de una tarea concreta,
    obtener_reglas_gd(categoria)."""
    proyecto = await resolver_proyecto_actual()
    # El middleware del núcleo llama a esta tool en el `initialize` de
    # CUALQUIER key, también la de una GD enlazada (ahí no se aplica la lista
    # blanca de tags) — y estas reglas incluyen las reservadas. Lo que hereda
    # una GD enlazada sale solo por obtener_reglas_compartidas_gd, filtrado.
    if es_gd_enlazada(proyecto):
        return ""
    return await texto_reglas_globales(get_db_config(proyecto["id"]))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_reglas_gd(categoria: str | None = None, nombres: list[str] | None = None) -> list[dict]:
    """Reglas que debes cumplir en esta gestión documental. Llámala ANTES de
    empezar una tarea especializada, de una de estas dos formas:

    - `nombres`: cuando una regla que ya tienes te remita a otras por su
      nombre (p.ej. su texto dice "carga boletines_replicas") — pásalos todos
      juntos en una sola llamada.
    - `categoria`: cuando vayas por el tipo de tarea (p.ej. "boletines" antes
      de redactar un boletín) — listar_reglas_gd te dice qué categorías hay.

    Sin ninguna de las dos devuelve todas las activas.

    Vienen primero las de esta GD (`ambito` propia) y después las heredadas
    de las GDs centrales enlazadas (`ambito` heredada, con `origen`): si dos
    se contradicen, manda la propia."""
    return await reglas_con_heredadas(await _config_actual(), categoria, nombres=nombres)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_reglas_gd(categoria: str | None = None, incluir_inactivas: bool = False) -> list[dict]:
    """Reglas propias de esta GD para gestionarlas (no para cumplirlas — eso
    es obtener_reglas_gd): con su nombre, su categoría, si es global, su
    prioridad y si está activa o reservada. Úsala para ver qué nombres y
    categorías existen antes de crear una regla nueva (los nombres no se
    repiten), y para no duplicar una que ya está escrita."""
    return await ReglasCRUD(await _config_actual()).listar_reglas(
        categoria, incluir_inactivas=incluir_inactivas,
    )


@mcp_app.tool()
async def crear_regla_gd(
    nombre: str, texto: str, categoria: str, es_global: bool = False,
    prioridad: int = 0, reservada: bool = False,
) -> dict:
    """Guarda una instrucción de comportamiento para esta gestión documental
    (cómo trabajar aquí), no un documento. Confirma con el cliente el texto
    antes de crearla, y consulta listar_reglas_gd para reutilizar una
    categoría existente en vez de inventar una variante del mismo nombre.

    `nombre`: obligatorio y sin repetir, corto y descriptivo (p.ej.
    "boletines_replicas"). Es como se localiza esta regla: el texto de una
    regla global puede remitir a ella por su nombre, y entonces se carga con
    obtener_reglas_gd(nombres=["boletines_replicas"]).

    `texto`: una sola idea, en una o dos frases — cuanto más corta, menos
    cuesta cada sesión.

    `categoria`: texto libre que agrupa reglas por tarea ("datos_empresa",
    "boletines", "correo", "estilo", "facturacion"...).

    `es_global`: True solo si hace falta en casi cualquier tarea, porque se
    inyecta en todas las sesiones (p.ej. "el correo de contacto es X" sí;
    "los boletines llevan n=5 réplicas" no, esa se carga por categoría).

    `prioridad`: número mayor = se le presenta antes dentro de su categoría.

    `reservada`: True para que no se comparta con las GDs enlazadas que
    consultan a esta (igual que un documento reservado)."""
    config = await _config_actual()
    reglas = ReglasCRUD(config)
    try:
        id_regla = await reglas.crear({
            "nombre": nombre, "texto": texto, "categoria": categoria, "es_global": es_global,
            "prioridad": prioridad, "reservada": reservada,
        })
    except ValueError as e:
        raise ToolError(str(e))
    return await reglas.obtener(id_regla)


@mcp_app.tool()
async def actualizar_regla_gd(
    id_regla: int, nombre: str | None = None, texto: str | None = None,
    categoria: str | None = None, es_global: bool | None = None, prioridad: int | None = None,
    activa: bool | None = None, reservada: bool | None = None,
) -> dict:
    """Cambia los campos que se pasen de una regla ya existente (los que se
    dejen en blanco no se tocan). `activa=False` la retira sin borrarla. Se
    puede renombrar, pero si otra regla remite a ella por el nombre viejo en su
    texto, hay que cambiarlo también ahí."""
    try:
        regla = await ReglasCRUD(await _config_actual()).actualizar_campos(id_regla, {
            "nombre": nombre, "texto": texto, "categoria": categoria, "es_global": es_global,
            "prioridad": prioridad, "activa": activa, "reservada": reservada,
        })
    except ValueError as e:
        raise ToolError(str(e))
    if not regla:
        raise ToolError(f"No existe ninguna regla con id {id_regla}")
    return regla


@mcp_app.tool()
async def eliminar_regla_gd(id_regla: int) -> dict:
    """Borra una regla para siempre. Si solo quieres dejar de aplicarla,
    mejor actualizar_regla_gd(id_regla, activa=False)."""
    reglas = ReglasCRUD(await _config_actual())
    if not await reglas.obtener(id_regla):
        raise ToolError(f"No existe ninguna regla con id {id_regla}")
    await reglas.eliminar(id_regla)
    return {"id": id_regla, "eliminada": True}


# ---------- para otra GD que nos llama con key gd_enlazada ----------

@mcp_app.tool(annotations=SOLO_LECTURA, tags=TAGS_GD_ENLAZADA)
async def obtener_reglas_compartidas_gd(
    categoria: str | None = None, solo_globales: bool = False, nombres: list[str] | None = None,
) -> list[dict]:
    """Uso interno entre gestiones documentales: las reglas de esta GD que
    una GD enlazada hereda (activas y no reservadas, solo las propias — no
    las que esta GD hereda a su vez). La llama el servidor de la otra GD, no
    una persona."""
    return await ReglasCRUD(await _config_actual()).listar_reglas(
        categoria, solo_globales=solo_globales, solo_compartidas=True, nombres=nombres,
    )
