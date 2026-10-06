"""Herramientas MCP de SEO (fase 3 de webs y redes) — ver
docs/gestion-documental.md → "Webs y redes sociales". La lógica está en
database/modelos/_mod_seo.py y _mod_google.py, la misma que usan el panel y
el cron. Los arreglos se proponen con proponer_cambio_web_gd (wp_editar_seo,
wp_editar_medio...), como cualquier otro cambio.

Como en _herr_webs.py, las de consulta van marcadas de solo lectura y
rechazan por dentro las claves de invitado. auditar_seo_gd también: recorre
la web leyendo, no cambia nada en ella."""

from fastmcp.exceptions import ToolError

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from apps.mcp_server.core.dependencias.auth import clave_actual_es_solo_lectura
from database.config_db import get_db_config

from ._anotaciones import SOLO_LECTURA
from ..database.modelos import _mod_google as google
from ..database.modelos import _mod_geo as geo
from ..database.modelos import _mod_seo as seo
from ..database.modelos._mod_activos_digitales import ActivosDigitalesCRUD
from ..database.modelos._mod_conector import ClienteConector, ConectorError


async def _contexto() -> tuple[dict, int, str]:
    if clave_actual_es_solo_lectura():
        raise ToolError("Las webs y redes sociales no están disponibles para claves de invitado.")
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"]), proyecto["id"], proyecto.get("nombre_api_key") or "IA"


@mcp_app.tool(annotations=SOLO_LECTURA)
async def rendimiento_google_gd(id_activo: int, dias: int = 28) -> dict:
    """Cómo le va a la web en Google (Search Console): clics (visitas desde
    Google), impresiones (veces que salió), CTR y posición media de los
    últimos `dias` frente a los anteriores, con las páginas y las búsquedas
    que más traen. Google tarda unos 3 días en tener los datos completos.
    Si no hay acceso, el error dice qué correo tiene que añadir el cliente
    en Search Console: díselo tal cual."""
    config, _, _ = await _contexto()
    try:
        return await seo.rendimiento_google(config, id_activo, max(7, min(dias, 480)))
    except (ValueError, google.GoogleError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def velocidad_web_gd(id_activo: int, url: str | None = None, estrategia: str = "mobile") -> dict:
    """Mide la velocidad de una página con Google PageSpeed (la portada si
    no se dice otra): puntuaciones de 0 a 100 (rendimiento, SEO,
    accesibilidad, buenas prácticas), cuánto tarda en verse lo principal
    (LCP) y lo que más la aceleraría. `estrategia`: mobile o desktop.
    Tarda hasta un minuto. Explícalo sin tecnicismos."""
    config, _, _ = await _contexto()
    try:
        activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
        return await google.velocidad(url or activo["url"] + "/", "desktop" if estrategia == "desktop" else "mobile")
    except (ValueError, google.GoogleError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def auditar_seo_gd(id_activo: int) -> dict:
    """Lanza una auditoría SEO: recorre la web como Google (hasta el máximo
    de páginas de sus ajustes) y apunta los problemas. Vuelve enseguida con
    la auditoría «en curso»; el resultado, con hallazgos_seo_gd en uno o
    dos minutos (más en webs grandes). Se hace sola cada semana."""
    config, _, quien = await _contexto()
    try:
        return await seo.auditar(config, id_activo, quien)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def hallazgos_seo_gd(id_activo: int, estado: str | None = "abierto", gravedad: str | None = None,
                           limite: int = 30) -> dict:
    """Los problemas SEO de la última auditoría, los que más conviene
    arreglar primero (gravedad × visitas que trae esa página desde Google).
    `estado`: abierto, en_tarea, resuelto, ignorado (null = todos);
    `gravedad`: alta, media, baja. Cada uno trae, si se sabe, la entrada o
    página de WordPress (objeto_tipo, objeto_id) para proponer el arreglo:
    título o descripción para Google → wp_editar_seo; texto alternativo de
    una imagen → wp_editar_medio; contenido o H1 → wp_editar_entrada/pagina."""
    config, _, _ = await _contexto()
    return {"auditoria": await seo.ultima_auditoria(config, id_activo),
            "hallazgos": await seo.hallazgos(config, id_activo, estado, gravedad, max(1, min(limite, 200)))}


@mcp_app.tool()
async def marcar_hallazgo_seo_gd(id_hallazgo: int, estado: str) -> dict:
    """Marca un problema SEO como ignorado (no se quiere arreglar: deja de
    salir en las siguientes auditorías), resuelto o abierto otra vez."""
    config, _, _ = await _contexto()
    try:
        return await seo.marcar_hallazgo(config, id_hallazgo, estado)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def hallazgo_a_tarea_gd(id_hallazgo: int) -> dict:
    """Convierte un problema SEO en una tarea: crea una nota del bloc con la
    etiqueta SEO y la pone «pendiente» en el seguimiento (sale en el resumen
    diario). Para lo que no se arregla al momento."""
    config, id_proyecto, quien = await _contexto()
    try:
        return await seo.hallazgo_a_tarea(config, id_proyecto, id_hallazgo, None, quien)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def informe_seo_gd(id_activo: int, anio: int | None = None, mes: int | None = None) -> dict:
    """El informe SEO de un mes (por defecto, el anterior) en markdown:
    visitas desde Google y su evolución, páginas y búsquedas que más traen,
    cambios hechos en la web y su efecto, y lo que más conviene arreglar.
    Para guardarlo como documento (y sacarlo en PDF), guardar_informe_seo_gd."""
    config, _, _ = await _contexto()
    anio_def, mes_def = seo.mes_anterior(seo.ahora_madrid())
    try:
        return {"markdown": await seo.informe_mensual(config, id_activo, anio or anio_def, mes or mes_def)}
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def guardar_informe_seo_gd(id_activo: int, anio: int | None = None, mes: int | None = None) -> dict:
    """Guarda el informe SEO de un mes como documento de la GD (tipo
    «Informe SEO»; si ya existía, como versión nueva). Luego se puede sacar
    en PDF con generar_informe_pdf_gd y el estilo del cliente."""
    config, _, _ = await _contexto()
    anio_def, mes_def = seo.mes_anterior(seo.ahora_madrid())
    try:
        r = await seo.guardar_informe(config, id_activo, anio or anio_def, mes or mes_def)
    except ValueError as e:
        raise ToolError(str(e))
    return {"id_documento": r["id_documento"], "nombre": r["nombre"]}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def leer_seo_pagina_gd(id_activo: int, id_objeto: int) -> dict:
    """Lo que sale en Google de una entrada o página ahora mismo: título y
    descripción para Google y palabra clave, y qué plugin de SEO los guarda.
    Necesita el conector de Multiplika. Léelo antes de proponer
    wp_editar_seo, para partir de lo que hay."""
    config, _, _ = await _contexto()
    activos = ActivosDigitalesCRUD(config)
    try:
        activo = await activos.obtener_o_error(id_activo)
        return await ClienteConector(await activos.cliente_wordpress(activo)).leer_seo(id_objeto)
    except (ValueError, ConectorError) as e:
        raise ToolError(str(e))


# --- GEO: salir en las respuestas de las IAs (fase 6) ---

@mcp_app.tool(annotations=SOLO_LECTURA)
async def preguntas_geo_gd(id_activo: int) -> list[dict]:
    """Las preguntas de seguimiento del GEO de una web: lo que preguntaría un
    cliente real a una IA ("mejor laboratorio de análisis de alimentos en
    Sevilla"). Con ellas se mide si la empresa sale en las respuestas."""
    config, _, _ = await _contexto()
    return await geo.preguntas(config, id_activo)


@mcp_app.tool()
async def anadir_preguntas_geo_gd(id_activo: int, preguntas: list[str]) -> list[dict]:
    """Añade preguntas de seguimiento del GEO (como mucho 50 por web). Que
    sean las que haría un cliente real, sin el nombre de la empresa, con la
    zona si el negocio es local. Cada pregunta cuesta una consulta a cada IA
    en cada medición (una vez al mes): mejor 10-20 bien elegidas."""
    config, _, _ = await _contexto()
    try:
        return await geo.anadir_preguntas(config, id_activo, preguntas)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def quitar_pregunta_geo_gd(id_pregunta: int, borrar: bool = False) -> dict:
    """Desactiva (o borra, con `borrar`) una pregunta de seguimiento del GEO."""
    config, _, _ = await _contexto()
    await geo.cambiar_pregunta(config, id_pregunta, activa=False, borrar=borrar)
    return {"id_pregunta": id_pregunta, "borrada": borrar}


@mcp_app.tool()
async def medir_geo_gd(id_activo: int) -> dict:
    """Hace YA las preguntas de seguimiento a cada IA disponible (Claude con la
    clave de la empresa; ChatGPT, Gemini y Perplexity si hay credencial
    «openai», «gemini» o «perplexity») y dice si sale la marca, si citan la
    web y qué competidores salen. Cuesta dinero (una consulta por pregunta y
    por IA): avisa al usuario antes. Se hace sola una vez al mes. Puede
    tardar minutos. Es una medida aproximada: cuenta tendencias, no
    posiciones exactas."""
    config, id_proyecto, _ = await _contexto()
    try:
        return await geo.medir(config, id_proyecto, id_activo)
    except ValueError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def resultados_geo_gd(id_activo: int) -> dict:
    """La última medición del GEO (y la anterior, para comparar): en cuántas
    respuestas sale la marca, por IA, y qué otros sitios citan."""
    config, _, _ = await _contexto()
    return await geo.resultados(config, id_activo)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def leer_geo_web_gd(id_activo: int) -> dict:
    """Lo que la web ofrece a las IAs (con el conector de Multiplika 1.3):
    qué robots de IA pueden leerla, el texto de /llms.txt y los datos
    estructurados de la empresa (schema.org). Para cambiarlo: proponer
    wp_geo. Qué robots dejar entrar lo decide el cliente: explícale que si
    bloquea uno, es difícil salir en las respuestas de esa IA."""
    config, _, _ = await _contexto()
    activos = ActivosDigitalesCRUD(config)
    try:
        activo = await activos.obtener_o_error(id_activo)
        return await ClienteConector(await activos.cliente_wordpress(activo)).leer_geo()
    except (ValueError, ConectorError) as e:
        raise ToolError(str(e))
