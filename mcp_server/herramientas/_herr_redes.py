"""Herramientas MCP de redes sociales y calendario editorial (fase 5 de webs
y redes) — ver docs/gestion-documental.md → "Webs y redes sociales". La
lógica está en database/modelos/_mod_publicaciones.py y _mod_redes.py.

Crear un borrador no publica nada; publicar exige aprobar, y el nivel de
permiso de cada red decide si se puede aprobar desde aquí. Responder a un
comentario va por proponer_cambio_web_gd (red_responder)."""

from fastmcp.exceptions import ToolError

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from apps.mcp_server.core.dependencias.auth import clave_actual_es_solo_lectura
from database.config_db import get_db_config
from fastmcp.server.dependencies import get_http_headers

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_actividad import CABECERA_USUARIO_CHAT, PREFIJO_KEY_CHAT_INTERNO
from ..database.modelos._mod_publicaciones import PublicacionError, PublicacionesCRUD


async def _contexto() -> tuple[dict, int, str, str]:
    if clave_actual_es_solo_lectura():
        raise ToolError("Las webs y redes sociales no están disponibles para claves de invitado.")
    proyecto = await resolver_proyecto_actual()
    nombre_key = proyecto.get("nombre_api_key") or "IA"
    via = "chat" if nombre_key.startswith(PREFIJO_KEY_CHAT_INTERNO) and get_http_headers().get(CABECERA_USUARIO_CHAT) else "ia"
    return get_db_config(proyecto["id"]), proyecto["id"], via, nombre_key


@mcp_app.tool()
async def crear_publicacion_gd(
    texto: str, ids_activos: list[int], titulo: str | None = None, ids_documentos: list[int] | None = None,
    enlace: str | None = None, fecha_prevista: str | None = None, textos_por_red: dict | None = None,
    pedir_aprobacion: bool = True,
) -> dict:
    """Prepara una publicación para redes sociales en el calendario. NO se
    publica: queda pendiente de que una persona la apruebe.

    `ids_activos`: las redes (activos de tipo red_social, ver
    listar_activos_digitales_gd). `ids_documentos`: documentos de la GD con
    la foto o el vídeo (Instagram, TikTok y YouTube los necesitan).
    `fecha_prevista`: "AAAA-MM-DD HH:MM" hora de Madrid (vacío = en cuanto
    se apruebe). `textos_por_red`: {id_activo: texto} si en alguna red debe
    ir distinto (X: 280 caracteres como mucho; Instagram: 2200).
    Escribe con la voz de la marca (mira las reglas de la GD). Después,
    enséñale el texto al usuario y, si le parece bien,
    aprobar_publicacion_gd."""
    config, _, via, quien = await _contexto()
    try:
        return await PublicacionesCRUD(config).crear(
            {"texto": texto, "ids_activos": ids_activos, "titulo": titulo, "ids_documentos": ids_documentos or [],
             "enlace": enlace, "fecha_prevista": fecha_prevista, "textos_por_red": textos_por_red}, via, quien, pedir_aprobacion)
    except (ValueError, PublicacionError) as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def actualizar_publicacion_gd(
    id_publicacion: int, texto: str | None = None, titulo: str | None = None, ids_activos: list[int] | None = None,
    ids_documentos: list[int] | None = None, enlace: str | None = None, fecha_prevista: str | None = None,
    textos_por_red: dict | None = None,
) -> dict:
    """Cambia una publicación que aún no ha salido (lo vacío no se toca).
    Si ya estaba aprobada, vuelve a «pendiente»: hay que aprobarla otra vez."""
    config, _, _, _ = await _contexto()
    datos = {k: v for k, v in {"texto": texto, "titulo": titulo, "ids_activos": ids_activos, "ids_documentos": ids_documentos,
                                "enlace": enlace, "fecha_prevista": fecha_prevista, "textos_por_red": textos_por_red}.items()
             if v is not None}
    try:
        return await PublicacionesCRUD(config).actualizar(id_publicacion, datos)
    except (ValueError, PublicacionError) as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_publicaciones_gd(desde: str | None = None, hasta: str | None = None, estado: str | None = None,
                                  id_activo: int | None = None) -> list[dict]:
    """El calendario editorial. `desde`/`hasta`: AAAA-MM-DD. `estado`:
    borrador, pendiente, aprobada, publicada, parcial, error, cancelada,
    retirada. `id_activo`: solo las de una red."""
    config, _, _, _ = await _contexto()
    try:
        return await PublicacionesCRUD(config).listar(desde, hasta, estado, id_activo)
    except PublicacionError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_publicacion_gd(id_publicacion: int) -> dict:
    """Una publicación completa: texto, redes, estado, dónde ha salido
    (enlaces) y sus métricas."""
    config, _, _, _ = await _contexto()
    try:
        return await PublicacionesCRUD(config).obtener_salida(id_publicacion)
    except PublicacionError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def aprobar_publicacion_gd(id_publicacion: int, publicar_ya: bool = False) -> dict:
    """Aprueba una publicación: saldrá sola a su fecha prevista (o en el
    próximo minuto si no tiene). Úsala SOLO cuando el usuario haya visto el
    texto final y diga que sí. En redes con nivel «proponer» no se puede
    aprobar desde aquí: dile que la apruebe en el panel. `publicar_ya`:
    sale en este momento, sin esperar a su fecha."""
    config, id_proyecto, via, quien = await _contexto()
    crud = PublicacionesCRUD(config)
    try:
        p = await crud.aprobar(id_publicacion, via, quien)
        if publicar_ya:
            p = await crud.publicar(id_proyecto, id_publicacion, via, quien)
        return p
    except (ValueError, PublicacionError) as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def cancelar_publicacion_gd(id_publicacion: int) -> dict:
    """Cancela una publicación que aún no ha salido."""
    config, _, _, _ = await _contexto()
    try:
        return await PublicacionesCRUD(config).cancelar(id_publicacion)
    except PublicacionError as e:
        raise ToolError(str(e))


@mcp_app.tool()
async def retirar_publicacion_gd(id_publicacion: int) -> dict:
    """Deshace una publicación ya hecha: la borra de las redes donde salió.
    Pregunta antes al usuario. (Instagram no deja borrar por su API.)"""
    config, _, via, quien = await _contexto()
    try:
        return await PublicacionesCRUD(config).retirar(id_publicacion, via, quien)
    except PublicacionError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def metricas_publicacion_gd(id_publicacion: int) -> dict:
    """Pide a cada red las métricas al día de una publicación: alcance, me
    gusta, comentarios, compartidos. (Se actualizan solas una vez al día
    durante el primer mes.)"""
    config, _, _, _ = await _contexto()
    try:
        return await PublicacionesCRUD(config).actualizar_metricas(id_publicacion)
    except PublicacionError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def comentarios_publicacion_gd(id_publicacion: int, id_activo: int) -> list[dict]:
    """Los comentarios de una publicación en una red. Para contestar uno,
    propón la respuesta con proponer_cambio_web_gd (operación
    red_responder, en el activo de la red: id_publicacion, id_comentario,
    texto, autor_comentario) y que el usuario la apruebe."""
    config, _, _, _ = await _contexto()
    try:
        return await PublicacionesCRUD(config).comentarios(id_publicacion, id_activo)
    except PublicacionError as e:
        raise ToolError(str(e))
