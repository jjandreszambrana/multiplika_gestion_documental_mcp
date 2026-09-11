"""Herramientas MCP de la tabla de estilos — ver docs/gestion-documental.md
→ "Tabla de estilos". Los tipos de informe y sus instrucciones se dan de
alta desde el panel (panel_cliente/servidor.py); aquí solo se leen."""

from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import Image

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config

from ..database.modelos._mod_estilos import EstilosCRUD, EstilosImagenesCRUD


@mcp_app.tool()
async def listar_estilos_informe_gd() -> list[dict]:
    """Tipos de informe disponibles para este proyecto (p.ej. "informe_mensual",
    "memoria_anual"). Usa obtener_estilo_informe_gd(nombre_tipo) para ver
    cómo construir uno en concreto."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])
    return await EstilosCRUD(config).listar_tipos()


@mcp_app.tool()
async def obtener_estilo_informe_gd(nombre_tipo: str) -> list:
    """Instrucciones de cómo construir un informe de este tipo, seguidas de
    sus imágenes fijas (logo, plantilla...), cada una precedida por su
    nombre y para qué sirve — así sabes cuál es cuál y dónde va cada una
    en el informe."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])

    estilo = await EstilosCRUD(config).obtener_por_tipo(nombre_tipo)
    if not estilo:
        raise ToolError(f'No existe ningún estilo de informe llamado "{nombre_tipo}"')

    imagenes = await EstilosImagenesCRUD(config).listar_de_estilo(estilo["id"])

    resultado: list = [f'Instrucciones para "{nombre_tipo}":\n{estilo["instrucciones"]}']
    for img in imagenes:
        resultado.append(f'Imagen "{img["nombre"]}" — {img["descripcion_uso"]}:')
        formato = img["tipo_mime"].split("/", 1)[-1]
        resultado.append(Image(data=bytes(img["imagen"]), format=formato))
    return resultado
