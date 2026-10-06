"""Herramientas MCP de gd_entidades — ver docs/gestion-documental.md →
"Entidades". Clientes, proveedores, empleados... relacionables con
documentos; una entidad puede aparecer en varios documentos y un
documento puede tener varias entidades relacionadas."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_entidades import DocumentosEntidadesCRUD, EntidadesCRUD


async def _contexto_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


@mcp_app.tool()
async def crear_entidad_gd(
    nombre: str,
    tipo: str,
    direccion: str | None = None,
    localidad: str | None = None,
    provincia: str | None = None,
    codigo_postal: str | None = None,
    pais: str | None = None,
    telefono: str | None = None,
    email: str | None = None,
    observaciones: str | None = None,
    codigo: str | None = None,
    nif: str | None = None,
) -> dict:
    """Da de alta un cliente, proveedor, empleado... ANTES de llamarla,
    busca con listar_entidades_gd que no exista ya (por nombre y sus
    variantes, y por código si lo tienes): si existe, usa esa. `tipo` es texto
    libre (p.ej. "cliente", "proveedor", "empleado") — consulta
    listar_entidades_gd antes para reutilizar uno ya usado en vez de
    crear una variación del nombre. El resto de campos son opcionales;
    pregúntalos al cliente, no los inventes ni los deduzcas.

    `codigo`: identificador de esta entidad en el ERP del cliente, para
    poder cruzar datos entre sistemas — solo si el cliente te lo da.
    Tiene que ser único: falla si ya hay otra entidad con ese código."""
    config = await _contexto_actual()
    entidades = EntidadesCRUD(config)
    if codigo and await entidades.obtener_por_codigo(codigo):
        raise ToolError(f'Ya existe una entidad con el código "{codigo}"')
    id_entidad = await entidades.crear({
        "nombre": nombre, "tipo": tipo, "direccion": direccion, "localidad": localidad,
        "provincia": provincia, "codigo_postal": codigo_postal, "pais": pais,
        "telefono": telefono, "email": email, "observaciones": observaciones, "codigo": codigo, "nif": nif,
    })
    return await entidades.obtener(id_entidad)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_entidades_gd(q: str | None = None, tipo: str | None = None) -> list[dict]:
    """Entidades del proyecto. `q` busca por nombre (parcial); `tipo`
    filtra por tipo exacto (p.ej. "cliente"). Sin ninguno de los dos,
    devuelve todas (hasta 200)."""
    config = await _contexto_actual()
    return await EntidadesCRUD(config).buscar(q, tipo)


@mcp_app.tool()
async def actualizar_entidad_gd(
    id_entidad: int,
    nombre: str | None = None,
    tipo: str | None = None,
    direccion: str | None = None,
    localidad: str | None = None,
    provincia: str | None = None,
    codigo_postal: str | None = None,
    pais: str | None = None,
    telefono: str | None = None,
    email: str | None = None,
    observaciones: str | None = None,
    codigo: str | None = None,
    nif: str | None = None,
) -> dict:
    """Actualiza los campos que se pasen de una entidad ya existente
    (los que se dejen en blanco no se tocan — esta tool no sirve para
    borrar el contenido de un campo, solo para rellenarlo o cambiarlo)."""
    config = await _contexto_actual()
    entidad = await EntidadesCRUD(config).actualizar_campos(id_entidad, {
        "nombre": nombre, "tipo": tipo, "direccion": direccion, "localidad": localidad,
        "provincia": provincia, "codigo_postal": codigo_postal, "pais": pais,
        "telefono": telefono, "email": email, "observaciones": observaciones, "codigo": codigo, "nif": nif,
    })
    if not entidad:
        raise ToolError(f"No existe ninguna entidad con id {id_entidad}")
    return entidad


@mcp_app.tool()
async def eliminar_entidad_gd(id_entidad: int) -> None:
    """Borra una entidad — los documentos relacionados no se tocan,
    solo dejan de tener esa entidad asociada. No se puede deshacer."""
    config = await _contexto_actual()
    if not await EntidadesCRUD(config).obtener(id_entidad):
        raise ToolError(f"No existe ninguna entidad con id {id_entidad}")
    await EntidadesCRUD(config).eliminar(id_entidad)


@mcp_app.tool()
async def relacionar_documento_entidad_gd(id_documento: int, id_entidad: int) -> dict:
    """Relaciona un documento con una entidad (p.ej. el cliente de una
    factura) — un documento puede tener varias entidades relacionadas, y
    una entidad puede estar en muchos documentos. No falla si ya estaban
    relacionados."""
    config = await _contexto_actual()
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise ToolError(f"No existe ningún documento con id {id_documento}")
    if not await EntidadesCRUD(config).obtener(id_entidad):
        raise ToolError(f"No existe ninguna entidad con id {id_entidad}")
    await DocumentosEntidadesCRUD(config).asignar(id_documento, id_entidad)
    return {"id_documento": id_documento, "id_entidad": id_entidad}


@mcp_app.tool()
async def quitar_relacion_documento_entidad_gd(id_documento: int, id_entidad: int) -> dict:
    """Quita la relación entre un documento y una entidad — ninguno de
    los dos se borra, solo dejan de estar relacionados."""
    config = await _contexto_actual()
    quitado = await DocumentosEntidadesCRUD(config).quitar(id_documento, id_entidad)
    return {"id_documento": id_documento, "id_entidad": id_entidad, "estaba_relacionado": quitado}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_documentos_entidad_gd(id_entidad: int, incluir_archivados: bool = False) -> list[dict]:
    """Documentos relacionados con una entidad. Por defecto no incluye
    documentos archivados."""
    config = await _contexto_actual()
    if not await EntidadesCRUD(config).obtener(id_entidad):
        raise ToolError(f"No existe ninguna entidad con id {id_entidad}")
    return await DocumentosEntidadesCRUD(config).listar_documentos_de_entidad(id_entidad, incluir_archivados)


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_entidades_documento_gd(id_documento: int) -> list[dict]:
    """Entidades relacionadas con un documento (p.ej. el cliente y el
    proveedor de una factura)."""
    config = await _contexto_actual()
    return await DocumentosEntidadesCRUD(config).listar_entidades_de_documento(id_documento)
