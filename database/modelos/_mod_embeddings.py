"""Chunking de markdown por encabezados y cliente de embeddings — soporta
Mistral (proveedor por defecto) y OpenAI, seleccionable por cliente en
gd_configuracion.proveedor_embedding (ver docs/gestion-documental.md →
"Fase 3"). Las claves de API las paga y gestiona la EMPRESA (tenant)
dueña del proyecto, desde el panel de administración del repo core
(mcpc_tenants) — no son globales de la plataforma."""

import re

from mistralai.client import Mistral
from openai import AsyncOpenAI

from ..dependencias._dep_configuracion import PROVEEDORES_EMBEDDING_SOPORTADOS


def chunkear_por_encabezados(markdown: str) -> list[str]:
    """Divide un markdown en trozos por cada encabezado (#, ##, ... al
    principio de línea). El texto antes del primer encabezado, si lo hay,
    es su propio chunk. Si no hay ningún encabezado, el documento entero
    es un único chunk."""
    partes = re.split(r"(?m)^(?=#{1,6}\s)", markdown)
    return [p.strip() for p in partes if p.strip()]


async def generar_embeddings(proveedor_embedding: str, api_key: str, textos: list[str]) -> list[list[float]]:
    """Un vector por cada texto de `textos`, en el mismo orden.
    `proveedor_embedding` es el valor de gd_configuracion.proveedor_embedding
    (ej. "mistral:mistral-embed", "openai:text-embedding-3-small")."""
    if proveedor_embedding not in PROVEEDORES_EMBEDDING_SOPORTADOS:
        raise ValueError(f"Proveedor de embeddings desconocido: '{proveedor_embedding}'")
    sdk, modelo = proveedor_embedding.split(":", 1)

    if sdk == "mistral":
        cliente = Mistral(api_key=api_key)
        respuesta = await cliente.embeddings.create_async(model=modelo, inputs=textos)
        return [dato.embedding for dato in respuesta.data]

    if sdk == "openai":
        cliente = AsyncOpenAI(api_key=api_key)
        respuesta = await cliente.embeddings.create(model=modelo, input=textos)
        return [dato.embedding for dato in respuesta.data]

    raise ValueError(f"No hay cliente implementado para el proveedor '{sdk}'")


async def obtener_api_key(proveedor_embedding: str, id_proyecto: int) -> str | None:
    """Resuelve la clave de API correspondiente al proveedor configurado,
    de la empresa (tenant) dueña del proyecto `id_proyecto` (repo core)."""
    from database.config_db import get_mistral_api_key, get_openai_api_key

    if proveedor_embedding not in PROVEEDORES_EMBEDDING_SOPORTADOS:
        raise ValueError(f"Proveedor de embeddings desconocido: '{proveedor_embedding}'")
    sdk, _ = proveedor_embedding.split(":", 1)

    if sdk == "mistral":
        return await get_mistral_api_key(id_proyecto)
    if sdk == "openai":
        return await get_openai_api_key(id_proyecto)
    raise ValueError(f"No hay clave configurable para el proveedor '{sdk}'")
