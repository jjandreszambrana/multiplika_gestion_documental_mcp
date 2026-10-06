"""Qué archivos se guardan como original: solo documentos cuyo original
tiene sentido conservar (PDF, imágenes, Word, Excel) — nunca vídeos, audios
ni ejecutables, que solo engordan la base."""

import mimetypes

TIPOS_MIME_PERMITIDOS = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/csv",
}


def tipo_permitido(tipo_mime: str | None) -> bool:
    tipo = (tipo_mime or "").split(";")[0].strip().lower()
    return tipo in TIPOS_MIME_PERMITIDOS or tipo.startswith("image/")


def comprobar_tipo_archivo(tipo_mime: str | None, nombre: str | None) -> None:
    """Manda la extensión del nombre si se reconoce (el tipo que declara
    quien sube no siempre es fiable: la IA puede dejar el de por defecto);
    si no, el tipo declarado. ValueError si no es un documento admitido."""
    tipo = mimetypes.guess_type(nombre or "")[0] or tipo_mime
    if not tipo_permitido(tipo):
        raise ValueError(
            f'"{nombre}" no es un tipo de archivo admitido: solo PDF, imágenes, Word o Excel'
        )
