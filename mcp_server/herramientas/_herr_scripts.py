"""Herramientas MCP de gd_scripts — ver docs/gestion-documental.md →
"Scripts reutilizables". Guarda scripts que la IA ya ha escrito para
tareas puntuales del cliente, para poder reaprovecharlos en vez de
volver a escribirlos de cero."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_scripts import ScriptsCRUD


async def _contexto_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


@mcp_app.tool()
async def crear_script_gd(
    titulo: str, descripcion: str, lenguaje: str, codigo: str,
    creado_por: str, etiquetas: str | None = None,
) -> dict:
    """Guarda un script para poder reaprovecharlo más adelante en vez de
    escribirlo de cero cada vez. Antes de crear uno nuevo, consulta
    buscar_scripts_gd para ver si ya hay uno parecido — si lo hay, mejor
    actualizarlo (actualizar_script_gd) o simplemente reusarlo (y avisar
    con marcar_uso_script_gd) que duplicarlo.

    `descripcion`: qué hace y cuándo usarlo — es lo que se lee al buscar,
    así que sé concreto (qué problema resuelve, qué parámetros o
    supuestos tiene).

    `lenguaje`: texto libre (p.ej. "python", "bash", "sql").

    `etiquetas`: palabras clave sueltas separadas por comas, opcional
    (p.ej. "backup, postgres").

    `creado_por`: quién o qué lo generó — pon tu propio nombre de
    asistente si lo escribiste tú."""
    config = await _contexto_actual()
    id_script = await ScriptsCRUD(config).crear({
        "titulo": titulo, "descripcion": descripcion, "lenguaje": lenguaje,
        "codigo": codigo, "etiquetas": etiquetas, "creado_por": creado_por,
    })
    return await ScriptsCRUD(config).obtener(id_script)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def buscar_scripts_gd(
    q: str | None = None, lenguaje: str | None = None, incluir_archivados: bool = False,
) -> list[dict]:
    """Busca scripts ya guardados para reaprovechar, antes de escribir uno
    nuevo. `q` busca por título, descripción o etiquetas (parcial);
    `lenguaje` filtra por lenguaje exacto. Sin ninguno de los dos,
    devuelve todos (hasta 200), con los más usados primero."""
    config = await _contexto_actual()
    return await ScriptsCRUD(config).buscar(q, lenguaje, incluir_archivados)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_script_gd(id_script: int) -> dict:
    """Detalle completo de un script, con su código."""
    config = await _contexto_actual()
    script = await ScriptsCRUD(config).obtener(id_script)
    if not script:
        raise ToolError(f"No existe ningún script con id {id_script}")
    return script


@mcp_app.tool()
async def actualizar_script_gd(
    id_script: int, titulo: str | None = None, descripcion: str | None = None,
    lenguaje: str | None = None, codigo: str | None = None, etiquetas: str | None = None,
) -> dict:
    """Actualiza los campos que se pasen de un script ya existente (los
    que se dejen en blanco no se tocan) — úsalo para corregir o mejorar
    un script guardado en vez de crear uno duplicado."""
    config = await _contexto_actual()
    script = await ScriptsCRUD(config).actualizar_campos(id_script, {
        "titulo": titulo, "descripcion": descripcion, "lenguaje": lenguaje,
        "codigo": codigo, "etiquetas": etiquetas,
    })
    if not script:
        raise ToolError(f"No existe ningún script con id {id_script}")
    return script


@mcp_app.tool()
async def marcar_uso_script_gd(id_script: int) -> dict:
    """Avisa de que se ha reaprovechado este script — incrementa su
    contador de uso y actualiza la fecha del último uso. Llámala cada vez
    que reutilices uno de buscar_scripts_gd en vez de escribirlo de
    nuevo, para saber cuáles compensan tener guardados."""
    config = await _contexto_actual()
    script = await ScriptsCRUD(config).marcar_uso(id_script)
    if not script:
        raise ToolError(f"No existe ningún script con id {id_script}")
    return script


@mcp_app.tool()
async def archivar_script_gd(id_script: int) -> dict:
    """Archiva un script obsoleto: sigue guardado, pero desaparece de
    buscar_scripts_gd hasta desarchivarlo."""
    config = await _contexto_actual()
    script = await ScriptsCRUD(config).archivar(id_script)
    if not script:
        raise ToolError(f"No existe ningún script con id {id_script}")
    return script


@mcp_app.tool()
async def desarchivar_script_gd(id_script: int) -> dict:
    config = await _contexto_actual()
    script = await ScriptsCRUD(config).desarchivar(id_script)
    if not script:
        raise ToolError(f"No existe ningún script con id {id_script}")
    return script
