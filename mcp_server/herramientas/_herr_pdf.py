"""Herramienta MCP para exportar un informe a PDF — ver
docs/gestion-documental.md → "Exportar un informe a PDF". Sencillo para
empezar (2026-09-10): markdown -> HTML -> PDF con `markdown` + WeasyPrint,
sin maquetación compleja.

El render corre en un subproceso aparte, con LD_PRELOAD del libffi del
sistema — el proceso principal del servidor MCP corre en el entorno conda
compartido de todos los proyectos, cuyo libffi propio no es compatible con
el que necesita el libgobject del sistema que usa WeasyPrint (fallo real
encontrado al desplegar: "undefined symbol: ffi_type_uint32, version
LIBFFI_BASE_7.0"). Aislarlo en un subproceso evita tocar el entorno del
servidor completo (compartido por todas las herramientas de todos los
proyectos) solo por esta dependencia."""

import asyncio
import base64
import os
import sys

import markdown as md
from fastmcp.exceptions import ToolError
from fastmcp.utilities.types import File

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config

from ..database.modelos._mod_estilos import EstilosCRUD, EstilosImagenesCRUD

_CSS_BASE = """
    body { font-family: sans-serif; font-size: 11pt; line-height: 1.5; color: #222; }
    img.imagen-informe { max-height: 80px; margin-bottom: 1em; display: block; }
    h1, h2, h3 { color: #111; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; }
"""

_LIBFFI_SISTEMA = "/usr/lib/x86_64-linux-gnu/libffi.so.7"


async def _render_pdf(html_completo: str) -> bytes:
    env = dict(os.environ)
    if os.path.exists(_LIBFFI_SISTEMA):
        env["LD_PRELOAD"] = _LIBFFI_SISTEMA

    proceso = await asyncio.create_subprocess_exec(
        sys.executable, "-c",
        "import sys; from weasyprint import HTML; "
        "sys.stdout.buffer.write(HTML(string=sys.stdin.read()).write_pdf())",
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    pdf_bytes, error = await proceso.communicate(html_completo.encode("utf-8"))
    if proceso.returncode != 0:
        raise ToolError(f"No se pudo generar el PDF: {error.decode(errors='replace')[-500:]}")
    return pdf_bytes


@mcp_app.tool()
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
    config = get_db_config(proyecto["slug"])

    imagenes_html = ""
    if nombre_tipo_estilo:
        estilo = await EstilosCRUD(config).obtener_por_tipo(nombre_tipo_estilo)
        if estilo:
            imagenes = await EstilosImagenesCRUD(config).listar_de_estilo(estilo["id"])
            for img in imagenes:
                b64 = base64.b64encode(bytes(img["imagen"])).decode()
                imagenes_html += f'<img class="imagen-informe" src="data:{img["tipo_mime"]};base64,{b64}">'

    cuerpo_html = md.markdown(markdown, extensions=["tables"])
    html_completo = f"<html><head><style>{_CSS_BASE}</style></head><body>{imagenes_html}{cuerpo_html}</body></html>"
    pdf_bytes = await _render_pdf(html_completo)

    nombre = nombre_archivo if nombre_archivo.lower().endswith(".pdf") else f"{nombre_archivo}.pdf"
    return [f'Informe "{nombre}" generado.', File(data=pdf_bytes, format="pdf", name=nombre)]
