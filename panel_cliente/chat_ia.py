"""Orquesta el chat de IA de gestión documental.

Llama al servidor MCP propio ya desplegado como un cliente más — igual
que Claude Desktop — con una API key interna por proyecto y rol (ver
`clave_interna_proyecto` del core: nunca se le enseña a nadie, solo la
usa este backend). Y llama a la API de Anthropic con la clave y el
modelo que cada empresa eligió desde el panel de administración
("Configuración de IA").

Una acción que escribe datos (cualquier herramienta sin
`readOnlyHint`, ver mcp_server/herramientas/_anotaciones.py) no se
ejecuta sola: se propone y espera una confirmación explícita del
cliente (ver `enviar_mensaje` / `confirmar`). El estado pendiente de
confirmar vive en memoria del proceso — se pierde si el panel se
reinicia a medias de una confirmación, aceptable para una v1 (bajo
volumen, el cliente simplemente repite la pregunta)."""

import json
import uuid

import anthropic
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

from config import get_mcp_url_local
from database.config_db import (
    clave_interna_proyecto,
    get_anthropic_api_key,
    get_anthropic_modelo,
    get_db_config,
)
from lib.roles_proyecto import ID_ROL_INVITADO, ID_ROL_OPERADOR

from ..database.modelos._mod_chat import ChatConversacionesCRUD

SYSTEM_PROMPT = (
    "Eres el asistente de gestión documental de esta empresa, dentro de su propio panel. "
    "Solo respondes preguntas y haces acciones sobre SUS documentos, entidades, envíos y "
    "registros, usando exclusivamente las herramientas que tienes disponibles — no tienes "
    "acceso a nada fuera de ellas (ni navegación web, ni conocimiento de otros clientes ni "
    "de otras empresas). Si te piden algo que no puedes hacer con estas herramientas, dilo "
    "claramente en vez de inventar una respuesta."
)

MAX_TURNOS_HERRAMIENTA = 8  # llamadas a herramientas de solo lectura encadenadas antes de rendirse
MAX_TOKENS_RESPUESTA = 16000  # incluye lo que gasta en pensar antes de responder o elegir herramienta

# confirmacion_id -> estado necesario para retomar el turno tras confirmar/rechazar
_PENDIENTES: dict[str, dict] = {}


async def _cliente_mcp(id_proyecto: int, id_rol: int) -> Client:
    nombre = "Chat interno (operador)" if id_rol == ID_ROL_OPERADOR else "Chat interno (invitado)"
    clave = await clave_interna_proyecto(id_proyecto, id_rol, nombre)
    transporte = StreamableHttpTransport(get_mcp_url_local(), headers={"x-api-key": clave})
    return Client(transporte)


def _bloques_a_dict(content) -> list[dict]:
    return [bloque.model_dump(exclude_none=True) for bloque in content]


async def _herramientas_anthropic(mcp: Client) -> tuple[list[dict], dict]:
    """(tools en formato Anthropic, {nombre: tool_mcp}) para poder mirar
    luego si una herramienta concreta es de solo lectura."""
    herramientas = await mcp.list_tools()
    por_nombre = {h.name: h for h in herramientas}
    tools = [
        {"name": h.name, "description": h.description or "", "input_schema": h.input_schema}
        for h in herramientas
    ]
    return tools, por_nombre


def _es_solo_lectura(tool_mcp) -> bool:
    return bool(tool_mcp.annotations and tool_mcp.annotations.read_only_hint)


async def _resultado_tool(mcp: Client, nombre: str, argumentos: dict) -> tuple[str, bool]:
    resultado = await mcp.call_tool(nombre, argumentos, raise_on_error=False)
    texto = "\n".join(b.text for b in resultado.content if getattr(b, "type", None) == "text")
    if not texto and resultado.structured_content is not None:
        texto = json.dumps(resultado.structured_content, ensure_ascii=False)
    return texto or "(sin salida)", bool(resultado.is_error)


_CACHE_EFIMERA = {"type": "ephemeral", "ttl": "1h"}


def _con_punto_de_cache(mensajes: list[dict]) -> list[dict]:
    """Copia `mensajes` marcando el final del último mensaje como punto
    de caché — Anthropic sirve desde caché (a ~1/10 del precio) todo lo
    que haya antes de ese punto en la próxima llamada con el mismo
    prefijo, en vez de volver a pagarlo entero. Como el historial solo
    crece (nunca se reescribe), cada turno nuevo mueve el punto un poco
    más adelante y el turno anterior entero sale de caché. Solo para la
    llamada a la API — no se guarda así en el historial (`mensajes` no
    se modifica, se devuelve una copia)."""
    if not mensajes:
        return mensajes
    ultimo = mensajes[-1]
    contenido = ultimo["content"]
    bloques = [{"type": "text", "text": contenido}] if isinstance(contenido, str) else [dict(b) for b in contenido]
    bloques[-1] = {**bloques[-1], "cache_control": _CACHE_EFIMERA}
    return [*mensajes[:-1], {**ultimo, "content": bloques}]


async def _pedir_a_claude(id_proyecto: int, mensajes: list[dict], tools: list[dict]) -> "anthropic.types.Message":
    clave = await get_anthropic_api_key(id_proyecto)
    if not clave:
        raise ValueError("Esta empresa no tiene configurada una clave de API de Claude")
    modelo = await get_anthropic_modelo(id_proyecto)
    cliente = anthropic.AsyncAnthropic(api_key=clave)
    return await cliente.messages.create(
        model=modelo, max_tokens=MAX_TOKENS_RESPUESTA,
        # Punto de caché tras el prompt del sistema: cubre también las
        # tools (van antes en el orden que arma la API), que no cambian
        # de un turno a otro dentro de la misma conversación.
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": _CACHE_EFIMERA}],
        tools=tools, messages=_con_punto_de_cache(mensajes),
    )


async def _avanzar(id_proyecto: int, id_usuario: int, id_rol: int, mensajes: list[dict]) -> dict:
    """Bucle de tool-use: ejecuta directo las herramientas de solo
    lectura y encadena; en cuanto el turno de Claude incluye alguna
    herramienta que escribe, se para ahí y devuelve algo para confirmar
    en vez de seguir sola."""
    mcp = await _cliente_mcp(id_proyecto, id_rol)
    async with mcp:
        tools, por_nombre = await _herramientas_anthropic(mcp)

        for _ in range(MAX_TURNOS_HERRAMIENTA):
            respuesta = await _pedir_a_claude(id_proyecto, mensajes, tools)
            uso = respuesta.usage
            print(
                f"[chat_ia] proyecto={id_proyecto} tokens de entrada={uso.input_tokens} "
                f"(caché leída={uso.cache_read_input_tokens}, caché escrita={uso.cache_creation_input_tokens}) "
                f"salida={uso.output_tokens}"
            )
            mensajes.append({"role": "assistant", "content": _bloques_a_dict(respuesta.content)})

            if respuesta.stop_reason != "tool_use":
                texto = "\n".join(b.text for b in respuesta.content if b.type == "text")
                await ChatConversacionesCRUD(get_db_config(id_proyecto)).guardar_mensajes(id_usuario, mensajes)
                return {"tipo": "respuesta", "texto": texto}

            llamadas = [b for b in respuesta.content if b.type == "tool_use"]
            ids_escritura = {b.id for b in llamadas if not _es_solo_lectura(por_nombre[b.name])}
            escrituras = [b for b in llamadas if b.id in ids_escritura]

            if not escrituras:
                resultados = []
                for llamada in llamadas:
                    texto, es_error = await _resultado_tool(mcp, llamada.name, llamada.input)
                    resultados.append({
                        "type": "tool_result", "tool_use_id": llamada.id,
                        "content": texto, "is_error": es_error,
                    })
                mensajes.append({"role": "user", "content": resultados})
                continue

            # Al menos una herramienta de esta tanda escribe: se ejecutan ya
            # las de solo lectura (no tienen efectos que deshacer) y se deja
            # pendiente el resto, a la espera de que el cliente confirme.
            resultados_listos = {}
            for llamada in llamadas:
                if llamada.id not in ids_escritura:
                    texto, es_error = await _resultado_tool(mcp, llamada.name, llamada.input)
                    resultados_listos[llamada.id] = {
                        "type": "tool_result", "tool_use_id": llamada.id,
                        "content": texto, "is_error": es_error,
                    }

            confirmacion_id = str(uuid.uuid4())
            _PENDIENTES[confirmacion_id] = {
                "id_proyecto": id_proyecto, "id_usuario": id_usuario, "id_rol": id_rol,
                "mensajes": mensajes, "llamadas": [b.model_dump() for b in llamadas],
                "resultados_listos": resultados_listos,
            }
            return {
                "tipo": "confirmar",
                "confirmacion_id": confirmacion_id,
                "acciones": [
                    {
                        "herramienta": b.name,
                        "descripcion": por_nombre[b.name].description or b.name,
                        "argumentos": b.input,
                    }
                    for b in escrituras
                ],
            }

        return {"tipo": "respuesta", "texto": "No he podido terminar — son demasiados pasos seguidos. Prueba a preguntar algo más concreto."}


async def enviar_mensaje(id_proyecto: int, id_usuario: int, es_editor: bool, mensaje: str) -> dict:
    """Punto de entrada de un mensaje nuevo del cliente. `es_editor`
    decide con qué rol de API key interna se conecta al MCP (operador si
    puede escribir en este proyecto, invitado si no — igual que ya se
    aplica a las keys que el propio cliente emite)."""
    id_rol = ID_ROL_OPERADOR if es_editor else ID_ROL_INVITADO
    mensajes = await ChatConversacionesCRUD(get_db_config(id_proyecto)).obtener_mensajes(id_usuario)
    mensajes.append({"role": "user", "content": mensaje})
    return await _avanzar(id_proyecto, id_usuario, id_rol, mensajes)


async def confirmar(id_usuario: int, confirmacion_id: str, aceptar: bool) -> dict:
    pendiente = _PENDIENTES.pop(confirmacion_id, None)
    if pendiente is None or pendiente["id_usuario"] != id_usuario:
        return {"tipo": "error", "texto": "Esta confirmación ya no está disponible — puede que se haya reiniciado el panel o que ya se resolviera."}

    id_proyecto, id_rol = pendiente["id_proyecto"], pendiente["id_rol"]
    mensajes = pendiente["mensajes"]
    resultados = dict(pendiente["resultados_listos"])

    async with await _cliente_mcp(id_proyecto, id_rol) as mcp:
        for llamada in pendiente["llamadas"]:
            if llamada["id"] in resultados:
                continue
            if aceptar:
                texto, es_error = await _resultado_tool(mcp, llamada["name"], llamada["input"])
            else:
                texto, es_error = "El cliente no ha confirmado esta acción — no se ha ejecutado.", True
            resultados[llamada["id"]] = {
                "type": "tool_result", "tool_use_id": llamada["id"],
                "content": texto, "is_error": es_error,
            }

    # Mismo orden en que Claude pidió las llamadas de esta tanda — no el
    # orden en que se fueron resolviendo (las de solo lectura, ya hechas
    # antes de pedir confirmación; la que escribe, resuelta aquí ahora).
    en_orden = [resultados[b["id"]] for b in pendiente["llamadas"]]
    mensajes.append({"role": "user", "content": en_orden})
    return await _avanzar(id_proyecto, id_usuario, id_rol, mensajes)
