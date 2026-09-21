"""Herramienta MCP para exportar un informe a PDF — ver
docs/gestion-documental.md → "Exportar un informe a PDF". Sencillo para
empezar (2026-09-10): markdown -> HTML -> PDF con `markdown` + WeasyPrint,
sin maquetación compleja. El render en sí (subproceso con el LD_PRELOAD
de libffi) vive en `database/modelos/_mod_pdf.py`, compartido con el
botón "Descargar PDF" del panel — ver ese módulo para el motivo."""

import base64

import markdown as md
from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import File

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_estilos import EstilosCRUD, EstilosImagenesCRUD
from ..database.modelos._mod_pdf import CSS_INFORME, renderizar_pdf


@mcp_app.tool(annotations=SOLO_LECTURA)
async def generar_informe_pdf_gd(
    markdown: str, nombre_archivo: str, nombre_tipo_estilo: str | None = None
) -> list:
    """Convierte a PDF un informe en markdown que acabas de escribir, y te
    lo entrega directamente (sin pasar por el panel) para que se lo pases
    al cliente. Formato sencillo — texto formateado, sin maquetación
    compleja. Si indicas `nombre_tipo_estilo` (uno de
    listar_estilos_informe_gd()), incrusta sus imágenes fijas (logo...) al
    principio del PDF."""
    proyecto = await resolver_proyecto_actual()
    config = get_db_config(proyecto["id"])

    imagenes_html = ""
    if nombre_tipo_estilo:
        estilo = await EstilosCRUD(config).obtener_por_tipo(nombre_tipo_estilo)
        if estilo:
            imagenes = await EstilosImagenesCRUD(config).listar_de_estilo(estilo["id"])
            for img in imagenes:
                b64 = base64.b64encode(bytes(img["imagen"])).decode()
                imagenes_html += f'<img class="imagen-informe" src="data:{img["tipo_mime"]};base64,{b64}">'

    cuerpo_html = md.markdown(markdown, extensions=["tables"])
    html_completo = f"<html><head><style>{CSS_INFORME}</style></head><body>{imagenes_html}{cuerpo_html}</body></html>"
    try:
        pdf_bytes = await renderizar_pdf(html_completo)
    except RuntimeError as e:
        raise ToolError(str(e)) from e

    nombre = nombre_archivo if nombre_archivo.lower().endswith(".pdf") else f"{nombre_archivo}.pdf"
    return [f'Informe "{nombre}" generado.', File(data=pdf_bytes, format="pdf", name=nombre)]
