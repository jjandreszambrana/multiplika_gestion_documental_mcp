"""Herramientas MCP de gd_credenciales — ver docs/gestion-documental.md →
"Credenciales". El valor de una credencial nunca pasa por esta
conversación: listar_credenciales_gd nunca lo devuelve, y
crear_credencial_gd lo pide con un formulario (ver Context.elicit de
FastMCP) en vez de como parámetro de la tool, precisamente para que un
secreto no quede escrito en ningún mensaje del cliente ni de la IA. Editar
o borrar una credencial ya creada sigue siendo solo desde el panel
(panel_cliente/servidor.py) — no hay tool para eso.

Si el cliente MCP conectado no declaró soporte de elicitation (ver
_capacidades_elicitacion.py), o el intento de formulario falla: tampoco
entonces se le pide el valor por chat ni se pasa como parámetro de la
tool. En su lugar se genera un enlace de un solo uso a un formulario
propio del panel (panel_cliente/servidor.py → "Formulario de
credencial"), que el valor solo toca al llegar de ahí directamente a
gd_credenciales — nunca pasa por esta tool ni por ningún mensaje a la
IA. `nombre` y `descripcion` (no son secretos) sí se aceptan como
parámetros de la tool en ese caso."""

import os

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp import Context
from fastmcp.exceptions import ToolError
from mcp.shared.exceptions import MCPError
from pydantic import BaseModel, Field

from ._anotaciones import SOLO_LECTURA
from ._capacidades_elicitacion import puede_elicitar_formulario
from ..database.modelos._mod_credenciales import NOMBRES_RESERVADOS, CredencialesCRUD
from ..database.modelos._mod_solicitudes_credencial import SolicitudesCredencialCRUD, generar_token


@mcp_app.tool(annotations=SOLO_LECTURA)
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
    """Da de alta una credencial nueva (contraseña, API key...). Pásale
    `nombre` (para identificarla) y `descripcion` (para qué sirve) —
    pregúntaselos al usuario por chat si no los tienes. El valor de la
    credencial en sí no lo pidas tú ni lo escribas en esta conversación
    bajo ningún concepto: si el cliente MCP soporta formularios
    (elicitation), esta tool le lanza uno para que el usuario lo escriba
    directamente y llegue cifrado sin pasar por la IA; si no los soporta,
    o el formulario falla, la tool te devuelve en su lugar un enlace de un
    solo uso (caduca en 15 minutos) a un formulario propio del panel —
    dile al usuario que lo abra en su navegador. Si consulta antes
    listar_credenciales_gd y ya existe una con ese nombre, la tool falla
    con un aviso. Si el cliente cierra el formulario sin rellenarlo, o
    faltan `nombre`/`descripcion` y no hay formulario disponible, dile que
    no se ha creado nada y, en este último caso, pregúntaselos por chat y
    vuelve a llamar a esta tool.

    Para una cuenta de correo (la que luego usan listar_correos_gd y
    compañía): usuario = la dirección de correo, valor = su contraseña (en
    Gmail, una contraseña de aplicación). Los campos avanzados que alguna
    necesita (`imap_host`, o `tenant_id`/`client_id`/`client_secret` en
    Microsoft 365) no caben en este formulario: se añaden después desde el
    panel."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    credenciales = CredencialesCRUD(config)

    if puede_elicitar_formulario(ctx):
        try:
            resultado = await ctx.elicit(
                "Datos de la credencial nueva. El valor se guarda cifrado y no se te mostrará a ti ni a la IA.",
                response_type=_DatosCredencialNueva,
            )
        except (ToolError, MCPError):
            resultado = None
        if resultado is not None:
            if resultado.action != "accept":
                raise ToolError("El cliente no ha rellenado el formulario — no se ha creado ninguna credencial.")
            datos = resultado.data
            if datos.nombre in NOMBRES_RESERVADOS or await credenciales.obtener_por_nombre(datos.nombre):
                raise ToolError(f'Ya existe una credencial llamada "{datos.nombre}"')
            id_credencial = await credenciales.crear(datos.nombre, datos.descripcion, datos.valor, datos.usuario or None)
            fila = await credenciales.obtener(id_credencial)
            return {k: v for k, v in fila.items() if k != "valor_cifrado"}

    faltan = [campo for campo, valor in [("nombre", nombre), ("descripcion", descripcion)] if not valor]
    if faltan:
        raise ToolError(
            f"Faltan datos de la credencial nueva: {', '.join(faltan)}. Pregúntaselos al usuario "
            "con un formulario en el chat (nombre corto para identificarla, y para qué sirve) y "
            "vuelve a llamar a crear_credencial_gd con esos datos ya rellenos en sus parámetros. "
            "El valor de la credencial en sí no lo pidas aquí — esta tool te dará un enlace para eso."
        )
    if nombre in NOMBRES_RESERVADOS or await credenciales.obtener_por_nombre(nombre):
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
