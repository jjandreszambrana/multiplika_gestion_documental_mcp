"""Herramientas MCP de GDs enlazadas — ver docs/gestion-documental.md →
"GDs enlazadas". Dos grupos:

- Para los usuarios de ESTA GD (marcadas SOLO_LECTURA, sin etiqueta):
  consultar a las centrales enlazadas, pedirles un documento completo,
  anotar allí lo que no resolvieron, y gestionar las preguntas que a su
  vez nos dejan a nosotros las GDs que nos consultan.
- Para OTRA GD que nos llama con una key gd_enlazada (etiquetadas
  TAGS_GD_ENLAZADA — es lo único que esa key ve): darse de alta como
  enlace al enlazar, darse de baja, y anotar una pregunta pendiente.

Las tres de consulta hacia fuera van marcadas de solo lectura aunque
`anotar_pregunta_pendiente_enlazada_gd` escriba en la central: no tocan
nada de esta GD, y si el chat pidiera confirmación por cada anotación
sería un estorbo (la pregunta ya viajó a la central al consultarla)."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA, TAGS_GD_ENLAZADA, origen_enlazada
from ..database.dependencias._dep_enlaces import MOTIVO_NO_RESUELTA, SENTIDO_CENTRAL, SENTIDO_ENLAZADA
from ..database.modelos._mod_enlaces import (
    EnlaceError,
    EnlacesCRUD,
    PreguntasPendientesCRUD,
    consultar_centrales,
    llamar_enlace,
    revocar_key,
)


async def _config_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


async def _central_o_error(config: dict, id_enlace: int) -> dict:
    enlace = await EnlacesCRUD(config).obtener_con_clave(id_enlace)
    if not enlace or enlace["sentido"] != SENTIDO_CENTRAL or not enlace["activo"]:
        raise ToolError(f"No hay ninguna GD central activa con id_enlace {id_enlace} — mira listar_enlaces_gd")
    return enlace


# ---------- para los usuarios de esta GD ----------

@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_enlaces_gd() -> list[dict]:
    """Otras gestiones documentales enlazadas con esta: las centrales a
    las que consultamos (sentido 'central') y las que nos consultan a
    nosotros (sentido 'enlazada')."""
    return await EnlacesCRUD(await _config_actual()).listar_metadatos()


@mcp_app.tool(annotations=SOLO_LECTURA)
async def consultar_gds_enlazadas_gd(pregunta: str, limite: int = 5) -> list[dict]:
    """Busca la pregunta en las gestiones documentales centrales enlazadas
    a esta (p.ej. la base de conocimiento de la asesoría). Úsala cuando
    los documentos propios (consultar_documentos_gd) no respondan. Cada
    fragmento trae `origen` (de qué GD viene — cítalo en la respuesta) e
    `id_enlace` para pedir el documento completo con
    obtener_documento_enlazado_gd. Si una central no responde, su error
    viene como un resultado más con `error`."""
    resultados = await consultar_centrales(await _config_actual(), pregunta, limite, cadena_gds=None)
    if not resultados:
        raise ToolError("Esta GD no tiene ninguna central enlazada activa (ver listar_enlaces_gd)")
    return resultados


@mcp_app.tool(annotations=SOLO_LECTURA)
async def obtener_documento_enlazado_gd(id_enlace: int, id_documento: int) -> dict:
    """Documento completo de una GD central enlazada, cuando un fragmento
    de consultar_gds_enlazadas_gd no basta. `id_enlace` e `id_documento`
    vienen en ese fragmento. Solo para fragmentos de una central directa —
    los que llegaron a través de otra (origen "A › B") no se pueden pedir
    completos."""
    enlace = await _central_o_error(await _config_actual(), id_enlace)
    try:
        return await llamar_enlace(
            enlace["url_mcp"], enlace["api_key"], "obtener_documento_completo_gd", {"id_documento": id_documento},
        )
    except EnlaceError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def anotar_pregunta_pendiente_enlazada_gd(id_enlace: int, pregunta: str, detalle: str | None = None) -> dict:
    """Avisa a una GD central de que su información no resolvió esta
    pregunta (hubo fragmentos, pero no respondían), para que su
    responsable la cubra. Úsala después de consultar_gds_enlazadas_gd
    cuando ni lo propio ni lo de la central sirvieron. `detalle`: qué
    faltaba exactamente. No hace falta si la central no devolvió nada —
    eso lo anota ella sola."""
    enlace = await _central_o_error(await _config_actual(), id_enlace)
    try:
        return await llamar_enlace(
            enlace["url_mcp"], enlace["api_key"], "anotar_pregunta_pendiente_gd",
            {"pregunta": pregunta, "detalle": detalle},
        )
    except EnlaceError as e:
        raise ToolError(str(e))


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_preguntas_pendientes_gd(estado: str | None = "pendiente") -> list[dict]:
    """Preguntas que las GDs enlazadas a esta (a las que hacemos de
    central) nos hicieron y no supimos responder, las más repetidas
    primero. `estado`: 'pendiente' (por defecto), 'resuelta' o None para
    todas. Al cubrir una con un documento nuevo, ciérrala con
    resolver_pregunta_pendiente_gd."""
    return await PreguntasPendientesCRUD(await _config_actual()).listar_por_estado(estado)


@mcp_app.tool()
async def resolver_pregunta_pendiente_gd(id_pregunta: int) -> dict:
    """Marca como resuelta una pregunta pendiente (ya hay un documento que
    la responde)."""
    pregunta = await PreguntasPendientesCRUD(await _config_actual()).cambiar_estado(id_pregunta, "resuelta")
    if not pregunta:
        raise ToolError(f"No existe ninguna pregunta pendiente con id {id_pregunta}")
    return pregunta


# ---------- para otra GD que nos llama con key gd_enlazada ----------

@mcp_app.tool(tags=TAGS_GD_ENLAZADA)
async def registrar_enlace_gd(url_mcp: str, api_key: str) -> dict:
    """Uso interno entre gestiones documentales: la GD que se enlaza con
    esta nos deja su URL /mcp y una key de solo lectura para que podamos
    leer sus documentos (aspirar aprendizajes). La llama el panel de la
    otra GD al enlazar, no una persona."""
    proyecto = await resolver_proyecto_actual()
    enlaces = EnlacesCRUD(get_db_config(proyecto["id"]))
    if await enlaces.obtener_por_key_emitida(proyecto["id_api_key"]):
        raise ToolError("Esta key ya está enlazada — desenlaza antes de volver a enlazar")
    id_enlace = await enlaces.crear(
        origen_enlazada(proyecto), url_mcp, api_key, SENTIDO_ENLAZADA, id_api_key_emitida=proyecto["id_api_key"],
    )
    return {"id_enlace": id_enlace, "nombre": origen_enlazada(proyecto)}


@mcp_app.tool(tags=TAGS_GD_ENLAZADA)
async def eliminar_enlace_gd() -> dict:
    """Uso interno entre gestiones documentales: la GD que llama se
    desenlaza de esta — se borra su enlace y se revoca la key con la que
    llamaba. La llama el panel de la otra GD al desenlazar, no una persona."""
    proyecto = await resolver_proyecto_actual()
    enlaces = EnlacesCRUD(get_db_config(proyecto["id"]))
    enlace = await enlaces.obtener_por_key_emitida(proyecto["id_api_key"])
    if enlace:
        await enlaces.eliminar(enlace["id"])
    await revocar_key(proyecto["id_api_key"])
    return {"eliminado": bool(enlace)}


@mcp_app.tool(tags=TAGS_GD_ENLAZADA)
async def anotar_pregunta_pendiente_gd(pregunta: str, detalle: str | None = None) -> dict:
    """Una GD enlazada avisa de que nuestra información no resolvió su
    pregunta (hubo resultados, pero no respondían). Queda en la lista de
    preguntas pendientes de esta GD para que su responsable la cubra."""
    proyecto = await resolver_proyecto_actual()
    return await PreguntasPendientesCRUD(get_db_config(proyecto["id"])).anotar(
        pregunta, origen_enlazada(proyecto), MOTIVO_NO_RESUELTA, detalle,
    )
