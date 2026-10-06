"""Herramientas MCP de la vigilancia de webs (fase 2 de webs y redes) — ver
docs/gestion-documental.md → "Webs y redes sociales". La lógica está en
database/modelos/_mod_vigilancia.py, la misma que usan el panel y el cron.

Como en _herr_webs.py, las de consulta van marcadas de solo lectura y
rechazan por dentro las claves de invitado. comprobar_ahora_gd también: no
cambia nada en la web ni en la GD salvo apuntar el resultado."""

from datetime import timedelta

from fastmcp.exceptions import ToolError

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from apps.mcp_server.core.dependencias.auth import clave_actual_es_solo_lectura
from database.config_db import get_db_config

from ._anotaciones import SOLO_LECTURA
from ..database.modelos import _mod_vigilancia as vigilancia
from ..database.modelos._mod_activos_digitales import ActivosDigitalesCRUD, ajustes_efectivos
from ..database.modelos._mod_conector import ClienteConector, ConectorError, listar_remoto


async def _contexto() -> tuple[dict, int, str]:
    if clave_actual_es_solo_lectura():
        raise ToolError("Las webs y redes sociales no están disponibles para claves de invitado.")
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"]), proyecto["id"], proyecto.get("nombre_api_key") or "IA"


@mcp_app.tool(annotations=SOLO_LECTURA)
async def estado_vigilancia_gd(id_activo: int) -> list[dict]:
    """Cómo está una web ahora: cada comprobación (si responde, certificado,
    dominio, protecciones del servidor, archivos expuestos, administradores
    y plugins, spam y, con el conector de Multiplika instalado, archivos
    modificados, errores, actualizaciones y copias) con su último resultado. `estado`: ok, aviso (conviene
    mirarlo), grave (se avisa al momento), sin_datos (no se puede saber),
    error (no se pudo comprobar). Explícaselo al usuario en palabras
    normales y dile qué hacer con lo que no esté bien."""
    config, _, _ = await _contexto()
    try:
        return await vigilancia.listar_estado(config, id_activo)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def resumen_vigilancia_gd() -> dict:
    """Resumen de todas las webs: lo que no está bien, caídas, cambios hechos
    y propuestas pendientes de los últimos 7 días — lo mismo que llega cada
    lunes. Úsala para "¿cómo están mis webs?"."""
    config, _, _ = await _contexto()
    texto = await vigilancia.texto_resumen(config, vigilancia.ahora_madrid() - timedelta(days=7))
    return {"resumen": texto or "No hay ninguna web vigilada todavía."}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def comprobar_ahora_gd(id_activo: int, tipo: str | None = None) -> list[dict]:
    """Lanza ya las comprobaciones de una web (todas, o solo `tipo`:
    disponibilidad, certificado, dominio, cabeceras, archivos_expuestos,
    wordpress, spam, integridad, errores, actualizaciones, copias), sin
    esperar a su turno. Ojo: «copias» hace una copia si están activadas y
    «actualizaciones» actualiza si están en automático. Úsala tras arreglar algo,
    para confirmar que ya está bien. Puede tardar unos segundos."""
    config, id_proyecto, _ = await _contexto()
    try:
        return await vigilancia.comprobar_ahora(config, id_proyecto, id_activo, tipo)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def historial_vigilancia_gd(
    id_activo: int, tipo: str | None = None, dias: int = 30, solo_problemas: bool = False,
) -> list[dict]:
    """Resultados anteriores de la vigilancia de una web, los más recientes
    primero: para "¿se ha caído la web este mes?" o "¿desde cuándo falla?".
    `solo_problemas` deja fuera los que salieron bien."""
    config, _, _ = await _contexto()
    return await vigilancia.historial(config, id_activo, tipo, dias, solo_problemas)


@mcp_app.tool()
async def configurar_vigilancia_gd(
    id_activo: int, tipo: str, activa: bool | None = None, cada_minutos: int | None = None,
) -> dict:
    """Activa, desactiva o cambia cada cuánto se hace una comprobación de
    una web (mínimo 5 minutos, máximo 7 días)."""
    config, _, _ = await _contexto()
    try:
        return await vigilancia.configurar(config, id_activo, tipo, activa, cada_minutos)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def aceptar_administradores_web_gd(id_activo: int) -> dict:
    """Da por buenos los administradores que tiene ahora la web, para que
    deje de avisar de los «nuevos». Úsala SOLO si el usuario te confirma que
    conoce a esas personas; si no las conoce, puede ser un intruso: dile que
    lo revise en WordPress y que cambie las contraseñas."""
    config, _, quien = await _contexto()
    try:
        await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
        return await vigilancia.aceptar_administradores(config, id_activo, quien)
    except ValueError as e:
        raise ToolError(str(e))


# --- Con el conector de Multiplika instalado en la web ---

async def _conector(config: dict, id_activo: int) -> ClienteConector:
    activos = ActivosDigitalesCRUD(config)
    activo = await activos.obtener_o_error(id_activo)
    if not activo["conector_instalado"]:
        raise ValueError(f"«{activo['nombre']}» no tiene el conector de Multiplika instalado (o no se ha probado "
                         "la conexión desde que se instaló). Se descarga desde el panel: Webs y redes → la web → Vigilancia.")
    return ClienteConector(await activos.cliente_wordpress(activo))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_copias_web_gd(id_activo: int) -> dict:
    """Copias de seguridad de una web: las del propio servidor de la web y,
    si tiene servidor remoto configurado, las de allí; con el espacio libre.
    Para restaurar una: proponer_cambio_web_gd con wp_restaurar_copia."""
    config, _, _ = await _contexto()
    try:
        conector = await _conector(config, id_activo)
        locales = await conector.listar_copias()
        activo = await ActivosDigitalesCRUD(config).obtener(id_activo)
        ajustes = ajustes_efectivos(activo)
        remotas = (await listar_remoto(config, ajustes["copias_credencial_remota"], ajustes["copias_carpeta_remota"])
                   if ajustes["copias_credencial_remota"] else None)
    except (ValueError, ConectorError) as e:
        raise ToolError(str(e))
    return {**locales, "remotas": remotas}


@mcp_app.tool()
async def hacer_copia_web_gd(id_activo: int) -> dict:
    """Hace ya una copia de seguridad completa de la web (base de datos y
    archivos), en su propio servidor. Puede tardar unos minutos. No cambia
    nada de la web."""
    config, _, _ = await _contexto()
    try:
        return await (await _conector(config, id_activo)).crear_copia()
    except (ValueError, ConectorError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def leer_errores_web_gd(id_activo: int, lineas: int = 50) -> dict:
    """Las últimas líneas del registro de errores de WordPress, para
    averiguar por qué falla algo. Explícale al usuario qué significan en
    palabras normales; no le pegues el registro tal cual."""
    config, _, _ = await _contexto()
    try:
        return await (await _conector(config, id_activo)).errores(max(1, min(lineas, 300)))
    except (ValueError, ConectorError) as e:
        raise ToolError(str(e))
