"""Chunking de markdown por encabezados y cliente de embeddings de Mistral
(mistral-embed, 1024 dim — confirmado con una llamada real a la API, ver
docs/gestion-documental.md → "Fase 3"). La clave de API la gestiona el
panel de administración del repo core (mcpc_configuracion_plataforma)."""

import re

from mistralai.client import Mistral

MODELO_EMBEDDING = "mistral-embed"


def chunkear_por_encabezados(markdown: str) -> list[str]:
    """Divide un markdown en trozos por cada encabezado (#, ##, ... al
    principio de línea). El texto antes del primer encabezado, si lo hay,
    es su propio chunk. Si no hay ningún encabezado, el documento entero
    es un único chunk."""
    partes = re.split(r"(?m)^(?=#{1,6}\s)", markdown)
    return [p.strip() for p in partes if p.strip()]


async def generar_embeddings(api_key: str, textos: list[str]) -> list[list[float]]:
    """Un vector por cada texto de `textos`, en el mismo orden."""
    cliente = Mistral(api_key=api_key)
    respuesta = await cliente.embeddings.create_async(model=MODELO_EMBEDDING, inputs=textos)
    return [dato.embedding for dato in respuesta.data]
