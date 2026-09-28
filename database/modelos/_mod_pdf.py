"""Render de HTML a PDF (WeasyPrint) compartido entre las herramientas
MCP (`mcp_server/herramientas/_herr_pdf.py`, informes que redacta la IA)
y el panel del cliente (`panel_cliente/servidor.py`, exportar un
documento tal cual está guardado) — vive en `database/` a propósito,
la única carpeta que `sincroniza_proyectos()` copia entera a los dos
árboles de despliegue (ver docs/gestion-documental.md → "Dónde vive el
contenido" de la ayuda, mismo motivo).

El render corre en un subproceso aparte, con LD_PRELOAD del libffi del
sistema — el proceso principal (tanto el servidor MCP como el panel)
corre en el entorno conda compartido de todos los proyectos, cuyo
libffi propio no es compatible con el que necesita el libgobject del
sistema que usa WeasyPrint (fallo real encontrado al desplegar:
"undefined symbol: ffi_type_uint32, version LIBFFI_BASE_7.0"). Aislarlo
en un subproceso evita tocar el entorno del proceso completo (compartido
por todas las herramientas de todos los proyectos) solo por esta
dependencia."""

import asyncio
import base64
import html
import os
import sys

import markdown as md

from ._mod_estilos import EstilosImagenesCRUD

_LIBFFI_SISTEMA = "/usr/lib/x86_64-linux-gnu/libffi.so.7"

# CSS de los informes que redacta la IA (generar_informe_pdf_gd) — sin
# cambios respecto al original, no tocar sin revisar ese flujo.
CSS_INFORME = """
    body { font-family: sans-serif; font-size: 11pt; line-height: 1.5; color: #222; }
    img.imagen-informe { max-height: 80px; margin-bottom: 1em; display: block; }
    h1, h2, h3 { color: #111; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; }
"""

# CSS para exportar un documento tal cual está guardado (panel, botón
# "Descargar PDF") — pensado para impresión/lectura en papel, no para
# pantalla: texto de cuerpo en negro/gris oscuro (en pantalla usamos gris
# "dimmed" de baja intensidad, que en papel se lee mal), sin depender de
# las tipografías web del panel (WeasyPrint no las tiene cargadas).
CSS_DOCUMENTO = """
    body { font-family: Georgia, "Times New Roman", serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; }
    h1, h2, h3, h4, h5, h6 { font-family: Helvetica, Arial, sans-serif; font-weight: 700; color: #111; }
    h1 { font-size: 20pt; margin: 0 0 0.4em; }
    h2 { font-size: 15pt; margin: 1.6em 0 0.5em; }
    h3 { font-size: 12.5pt; margin: 1.3em 0 0.4em; }
    h4, h5, h6 { font-size: 11pt; margin: 1.1em 0 0.3em; }
    p, li { margin: 0 0 0.6em; }
    strong { font-weight: 700; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
    blockquote { margin: 0.8em 0; padding: 0.1em 1em; border-left: 3px solid #999; color: #444; font-style: italic; }
    code { font-family: "Courier New", monospace; font-size: 0.92em; background: #f0f0f0; padding: 1px 4px; }
    pre { background: #f0f0f0; padding: 0.8em 1em; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 10.5pt; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 700; }
    img.imagen-informe { max-height: 80px; margin-bottom: 1em; display: block; }
"""


async def imagenes_estilo_html(config: dict, id_estilo: int) -> str:
    """HTML con las imágenes fijas de un estilo (logo...) listas para
    incrustar al principio de un PDF — compartido entre
    generar_informe_pdf_gd y la exportación a PDF de un documento desde
    el panel."""
    imagenes = await EstilosImagenesCRUD(config).listar_de_estilo(id_estilo)
    html = ""
    for img in imagenes:
        b64 = base64.b64encode(bytes(img["imagen"])).decode()
        html += f'<img class="imagen-informe" src="data:{img["tipo_mime"]};base64,{b64}">'
    return html


async def renderizar_pdf(html_completo: str) -> bytes:
    """Convierte un documento HTML completo (con <html>/<head>/<body>) a
    PDF. Lanza RuntimeError con la salida de error de WeasyPrint si el
    subproceso falla — el llamador decide cómo traducirlo (ToolError en
    una tool MCP, HTTPException en un endpoint del panel)."""
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
        raise RuntimeError(f"No se pudo generar el PDF: {error.decode(errors='replace')[-500:]}")
    return pdf_bytes


async def pdf_de_documento(config: dict, documento: dict, version: dict, incluir_metadatos: bool = False) -> bytes:
    """PDF de una versión de un documento, con el mismo formato (títulos,
    tablas, negritas...) que se ve en el panel y las imágenes de su estilo
    de informe — compartido entre el botón "Descargar PDF" del panel y los
    enlaces para compartir (_mod_compartidos.py). Con incluir_metadatos
    añade un pie de página (nombre, tipo, ámbito, fecha) repetido en cada
    hoja, vía el mecanismo "running element" de CSS que entiende
    WeasyPrint."""
    imagenes_html = ""
    if documento["id_estilo"]:
        imagenes_html = await imagenes_estilo_html(config, documento["id_estilo"])

    pie_html = ""
    css_pie = ""
    if incluir_metadatos:
        partes = [documento["nombre"], documento["tipo_documento"]]
        if documento["ambito"]:
            partes.append(documento["ambito"])
        fecha = version["fecha_documento"] or documento["fecha_alta"]
        if fecha:
            partes.append(fecha.strftime("%d/%m/%Y") if hasattr(fecha, "strftime") else str(fecha))
        texto_pie = html.escape(" · ".join(str(p) for p in partes))
        pie_html = f'<div class="pie-documento">{texto_pie}</div>'
        css_pie = """
            .pie-documento { position: running(pie-documento); font-size: 8pt; color: #888; }
            @page { @bottom-center { content: element(pie-documento); } }
        """

    cuerpo_html = md.markdown(version["markdown_actual"], extensions=["tables"])
    titulo_html = html.escape(documento["nombre"])
    return await renderizar_pdf(
        f"<html><head><meta charset='utf-8'><title>{titulo_html}</title>"
        f"<style>{CSS_DOCUMENTO}{css_pie}</style></head>"
        f"<body>{pie_html}{imagenes_html}{cuerpo_html}</body></html>"
    )
