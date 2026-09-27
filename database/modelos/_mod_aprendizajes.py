"""Aprendizajes de la central — ver docs/gestion-documental.md →
"Aprendizaje de la central a partir de las enlazadas". Flujo:
candidato (resumen) → vía libre (la IA anonimiza) → pendiente_revision
→ aprobado (documento normal de esta central) o rechazado.

La IA es la de ESTA central (su clave y modelo de Claude, configurados
en el panel de administración del núcleo), y cada llamada queda apuntada
en gd_uso_enlaces con sus tokens y coste para repercutirlo a la GD de
origen. Mismo cliente y patrón que panel_cliente/chat_ia.py."""

import json
from datetime import datetime, timezone

import anthropic
from database.config_db import get_anthropic_api_key, get_anthropic_modelo
from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_aprendizajes import (
    ESTADO_APROBADO,
    ESTADO_CANDIDATO,
    ESTADO_PENDIENTE_REVISION,
    ESTADO_RECHAZADO,
    TABLA_APRENDIZAJES,
)
from ._mod_enlaces import UsoEnlacesCRUD

# USD por millón de tokens (entrada, salida) — las mismas cifras que enseña
# el selector de modelo del panel de administración (MODELOS_ANTHROPIC del
# núcleo). Un modelo que no esté aquí se apunta con coste 0 y su nombre,
# para que se vea que falta la tarifa en vez de inventarla.
TARIFAS_USD_POR_MILLON = {
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
MAX_TOKENS_RESUMEN = 1024
MAX_TOKENS_ANONIMIZACION = 64000  # el documento entero vuelve reescrito: va en streaming

PROMPT_RESUMEN = (
    "Resume en un párrafo de 3 a 5 frases, en español, de qué trata este documento y para qué "
    "podría servirle a otra empresa del mismo sector. No incluyas nombres de personas, empresas, "
    "direcciones, matrículas, números de expediente ni ningún dato que identifique de quién es el "
    "documento: descríbelo en genérico. Devuelve solo el párrafo."
)
PROMPT_ANONIMIZACION = (
    "Vas a preparar una copia de este documento para una base de conocimiento compartida entre "
    "varias empresas del mismo sector. Reescríbelo COMPLETO, en el mismo markdown y con la misma "
    "estructura, sustituyendo todo dato que permita identificar a una persona, empresa u organización "
    "concreta por un término genérico: nombres y apellidos → 'el responsable', 'la inspectora', "
    "'el cliente'...; razones sociales y marcas → 'la empresa', 'el proveedor'...; direcciones, "
    "teléfonos, emails, NIF/CIF, matrículas, números de expediente, lote, cuenta o contrato → "
    "'la dirección', 'el número de expediente'...; nombres de poblaciones pequeñas o calles → 'la "
    "localidad', 'la calle'. Conserva íntegros los datos generales que no identifican a nadie "
    "(normativa citada, plazos, importes, procedimientos, organismos públicos).\n\n"
    "Responde ÚNICAMENTE con un JSON con dos claves: \"markdown\" (el documento reescrito) y "
    "\"sustituciones\" (lista de textos cortos que describen POR TIPO qué se sustituyó, p.ej. "
    "\"2 nombres de persona → el responsable, la inspectora\"; NUNCA incluyas los valores originales)."
)


def _coste_usd(modelo: str, tokens_entrada: int, tokens_salida: int) -> float:
    entrada, salida = TARIFAS_USD_POR_MILLON.get(modelo, (0.0, 0.0))
    return (tokens_entrada * entrada + tokens_salida * salida) / 1_000_000


async def _pedir_a_claude(id_proyecto: int, instruccion: str, documento: str, max_tokens: int) -> tuple[str, dict]:
    """(texto de respuesta, uso) — `uso` ya trae tokens, modelo y coste,
    listo para gd_uso_enlaces."""
    clave = await get_anthropic_api_key(id_proyecto)
    if not clave:
        raise ValueError("Esta empresa no tiene configurada una clave de API de Claude (panel de administración → Configuración de IA)")
    modelo = await get_anthropic_modelo(id_proyecto)
    cliente = anthropic.AsyncAnthropic(api_key=clave)
    mensajes = [{"role": "user", "content": f"{instruccion}\n\n<documento>\n{documento}\n</documento>"}]
    async with cliente.messages.stream(model=modelo, max_tokens=max_tokens, messages=mensajes) as flujo:
        respuesta = await flujo.get_final_message()
    texto = "".join(b.text for b in respuesta.content if b.type == "text").strip()
    entrada = respuesta.usage.input_tokens + (respuesta.usage.cache_read_input_tokens or 0)
    salida = respuesta.usage.output_tokens
    uso = {"tokens_entrada": entrada, "tokens_salida": salida, "modelo": modelo,
           "coste_estimado": _coste_usd(modelo, entrada, salida)}
    return texto, uso


def _extraer_json(texto: str) -> dict:
    """La respuesta debería ser JSON puro; si viene envuelto en ```json o
    con texto alrededor, se rescata el primer objeto {...}."""
    inicio, fin = texto.find("{"), texto.rfind("}")
    if inicio == -1 or fin == -1:
        raise ValueError("La IA no devolvió el JSON esperado")
    return json.loads(texto[inicio:fin + 1])


class AprendizajesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_APRENDIZAJES, config)

    async def obtener_por_origen(self, id_enlace: int, id_documento_origen: int) -> dict | None:
        filas, _ = await self.listar(filtros={
            "id_enlace": {"op": "=", "valor": id_enlace},
            "id_documento_origen": {"op": "=", "valor": id_documento_origen},
        }, limit=1)
        return filas[0] if filas else None

    async def listar_por_estado(self, estado: str | None = None) -> list[dict]:
        filtros = {"estado": {"op": "=", "valor": estado}} if estado else None
        filas, _ = await self.listar(filtros=filtros, orden="fecha_actualizacion DESC", limit=500)
        return [{k: v for k, v in f.items() if k != "markdown_anonimizado"} for f in filas]

    async def _cambiar(self, id_aprendizaje: int, cambios: dict) -> dict:
        await self.update(id_aprendizaje, {**cambios, "fecha_actualizacion": datetime.now(timezone.utc)})
        return await self.obtener(id_aprendizaje)

    async def crear_candidato(self, id_proyecto: int, enlace: dict, documento: dict) -> dict:
        """`documento` = lo que devolvió obtener_documento_completo_gd de la
        GD de origen. Su markdown solo se usa para resumir: no se guarda."""
        resumen, uso = await _pedir_a_claude(id_proyecto, PROMPT_RESUMEN, documento["markdown"], MAX_TOKENS_RESUMEN)
        await UsoEnlacesCRUD(self.config).registrar(enlace["nombre"], "resumen", **uso)
        id_aprendizaje = await self.insert({
            "id_enlace": enlace["id"], "origen": enlace["nombre"], "id_documento_origen": documento["id_documento"],
            "nombre": documento["nombre"], "tipo_documento": documento["tipo_documento"],
            "fecha_documento": documento.get("fecha_documento"), "resumen": resumen,
        })
        return await self.obtener(id_aprendizaje)

    async def anonimizar(self, id_proyecto: int, aprendizaje: dict, markdown_original: str) -> dict:
        """Vía libre: la IA reescribe el documento sin datos identificativos
        y queda pendiente de que una persona lo revise."""
        texto, uso = await _pedir_a_claude(id_proyecto, PROMPT_ANONIMIZACION, markdown_original, MAX_TOKENS_ANONIMIZACION)
        await UsoEnlacesCRUD(self.config).registrar(aprendizaje["origen"], "anonimizacion", **uso)
        try:
            datos = _extraer_json(texto)
            markdown, sustituciones = datos["markdown"], list(datos.get("sustituciones") or [])
        except (ValueError, KeyError, json.JSONDecodeError):
            # Mejor entregar el texto tal cual a la revisión humana que perder
            # la llamada: el admin verá que falta la lista de sustituciones.
            markdown, sustituciones = texto, ["(la IA no devolvió la lista de sustituciones — revisa el texto con más cuidado)"]
        return await self._cambiar(aprendizaje["id"], {
            "markdown_anonimizado": markdown, "sustituciones": json.dumps(sustituciones, ensure_ascii=False),
            "estado": ESTADO_PENDIENTE_REVISION,
        })

    async def editar_markdown(self, id_aprendizaje: int, markdown: str) -> dict:
        return await self._cambiar(id_aprendizaje, {"markdown_anonimizado": markdown})

    async def marcar_aprobado(self, id_aprendizaje: int, id_documento_creado: int) -> dict:
        return await self._cambiar(id_aprendizaje, {"estado": ESTADO_APROBADO, "id_documento_creado": id_documento_creado})

    async def rechazar(self, id_aprendizaje: int, motivo: str | None) -> dict:
        return await self._cambiar(id_aprendizaje, {"estado": ESTADO_RECHAZADO, "motivo_rechazo": motivo})

    async def volver_a_candidato(self, id_aprendizaje: int) -> dict:
        return await self._cambiar(id_aprendizaje, {"estado": ESTADO_CANDIDATO, "motivo_rechazo": None})
