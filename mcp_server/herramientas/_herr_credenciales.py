"""Herramienta MCP de solo lectura de metadatos de gd_credenciales — ver
docs/gestion-documental.md → "Credenciales". El valor nunca se expone por
aquí: se gestiona solo desde el panel (panel_cliente/servidor.py), para que
un secreto no quede escrito en la conversación del cliente con su IA."""

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config

from ..database.modelos._mod_credenciales import CredencialesCRUD


@mcp_app.tool()
async def listar_credenciales_gd() -> list[dict]:
    """Credenciales disponibles para este proyecto: nombre, para qué sirve
    y el usuario (si esta credencial lo lleva) — nunca la contraseña/API
    key. Se dan de alta y se cambian solo desde el panel, no por
    conversación con la IA."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    return await CredencialesCRUD(config).listar_metadatos()
