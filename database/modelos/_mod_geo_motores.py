"""Preguntar a otras IAs (ChatGPT, Gemini, Perplexity) para el seguimiento
del GEO (_mod_geo.py). Cada una con la clave del propio cliente, guardada
como credencial de la GD con el nombre «openai», «gemini» o «perplexity»;
sin clave, esa IA no se mide. El coste va a la cuenta del cliente.

Llamadas HTTP sencillas a sus APIs con búsqueda web activada. Los modelos se
pueden cambiar por entorno (cambian a menudo): [COMPROBAR] en el plan."""

import os

import httpx

MODELO_OPENAI = os.environ.get("GD_GEO_MODELO_OPENAI", "gpt-5-mini")
MODELO_GEMINI = os.environ.get("GD_GEO_MODELO_GEMINI", "gemini-2.5-flash")
MODELO_PERPLEXITY = os.environ.get("GD_GEO_MODELO_PERPLEXITY", "sonar")
URL_OPENAI = os.environ.get("GD_URL_OPENAI", "https://api.openai.com/v1")
URL_GEMINI = os.environ.get("GD_URL_GEMINI", "https://generativelanguage.googleapis.com/v1beta")
URL_PERPLEXITY = os.environ.get("GD_URL_PERPLEXITY", "https://api.perplexity.ai")
TIMEOUT = 120


async def _post(url: str, cuerpo: dict, cabeceras: dict | None = None, params: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(url, json=cuerpo, headers=cabeceras, params=params)
    if r.status_code >= 400:
        try:
            mensaje = r.json().get("error", {}).get("message")
        except (ValueError, AttributeError):
            mensaje = None
        raise RuntimeError(f"error {r.status_code}: {mensaje or r.text[:200]}")
    return r.json()


async def chatgpt(clave: str, pregunta: str) -> dict:
    datos = await _post(f"{URL_OPENAI}/responses", {"model": MODELO_OPENAI, "input": pregunta, "tools": [{"type": "web_search"}]},
                        {"Authorization": f"Bearer {clave}"})
    textos, urls = [], []
    for item in datos.get("output", []):
        for parte in item.get("content", []) or []:
            if parte.get("type") == "output_text":
                textos.append(parte.get("text", ""))
                urls += [a["url"] for a in parte.get("annotations", []) if a.get("url")]
    return {"texto": "".join(textos), "urls": list(dict.fromkeys(urls)), "modelo": MODELO_OPENAI}


async def gemini(clave: str, pregunta: str) -> dict:
    datos = await _post(f"{URL_GEMINI}/models/{MODELO_GEMINI}:generateContent",
                        {"contents": [{"parts": [{"text": pregunta}]}], "tools": [{"google_search": {}}]},
                        {"x-goog-api-key": clave})
    candidato = (datos.get("candidates") or [{}])[0]
    texto = "".join(p.get("text", "") for p in (candidato.get("content") or {}).get("parts", []))
    trozos = (candidato.get("groundingMetadata") or {}).get("groundingChunks", [])
    urls = [t["web"]["uri"] for t in trozos if (t.get("web") or {}).get("uri")]
    # Gemini da enlaces de redirección; el título suele ser el dominio real
    urls += [f"https://{t['web']['title']}" for t in trozos if (t.get("web") or {}).get("title", "").count(".")]
    return {"texto": texto, "urls": list(dict.fromkeys(urls)), "modelo": MODELO_GEMINI}


async def perplexity(clave: str, pregunta: str) -> dict:
    datos = await _post(f"{URL_PERPLEXITY}/chat/completions", {"model": MODELO_PERPLEXITY, "messages": [{"role": "user", "content": pregunta}]},
                        {"Authorization": f"Bearer {clave}"})
    texto = ((datos.get("choices") or [{}])[0].get("message") or {}).get("content", "")
    urls = list(datos.get("citations") or []) + [r["url"] for r in datos.get("search_results") or [] if r.get("url")]
    return {"texto": texto, "urls": list(dict.fromkeys(urls)), "modelo": MODELO_PERPLEXITY}


MOTORES = {"chatgpt": ("openai", chatgpt), "gemini": ("gemini", gemini), "perplexity": ("perplexity", perplexity)}
