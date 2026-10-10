"""Herramientas MCP del asesor contable — ver docs/contabilidad/planificacion.md
(fase 1). Consultan la biblioteca contable (database/biblioteca_contable.py),
igual para todos los clientes.

Solo existen para la IA en las GD con el apartado activado
(`gd_configuracion.modulo_contable`): `ModuloContableMiddleware` las oculta
y las rechaza en las demás, para que sus definiciones no ocupen contexto en
cada conversación de un proyecto que no las usa."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError
from fastmcp.server.middleware.middleware import Middleware

from ._anotaciones import SOLO_LECTURA
from ..database import biblioteca_contable
from ..database.modelos._mod_configuracion import ConfiguracionCRUD

TAG_CONTABILIDAD = "contabilidad"


async def _modulo_activo() -> bool:
    proyecto = await resolver_proyecto_actual()
    return await ConfiguracionCRUD(get_db_config(proyecto["id"])).obtener_modulo_contable()


class ModuloContableMiddleware(Middleware):
    def __init__(self, instancia):
        self._instancia = instancia

    async def on_list_tools(self, context, call_next):
        herramientas = await call_next(context)
        if await _modulo_activo():
            return herramientas
        return [t for t in herramientas if TAG_CONTABILIDAD not in (t.tags or ())]

    async def on_call_tool(self, context, call_next):
        tool = await self._instancia.get_tool(context.message.name)
        if TAG_CONTABILIDAD in (tool.tags or ()) and not await _modulo_activo():
            raise ToolError("El apartado de contabilidad no está activado en esta gestión documental.")
        return await call_next(context)


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def buscar_temas_contables_gd(texto: str) -> list[dict]:
    """Busca en la biblioteca contable y fiscal de la GD (temas propios con
    ejemplos, basados en el PGC, la normativa del BOE y la doctrina oficial).
    Úsala ANTES de responder cualquier duda contable, fiscal o financiera:
    pon 1-3 palabras clave ("leasing", "prorrata IVA", "cuenta 555") y abre
    el tema que encaje con obtener_tema_contable_gd. Si no sale nada, prueba
    indice_contable_gd. Si la biblioteca no cubre la duda, dilo, responde
    avisando de que no está contrastado y anótala con
    anotar_pregunta_pendiente_gd para que se cubra."""
    return biblioteca_contable.buscar(texto)


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def indice_contable_gd(id_nodo: int | None = None) -> dict:
    """Índice de la biblioteca contable, nivel a nivel: sin `id_nodo`, las
    áreas; con el id de un área, bloque o capítulo, sus hijos (cada uno con
    título y resumen de una línea). Para ir directa a un tema es más rápido
    buscar_temas_contables_gd."""
    resultado = biblioteca_contable.indice(id_nodo)
    if resultado is None:
        raise ToolError(f"No hay ningún área, bloque ni capítulo con id {id_nodo}.")
    return resultado


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def obtener_tema_contable_gd(id_tema: int) -> dict:
    """Un tema completo de la biblioteca contable. Al responder con él:
    cita el tema y sus fuentes; di siempre lo que traiga en `avisos` (no
    revisado, posible desactualización, norma cambiada); da las cifras que
    cambian cada año (tipos, límites, plazos) con el año del tema; y si
    propones un asiento o una actuación, preséntalo como propuesta para que
    la valide el contable, nunca como hecho. Si una regla del cliente
    contradice el tema o la norma, adviértelo en vez de aplicarla en
    silencio. Para la letra exacta de una fuente, obtener_norma_contable_gd."""
    resultado = biblioteca_contable.tema(id_tema)
    if resultado is None:
        raise ToolError(f"No hay ningún tema con id {id_tema}.")
    return resultado


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def obtener_norma_contable_gd(id_fuente: str, fecha: str | None = None) -> dict:
    """Texto literal de un artículo del BOE (id como "BOE-A-1992-28740/a95")
    o resumen de una consulta de la DGT, tal como los cita un tema en
    `fuentes`. Ábrela solo cuando haga falta la letra exacta. Con `fecha`
    (AAAA-MM-DD) devuelve la versión vigente ese día, útil para ejercicios
    pasados. Al citarla: "Fuente: Agencia Estatal Boletín Oficial del
    Estado", con su fecha de versión."""
    resultado = biblioteca_contable.fuente(id_fuente, fecha)
    if resultado is None:
        detalle = f" vigente el {fecha}" if fecha else ""
        raise ToolError(f"No se conserva la fuente {id_fuente}{detalle}.")
    return resultado


mcp_app.add_middleware(ModuloContableMiddleware(mcp_app))
