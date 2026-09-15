"""Herramientas MCP de gd_credenciales — ver docs/gestion-documental.md →
"Credenciales". El valor de una credencial nunca pasa por esta
conversación: listar_credenciales_gd nunca lo devuelve, y
crear_credencial_gd lo pide con un formulario (ver Context.elicit de
FastMCP) en vez de como parámetro de la tool, precisamente para que un
secreto no quede escrito en ningún mensaje del cliente ni de la IA. Editar
o borrar una credencial ya creada sigue siendo solo desde el panel
(panel_cliente/servidor.py) — no hay tool para eso.

Excepción — cliente PonNodo (cabecera `X-Client-App: ponnodo`, sin
soporte de elicitation, ver _deteccion_cliente.py): tampoco entonces se le
pide el valor por chat ni se pasa como parámetro de la tool. En su lugar
se genera un enlace de un solo uso a un formulario propio del panel
(panel_cliente/servidor.py → "Formulario de credencial"), que el valor
solo toca al llegar de ahí directamente a gd_credenciales — nunca pasa por
esta tool ni por ningún mensaje a la IA."""

import os

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp import Context
from fastmcp.exceptions import ToolError
from pydantic import BaseModel, Field

from ._deteccion_cliente import es_cliente_ponnodo
from ..database.modelos._mod_credenciales import CredencialesCRUD
from ..database.modelos._mod_solicitudes_credencial import SolicitudesCredencialCRUD, generar_token


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
async def crear_credencial_gd(
    ctx: Context, nombre: str | None = None, descripcion: str | None = None, usuario: str | None = None
) -> dict:
    """Da de alta una credencial nueva (contraseña, API key...) lanzándole
    un formulario al cliente para que la escriba él mismo — llama a esta
    tool en cuanto diga que quiere añadir una, sin pedirle antes el valor
    por chat ni escribirlo tú: el valor va del formulario al servidor sin
    pasar por esta conversación. Si consulta antes listar_credenciales_gd
    y ya existe una con ese nombre, la tool falla con un aviso. Si el
    cliente cierra el formulario sin rellenarlo, dile que no se ha creado
    nada — no insistas ni le pidas el valor a mano.

    Excepción — cliente PonNodo (cabecera `X-Client-App: ponnodo`): esta
    tool no lanza ningún formulario. `nombre` y `descripcion` (no son
    secretos) sí se los preguntas tú por chat y se los pasas como
    parámetros — si faltan, la tool falla listando cuáles son. El valor en
    sí nunca se te pide ni se pasa por aquí: la tool devuelve un enlace de
    un solo uso (caduca en 15 minutos) a un formulario donde el cliente lo
    escribe directamente; dile que lo abra en su navegador y no le pidas
    el valor tú mismo bajo ningún concepto."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    credenciales = CredencialesCRUD(config)

    if es_cliente_ponnodo():
        faltan = [campo for campo, valor in [("nombre", nombre), ("descripcion", descripcion)] if not valor]
        if faltan:
            raise ToolError(
                f"Faltan datos de la credencial nueva: {', '.join(faltan)}. Pregúntaselos al usuario "
                "con un formulario en el chat (nombre corto para identificarla, y para qué sirve) y "
                "vuelve a llamar a crear_credencial_gd con esos datos ya rellenos en sus parámetros. "
                "El valor de la credencial en sí no lo pidas aquí — esta tool te dará un enlace para eso."
            )
        if await credenciales.obtener_por_nombre(nombre):
            raise ToolError(f'Ya existe una credencial llamada "{nombre}"')

        url_publica = os.environ.get("GD_URL_PUBLICA")
        if not url_publica:
            raise ToolError(
                "Este servidor no tiene configurada GD_URL_PUBLICA — no se puede generar el enlace "
                "del formulario. Avisa a soporte, no es algo que el cliente pueda arreglar."
            )

        token = generar_token()
        await SolicitudesCredencialCRUD(config).crear(nombre, descripcion, usuario or None, token)
        enlace = f"{url_publica.rstrip('/')}/v1/proyectos/{proyecto['id']}/credenciales/solicitudes/{token}"
        return {
            "enlace": enlace,
            "instrucciones": (
                "Dile al usuario que abra este enlace en su navegador para escribir el valor de la "
                "credencial — el formulario es del propio servidor, caduca en 15 minutos y solo se "
                "puede usar una vez. La credencial queda creada en cuanto lo rellene ahí; no hace "
                "falta volver a llamar a esta tool ni preguntarle el valor por chat."
            ),
        }

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
