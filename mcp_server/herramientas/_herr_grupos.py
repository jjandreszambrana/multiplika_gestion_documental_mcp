"""Herramientas MCP de gd_grupos — ver docs/gestion-documental.md →
"Grupos de documentos". Un grupo agrupa documentos para un fin concreto;
no todos los documentos están en uno, y uno mismo puede estar en varios."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_grupos import DocumentosGruposCRUD, GruposCRUD


async def _contexto_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


@mcp_app.tool()
async def crear_grupo_gd(nombre: str, proposito: str) -> dict:
    """Crea un grupo de documentos nuevo, para un fin concreto (p.ej.
    "Auditoría 2026", "Expediente subvención X"). `proposito` describe
    para qué sirve — pregúntaselo al cliente, no lo inventes. Falla si ya
    existe un grupo con ese nombre."""
    config = await _contexto_actual()
    grupos = GruposCRUD(config)
    if await grupos.obtener_por_nombre(nombre):
        raise ToolError(f'Ya existe un grupo llamado "{nombre}"')
    id_grupo = await grupos.crear(nombre, proposito)
    return await grupos.obtener(id_grupo)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_grupos_gd() -> list[dict]:
    """Todos los grupos de documentos del proyecto, con su propósito.
    Consúltala antes de asignar un documento a un grupo por nombre, para
    saber su id (o para no crear uno duplicado)."""
    config = await _contexto_actual()
    return await GruposCRUD(config).listar_todos()


@mcp_app.tool()
async def asignar_documento_grupo_gd(id_documento: int, id_grupo: int) -> dict:
    """Añade un documento a un grupo — un documento puede estar en
    varios grupos a la vez, no hace falta quitarlo de uno para meterlo en
    otro. No falla si ya estaba en ese grupo."""
    config = await _contexto_actual()
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    if not await GruposCRUD(config).obtener(id_grupo):
        raise ToolError(f"No existe ningún grupo con id {id_grupo}")
    await DocumentosGruposCRUD(config).asignar(id_documento, id_grupo)
    return {"id_documento": id_documento, "id_grupo": id_grupo}


@mcp_app.tool()
async def quitar_documento_grupo_gd(id_documento: int, id_grupo: int) -> dict:
    """Quita un documento de un grupo — el documento en sí no se toca,
    solo deja de aparecer en ese grupo."""
    config = await _contexto_actual()
    quitado = await DocumentosGruposCRUD(config).quitar(id_documento, id_grupo)
    return {"id_documento": id_documento, "id_grupo": id_grupo, "estaba_asignado": quitado}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_documentos_grupo_gd(id_grupo: int, incluir_archivados: bool = False) -> list[dict]:
    """Documentos asignados a un grupo. Por defecto no incluye
    documentos archivados."""
    config = await _contexto_actual()
    if not await GruposCRUD(config).obtener(id_grupo):
        raise ToolError(f"No existe ningún grupo con id {id_grupo}")
    return await DocumentosGruposCRUD(config).listar_documentos_de_grupo(id_grupo, incluir_archivados)


@mcp_app.tool()
async def eliminar_grupo_gd(id_grupo: int) -> None:
    """Borra un grupo — los documentos que tenía asignados no se tocan,
    solo dejan de estar agrupados. No se puede deshacer."""
    config = await _contexto_actual()
    if not await GruposCRUD(config).obtener(id_grupo):
        raise ToolError(f"No existe ningún grupo con id {id_grupo}")
    await GruposCRUD(config).eliminar(id_grupo)
