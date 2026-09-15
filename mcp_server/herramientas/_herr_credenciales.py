"""Herramientas MCP de gd_credenciales — ver docs/gestion-documental.md →
"Credenciales". El valor de una credencial nunca pasa por esta
conversación: listar_credenciales_gd nunca lo devuelve, y
crear_credencial_gd lo pide con un formulario (ver Context.elicit de
FastMCP) en vez de como parámetro de la tool, precisamente para que un
secreto no quede escrito en ningún mensaje del cliente ni de la IA. Editar
o borrar una credencial ya creada sigue siendo solo desde el panel
(panel_cliente/servidor.py) — no hay tool para eso."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp import Context
from fastmcp.exceptions import ToolError
from pydantic import BaseModel, Field

from ..database.modelos._mod_credenciales import CredencialesCRUD


@mcp_app.tool()
async def listar_credenciales_gd() -> list[dict]:
    """Credenciales disponibles para este proyecto: nombre, para qué sirve
    y el usuario (si esta credencial lo lleva) — nunca la contraseña/API
    key. Para darlas de alta usa crear_credencial_gd; para editarlas o
    borrarlas, solo desde el panel."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    return await CredencialesCRUD(config).listar_metadatos()


class _DatosCredencialNueva(BaseModel):
    nombre: str = Field(description='Nombre corto para identificarla, p.ej. "Mistral" o "Correo SMTP"')
    descripcion: str = Field(description="Para qué sirve esta credencial")
    valor: str = Field(description="La contraseña o API key en sí — se guarda cifrada, nadie más la ve")
    usuario: str = Field(default="", description="Usuario asociado, si lleva — déjalo vacío si no aplica")


@mcp_app.tool()
async def crear_credencial_gd(ctx: Context) -> dict:
    """Da de alta una credencial nueva (contraseña, API key...) lanzándole
    un formulario al cliente para que la escriba él mismo — llama a esta
    tool en cuanto diga que quiere añadir una, sin pedirle antes el valor
    por chat ni escribirlo tú: el valor va del formulario al servidor sin
    pasar por esta conversación. Si consulta antes listar_credenciales_gd
    y ya existe una con ese nombre, la tool falla con un aviso. Si el
    cliente cierra el formulario sin rellenarlo, dile que no se ha creado
    nada — no insistas ni le pidas el valor a mano."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    credenciales = CredencialesCRUD(config)

    resultado = await ctx.elicit(
        "Datos de la credencial nueva. El valor se guarda cifrado y no se te mostrará a ti ni a la IA.",
        response_type=_DatosCredencialNueva,
    )
    if resultado.action != "accept":
        raise ToolError("El cliente no ha rellenado el formulario — no se ha creado ninguna credencial.")
    datos = resultado.data

    if await credenciales.obtener_por_nombre(datos.nombre):
        raise ToolError(f'Ya existe una credencial llamada "{datos.nombre}"')

    id_credencial = await credenciales.crear(datos.nombre, datos.descripcion, datos.valor, datos.usuario or None)
    fila = await credenciales.obtener(id_credencial)
    return {k: v for k, v in fila.items() if k != "valor_cifrado"}
