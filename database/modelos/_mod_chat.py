"""CRUD de gd_chat_conversaciones — varias conversaciones del chat de IA
por usuario, con título propio."""

import json
from datetime import datetime, timezone

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_chat import TABLA_CHAT_CONVERSACIONES

LONGITUD_TITULO_MUESTRA = 50


def _titulo_de_muestra(mensajes: list[dict]) -> str | None:
    """Deriva un título corto del primer mensaje ESCRITO por el usuario
    (no de un tool_result, que también viaja con role="user" pero como
    lista de bloques, nunca como texto plano) — recortado y sin saltos
    de línea, para que la lista de conversaciones se vea razonable."""
    for mensaje in mensajes:
        if mensaje.get("role") == "user" and isinstance(mensaje.get("content"), str):
            texto = " ".join(mensaje["content"].split())
            if texto:
                return texto[:LONGITUD_TITULO_MUESTRA]
    return None


class ChatConversacionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CHAT_CONVERSACIONES, config)

    async def listar_conversaciones(self, id_usuario: int) -> list[dict]:
        """Más recientes primero. `titulo` viene siempre resuelto: si la
        fila no tiene uno guardado (conversación nueva sin turnos, o una
        de antes de que existiera esta columna), se calcula aquí mismo
        a partir del primer mensaje — sin persistirlo, no hace falta."""
        filas, _ = await self.listar(
            filtros={"id_usuario": {"op": "=", "valor": id_usuario}},
            orden="fecha_actualizacion DESC", limit=1000,
        )
        conversaciones = []
        for fila in filas:
            titulo = fila["titulo"]
            if not titulo:
                titulo = _titulo_de_muestra(json.loads(fila["mensajes_json"]))
            conversaciones.append({
                "id": fila["id"], "titulo": titulo,
                "fecha_creacion": fila["fecha_creacion"],
                "fecha_actualizacion": fila["fecha_actualizacion"],
            })
        return conversaciones

    async def crear_conversacion(self, id_usuario: int, titulo: str | None) -> dict:
        id_conversacion = await self.insert({
            "id_usuario": id_usuario, "titulo": titulo, "mensajes_json": json.dumps([]),
        })
        return await self.obtener(id_conversacion)

    async def obtener_mensajes(self, id_conversacion: int) -> list[dict]:
        fila = await self.obtener(id_conversacion)
        return json.loads(fila["mensajes_json"]) if fila else []

    async def guardar_mensajes(self, id_conversacion: int, mensajes: list[dict]) -> None:
        """Sustituye el historial completo de esta conversación por
        `mensajes` (la lista ya trae todo lo anterior — quien llama es
        responsable de acumular, no de recortar; ver chat_ia.py). Si la
        conversación todavía no tiene título (ni puesto a mano ni
        derivado antes), lo deriva ahora del primer mensaje y lo deja
        guardado — no se vuelve a tocar una vez puesto, sea a mano o así."""
        fila = await self.obtener(id_conversacion)
        datos = {
            "mensajes_json": json.dumps(mensajes),
            "fecha_actualizacion": datetime.now(timezone.utc),
        }
        if fila and not fila["titulo"]:
            titulo = _titulo_de_muestra(mensajes)
            if titulo:
                datos["titulo"] = titulo
        await self.update(id_conversacion, datos)

    async def renombrar(self, id_conversacion: int, titulo: str) -> None:
        await self.update(id_conversacion, {"titulo": titulo})
