"""Preguntar a Claude, con búsqueda web, lo que preguntaría un cliente, para
el seguimiento del GEO (_mod_geo.py). Usa la clave de Anthropic y el modelo
que la empresa eligió en "Configuración de IA" (la misma que el chat del
panel): el coste va a su cuenta."""

import anthropic

from database.config_db import get_anthropic_api_key, get_anthropic_modelo

SISTEMA = ("Responde como lo harías a cualquier persona que te pregunta esto. Busca en internet si hace falta. "
           "Si recomiendas empresas o sitios, nómbralos.")


def _herramienta_busqueda(modelo: str) -> dict:
    # La variante con filtrado dinámico no está en los modelos Haiku
    tipo = "web_search_20250305" if "haiku" in modelo else "web_search_20260209"
    return {"type": tipo, "name": "web_search", "max_uses": 3, "user_location": {"type": "approximate", "country": "ES"}}


async def preguntar(id_proyecto: int, pregunta: str) -> dict:
    """{texto, urls, modelo}. Lanza RuntimeError si no se puede."""
    clave = await get_anthropic_api_key(id_proyecto)
    if not clave:
        raise RuntimeError("La empresa no tiene clave de Anthropic en «Configuración de IA»")
    modelo = await get_anthropic_modelo(id_proyecto)
    cliente = anthropic.AsyncAnthropic(api_key=clave)
    mensajes = [{"role": "user", "content": pregunta}]
    for _ in range(3):  # la búsqueda puede pausar el turno (pause_turn): se reanuda
        respuesta = await cliente.messages.create(
            model=modelo, max_tokens=4000, system=SISTEMA, messages=mensajes, tools=[_herramienta_busqueda(modelo)])
        if respuesta.stop_reason != "pause_turn":
            break
        mensajes = [{"role": "user", "content": pregunta}, {"role": "assistant", "content": respuesta.content}]
    if respuesta.stop_reason == "refusal":
        raise RuntimeError("Claude no ha querido responder a esta pregunta")
    textos, urls = [], []
    for bloque in respuesta.content:
        if bloque.type == "text":
            textos.append(bloque.text)
            for cita in getattr(bloque, "citations", None) or []:
                if getattr(cita, "url", None):
                    urls.append(cita.url)
        elif bloque.type == "web_search_tool_result" and isinstance(bloque.content, list):
            urls += [r.url for r in bloque.content if getattr(r, "url", None)]
    return {"texto": "".join(textos), "urls": list(dict.fromkeys(urls)), "modelo": modelo}
