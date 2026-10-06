"""Herramientas MCP de bases de datos (fase 4 de webs y redes) — ver
docs/gestion-documental.md → "Webs y redes sociales". La lógica y los frenos
están en database/modelos/_mod_bases_datos.py. Los cambios no van por aquí:
se proponen con proponer_cambio_web_gd (bd_actualizar, bd_insertar,
bd_borrar), con su vista previa, su aprobación y su deshacer.

Las de consulta van marcadas de solo lectura (la base de datos además las
ejecuta en una transacción de solo lectura) y rechazan claves de invitado."""

from fastmcp.exceptions import ToolError

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from apps.mcp_server.core.dependencias.auth import clave_actual_es_solo_lectura
from database.config_db import get_db_config

from ._anotaciones import SOLO_LECTURA
from ..database.modelos import _mod_bases_datos as bd


async def _contexto() -> tuple[dict, str]:
    if clave_actual_es_solo_lectura():
        raise ToolError("Las webs, redes y bases de datos no están disponibles para claves de invitado.")
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"]), proyecto.get("nombre_api_key") or "IA"


@mcp_app.tool(annotations=SOLO_LECTURA)
async def esquema_bd_gd(id_activo: int) -> list[dict]:
    """Las tablas de una base de datos de la empresa, con sus columnas, cuál
    es la clave primaria y cuántas filas tienen (aprox.). Míralo antes de
    escribir una consulta, para no inventar nombres."""
    config, _ = await _contexto()
    try:
        return await bd.esquema(config, id_activo)
    except (ValueError, bd.BaseDatosError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def consultar_bd_gd(id_activo: int, sql: str, limite: int = 200) -> dict:
    """Una consulta de LECTURA (SELECT) a una base de datos de la empresa,
    p.ej. "pedidos de septiembre por provincia". Una sola sentencia; se
    corta a los 30 segundos y a `limite` filas (máx. 1000). Cualquier
    intento de cambiar datos se rechaza. Responde al usuario con el
    resultado en palabras normales (y una tabla si ayuda), no con el SQL.
    Si es una pregunta que se repetirá, ofrécele guardarla
    (guardar_consulta_bd_gd) para ejecutarla él con un botón."""
    config, _ = await _contexto()
    try:
        return await bd.consultar(config, id_activo, sql, limite)
    except (ValueError, bd.BaseDatosError) as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def guardar_consulta_bd_gd(id_activo: int, nombre: str, sql: str, descripcion: str | None = None,
                                 id_consulta: int | None = None) -> dict:
    """Guarda una consulta de lectura con un nombre claro (p.ej. "Pedidos del
    mes por provincia") para que cualquiera la ejecute desde el panel con un
    botón. Con `id_consulta`, corrige una ya guardada."""
    config, quien = await _contexto()
    try:
        return await bd.guardar_consulta(config, id_activo, nombre, sql, descripcion, quien, id_consulta)
    except (ValueError, bd.BaseDatosError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_consultas_bd_gd(id_activo: int) -> list[dict]:
    """Las consultas guardadas de una base de datos, las más usadas primero."""
    config, _ = await _contexto()
    return await bd.listar_consultas(config, id_activo)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def ejecutar_consulta_guardada_gd(id_consulta: int, limite: int = 500) -> dict:
    """Ejecuta una consulta guardada y devuelve sus filas."""
    config, _ = await _contexto()
    try:
        return await bd.ejecutar_consulta_guardada(config, id_consulta, limite)
    except (ValueError, bd.BaseDatosError) as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def borrar_consulta_bd_gd(id_consulta: int) -> dict:
    """Borra una consulta guardada (no toca la base de datos)."""
    config, _ = await _contexto()
    await bd.borrar_consulta(config, id_consulta)
    return {"borrada": id_consulta}
