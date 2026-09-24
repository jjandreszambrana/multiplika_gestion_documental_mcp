"""CRUD de gd_chat_conversaciones — historial del chat de IA, por usuario."""

import json
from datetime import datetime, timezone

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_chat import TABLA_CHAT_CONVERSACIONES


class ChatConversacionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CHAT_CONVERSACIONES, config)

    async def obtener_mensajes(self, id_usuario: int) -> list[dict]:
        """Vacío si el usuario nunca ha usado el chat todavía."""
        filas, _ = await self.listar(filtros={"id_usuario": {"op": "=", "valor": id_usuario}}, limit=1)
        return json.loads(filas[0]["mensajes_json"]) if filas else []

    async def guardar_mensajes(self, id_usuario: int, mensajes: list[dict]) -> None:
        """Sustituye el historial completo de este usuario por `mensajes`
        (la lista ya trae todo lo anterior — quien llama es responsable de
        acumular, no de recortar; ver panel_cliente/chat_ia.py)."""
        filas, _ = await self.listar(filtros={"id_usuario": {"op": "=", "valor": id_usuario}}, limit=1)
        datos = {
            "id_usuario": id_usuario,
            "mensajes_json": json.dumps(mensajes),
            "fecha_actualizacion": datetime.now(timezone.utc),
        }
        if filas:
            await self.update(filas[0]["id"], datos)
        else:
            await self.insert(datos)
