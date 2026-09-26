"""Extracción de texto de un documento pendiente (PDF o imagen suelta),
SIN pasar por ningún LLM — es la vista previa instantánea y gratis que
el cliente puede ver antes de decidir si quiere que la IA lo
estructure (ver docs/gestion-documental.md → "Documentos pendientes").

Primer tanteo, pensado para iterar: heurística simple para decidir
cuándo una página de PDF es en realidad un escaneo (poca letra real
extraída) y hace falta OCR de respaldo con Tesseract.
"""

import io

import pdfplumber
import pytesseract
from PIL import Image

IDIOMA_OCR = "spa"
RESOLUCION_OCR = 200  # dpi al renderizar la página como imagen para Tesseract
UMBRAL_CARACTERES_ESCANEADO = 30  # menos texto real que esto -> se trata como escaneo


def _ocr_de_imagen(imagen: Image.Image) -> str:
    return pytesseract.image_to_string(imagen, lang=IDIOMA_OCR).strip()


def extraer_texto_pdf(datos: bytes) -> list[dict]:
    """Texto de cada página: directo si el PDF tiene texto real, o vía
    OCR si esa página parece un escaneo. Lanza ValueError (mensaje
    claro) si el PDF está corrupto o no tiene páginas."""
    try:
        pdf = pdfplumber.open(io.BytesIO(datos))
    except Exception as e:
        raise ValueError(f"No se pudo leer el PDF: {e}") from e

    with pdf:
        if not pdf.pages:
            raise ValueError("El PDF no tiene páginas")

        paginas = []
        for numero, pagina in enumerate(pdf.pages, start=1):
            texto = (pagina.extract_text() or "").strip()
            via = "texto"
            if len(texto) < UMBRAL_CARACTERES_ESCANEADO:
                imagen = pagina.to_image(resolution=RESOLUCION_OCR).original
                texto_ocr = _ocr_de_imagen(imagen)
                if texto_ocr:
                    texto, via = texto_ocr, "ocr"
            paginas.append({"numero_pagina": numero, "texto": texto, "via": via})
        return paginas


def extraer_texto_imagen(datos: bytes) -> list[dict]:
    """Una imagen suelta (no PDF) se trata como una única "página", vía
    OCR directo — nunca se intenta pdfplumber con algo que no es un PDF."""
    try:
        imagen = Image.open(io.BytesIO(datos))
        imagen.load()
    except Exception as e:
        raise ValueError(f"No se pudo leer la imagen: {e}") from e
    return [{"numero_pagina": 1, "texto": _ocr_de_imagen(imagen), "via": "ocr"}]


def extraer_texto(datos: bytes, tipo_mime: str) -> list[dict]:
    """Punto de entrada único, según el tipo_mime guardado en
    gd_documentos_pendientes."""
    if tipo_mime == "application/pdf":
        return extraer_texto_pdf(datos)
    if tipo_mime.startswith("image/"):
        return extraer_texto_imagen(datos)
    raise ValueError(f"Tipo de fichero no soportado para extracción: {tipo_mime}")


def texto_unido(paginas: list[dict]) -> str:
    """Junta las páginas en un único string, con separadores, para
    mostrarlo como vista previa o para mandarlo a la IA a estructurar."""
    bloques = []
    for p in paginas:
        aviso_ocr = " (vía OCR)" if p["via"] == "ocr" else ""
        cabecera = f"--- Página {p['numero_pagina']}{aviso_ocr} ---"
        cuerpo = p["texto"] or "(sin texto detectado en esta página)"
        bloques.append(f"{cabecera}\n{cuerpo}")
    return "\n\n".join(bloques)
