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

from ..database.modelos._mod_actividad import CABECERA_USUARIO_CHAT, PREFIJO_KEY_CHAT_INTERNO
from ..database.modelos._mod_chat import ChatConversacionesCRUD

SYSTEM_PROMPT = (
    "Eres el asistente de gestión documental de esta empresa, dentro de su propio panel. "
    "Solo respondes preguntas y haces acciones sobre SUS documentos, entidades, envíos y "
    "notas, usando exclusivamente las herramientas que tienes disponibles — no tienes "
    "acceso a nada fuera de ellas (ni navegación web, ni conocimiento de otros clientes ni "
    "de otras empresas). Si te piden algo que no puedes hacer con estas herramientas, dilo "
    "claramente en vez de inventar una respuesta. "
    "Para responder una pregunta, busca primero en los documentos propios (consultar_documentos_gd); "
    "si no responden y existe consultar_gds_enlazadas_gd, consulta también las gestiones documentales "
    "centrales enlazadas y di siempre de cuál viene cada dato (campo origen). Si ni lo propio ni la "
    "central resolvieron la pregunta pero la central devolvió algo, anótaselo con "
    "anotar_pregunta_pendiente_enlazada_gd para que su responsable lo cubra."
)

# Preguntas de otra pantalla que ya traen todo lo necesario (p. ej. lo que no se
# pudo traer de Codiplika): sin herramientas, porque solo sus definiciones son
# decenas de miles de tokens por pregunta.
SYSTEM_PROMPT_SIN_HERRAMIENTAS = (
    "Eres el asistente de esta empresa dentro de su panel de gestión. Responde en español, "
    "con palabras sencillas y en pocas líneas, solo con los datos que te dan en la pregunta."
)
MAX_TOKENS_SIN_HERRAMIENTAS = 2000

MAX_TURNOS_HERRAMIENTA = 8  # llamadas a herramientas de solo lectura encadenadas antes de rendirse
# Tareas que de verdad necesitan muchos pasos (buscar varias cuentas, probar,
# corregir y volver a probar): en cuanto la IA usa una de estas herramientas,
# el freno de esa pregunta se amplía. El resto sigue con el de siempre.
MAX_TURNOS_TAREA_LARGA = 15
HERRAMIENTAS_TAREA_LARGA = {"guia_plantillas_asiento_gd", "probar_plantilla_asiento_gd"}
MAX_TOKENS_RESPUESTA = 16000  # incluye lo que gasta en pensar antes de responder o elegir herramienta

# confirmacion_id -> estado necesario para retomar el turno tras confirmar/rechazar
_PENDIENTES: dict[str, dict] = {}


async def _cliente_mcp(id_proyecto: int, id_rol: int, id_usuario: int) -> Client:
    """`id_usuario` viaja en CABECERA_USUARIO_CHAT para que el registro de
    actividad apunte a la persona que chatea, no a la key interna."""
    rol = "operador" if id_rol == ID_ROL_OPERADOR else "invitado"
    clave = await clave_interna_proyecto(id_proyecto, id_rol, f"{PREFIJO_KEY_CHAT_INTERNO} ({rol})")
    transporte = StreamableHttpTransport(
        get_mcp_url_local(), headers={"x-api-key": clave, CABECERA_USUARIO_CHAT: str(id_usuario)},
    )
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


PREGUNTAS_CON_RESULTADOS_ENTEROS = 2  # las dos últimas preguntas del usuario llevan sus resultados completos
MIN_CARACTERES_RECORTE = 1500  # un resultado corto no merece la pena recortarlo


def _es_pregunta(mensaje: dict) -> bool:
    """Un mensaje del usuario escrito por él (no la respuesta de una herramienta)."""
    if mensaje["role"] != "user":
        return False
    contenido = mensaje["content"]
    return isinstance(contenido, str) or not any(b.get("type") == "tool_result" for b in contenido)


def _recortar_resultados_antiguos(mensajes: list[dict]) -> list[dict]:
    """Copia `mensajes` cambiando los resultados largos de herramientas de
    preguntas antiguas por una línea que dice qué se consultó: en cada
    mensaje se reenvía toda la conversación, y cinco informes de 4.000
    tokens consultados al principio se pagarían otra vez en cada mensaje.
    La IA los vuelve a pedir si de verdad los necesita. Solo para la llamada
    a la API: el historial guardado no cambia. Un resultado, una vez
    recortado, se queda recortado: así el principio de la conversación no
    cambia de un mensaje al siguiente y sigue sirviendo de caché."""
    preguntas = [i for i, m in enumerate(mensajes) if _es_pregunta(m)]
    if len(preguntas) <= PREGUNTAS_CON_RESULTADOS_ENTEROS:
        return mensajes
    limite = preguntas[-PREGUNTAS_CON_RESULTADOS_ENTEROS]
    nombres = {
        b["id"]: (b["name"], b.get("input") or {})
        for m in mensajes[:limite] if m["role"] == "assistant" and isinstance(m["content"], list)
        for b in m["content"] if b.get("type") == "tool_use"
    }
    copia = []
    for i, m in enumerate(mensajes):
        if i < limite and m["role"] == "user" and isinstance(m["content"], list):
            bloques = []
            for b in m["content"]:
                texto = b.get("content")
                if b.get("type") == "tool_result" and isinstance(texto, str) and len(texto) > MIN_CARACTERES_RECORTE:
                    nombre, argumentos = nombres.get(b["tool_use_id"], ("herramienta", {}))
                    resumen = json.dumps(argumentos, ensure_ascii=False)[:200]
                    b = {**b, "content": f"[Resultado ya usado de {nombre} {resumen}: si lo necesitas otra vez, vuelve a pedirlo]"}
                bloques.append(b)
            m = {**m, "content": bloques}
        copia.append(m)
    return copia


async def _pedir_a_claude(
    id_proyecto: int, mensajes: list[dict], tools: list[dict], contexto_inicial: str
) -> "anthropic.types.Message":
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
        # El contexto del cliente (negocio, preferencias de trabajo y
        # reglas de comportamiento) va DESPUÉS del prompt del sistema, no
        # antes: manda sobre los criterios por defecto (ver
        # docs/gestion-documental.md → "Reglas de comportamiento"). Es el
        # mismo texto que el `initialize` de MCP da a Claude Desktop; este
        # chat lo recoge de su propia conexión MCP y lo pasa a mano, porque
        # arma su propio prompt.
        system=[{
            "type": "text", "text": f"{SYSTEM_PROMPT}\n\n{contexto_inicial}",
            "cache_control": _CACHE_EFIMERA,
        }],
        tools=tools, messages=_con_punto_de_cache(_recortar_resultados_antiguos(mensajes)),
    )


async def _avanzar(id_proyecto: int, id_conversacion: int, id_usuario: int, id_rol: int, mensajes: list[dict]) -> dict:
    """Bucle de tool-use: ejecuta directo las herramientas de solo
    lectura y encadena; en cuanto el turno de Claude incluye alguna
    herramienta que escribe, se para ahí y devuelve algo para confirmar
    en vez de seguir sola."""
    mcp = await _cliente_mcp(id_proyecto, id_rol, id_usuario)
    async with mcp:
        # `instructions` es de fastmcp 4; en los servidores con una versión
        # anterior solo está en `initialize_result`.
        contexto_inicial = (
            getattr(mcp, "instructions", None)
            or getattr(getattr(mcp, "initialize_result", None), "instructions", None)
            or ""
        )
        tools, por_nombre = await _herramientas_anthropic(mcp)

        limite, turno = MAX_TURNOS_HERRAMIENTA, 0
        while turno < limite:
            turno += 1
            respuesta = await _pedir_a_claude(id_proyecto, mensajes, tools, contexto_inicial)
            uso = respuesta.usage
            print(
                f"[chat_ia] proyecto={id_proyecto} tokens de entrada={uso.input_tokens} "
                f"(caché leída={uso.cache_read_input_tokens}, caché escrita={uso.cache_creation_input_tokens}) "
                f"salida={uso.output_tokens}"
            )
            mensajes.append({"role": "assistant", "content": _bloques_a_dict(respuesta.content)})

            if respuesta.stop_reason != "tool_use":
                texto = "\n".join(b.text for b in respuesta.content if b.type == "text")
                await ChatConversacionesCRUD(get_db_config(id_proyecto)).guardar_mensajes(id_conversacion, mensajes)
                return {"tipo": "respuesta", "texto": texto}

            llamadas = [b for b in respuesta.content if b.type == "tool_use"]
            if any(b.name in HERRAMIENTAS_TAREA_LARGA for b in llamadas):
                limite = MAX_TURNOS_TAREA_LARGA
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
                "id_proyecto": id_proyecto, "id_conversacion": id_conversacion,
                "id_usuario": id_usuario, "id_rol": id_rol,
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


async def _responder_sin_herramientas(id_proyecto: int, id_conversacion: int, mensajes: list[dict]) -> dict:
    clave = await get_anthropic_api_key(id_proyecto)
    if not clave:
        raise ValueError("Esta empresa no tiene configurada una clave de API de Claude")
    respuesta = await anthropic.AsyncAnthropic(api_key=clave).messages.create(
        model=await get_anthropic_modelo(id_proyecto), max_tokens=MAX_TOKENS_SIN_HERRAMIENTAS,
        system=SYSTEM_PROMPT_SIN_HERRAMIENTAS, messages=_recortar_resultados_antiguos(mensajes),
    )
    uso = respuesta.usage
    print(f"[chat_ia] proyecto={id_proyecto} sin herramientas: entrada={uso.input_tokens} salida={uso.output_tokens}")
    texto = "\n".join(b.text for b in respuesta.content if b.type == "text")
    mensajes.append({"role": "assistant", "content": _bloques_a_dict(respuesta.content)})
    await ChatConversacionesCRUD(get_db_config(id_proyecto)).guardar_mensajes(id_conversacion, mensajes)
    return {"tipo": "respuesta", "texto": texto}


async def enviar_mensaje(
    id_proyecto: int, id_conversacion: int, id_usuario: int, es_editor: bool, mensaje: str, sin_herramientas: bool = False,
) -> dict:
    """Punto de entrada de un mensaje nuevo del cliente, dentro de una
    conversación concreta (el llamador ya comprobó que es suya).
    `es_editor` decide con qué rol de API key interna se conecta al MCP
    (operador si puede escribir en este proyecto, invitado si no — igual
    que ya se aplica a las keys que el propio cliente emite)."""
    id_rol = ID_ROL_OPERADOR if es_editor else ID_ROL_INVITADO
    mensajes = await ChatConversacionesCRUD(get_db_config(id_proyecto)).obtener_mensajes(id_conversacion)
    mensajes.append({"role": "user", "content": mensaje})
    if sin_herramientas:
        return await _responder_sin_herramientas(id_proyecto, id_conversacion, mensajes)
    return await _avanzar(id_proyecto, id_conversacion, id_usuario, id_rol, mensajes)


async def confirmar(id_usuario: int, confirmacion_id: str, aceptar: bool) -> dict:
    pendiente = _PENDIENTES.pop(confirmacion_id, None)
    if pendiente is None or pendiente["id_usuario"] != id_usuario:
        return {"tipo": "error", "texto": "Esta confirmación ya no está disponible — puede que se haya reiniciado el panel o que ya se resolviera."}

    id_proyecto, id_conversacion, id_rol = pendiente["id_proyecto"], pendiente["id_conversacion"], pendiente["id_rol"]
    mensajes = pendiente["mensajes"]
    resultados = dict(pendiente["resultados_listos"])

    async with await _cliente_mcp(id_proyecto, id_rol, id_usuario) as mcp:
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
    return await _avanzar(id_proyecto, id_conversacion, id_usuario, id_rol, mensajes)
