"""CRUD de gd_solicitudes_credencial — ver
mcp_server/herramientas/_herr_credenciales.py y
_dep_solicitudes_credencial.py."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_solicitudes_credencial import TABLA_SOLICITUDES_CREDENCIAL

MINUTOS_VALIDEZ = 15


def generar_token() -> str:
    """Token en claro para la URL — solo existe en memoria y en la propia
    URL que se le da al cliente, nunca se guarda (ver `_hash`)."""
    return secrets.token_urlsafe(32)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class SolicitudesCredencialCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_SOLICITUDES_CREDENCIAL, config)

    async def crear(self, nombre: str, descripcion: str, usuario: str | None, token: str) -> int:
        ahora = datetime.now(timezone.utc)
        return await self.insert({
            "token_hash": _hash(token),
            "nombre": nombre,
            "descripcion": descripcion,
            "usuario": usuario,
            "fecha_creacion": ahora,
            "fecha_expiracion": ahora + timedelta(minutes=MINUTOS_VALIDEZ),
            "usado": False,
        })

    async def obtener_vigente(self, token: str) -> dict | None:
        """La solicitud de ese token si sigue sin usarse y no ha caducado
        — None en cualquier otro caso (token inválido, ya usado o
        expirado), sin distinguir el motivo: de cara al cliente el enlace
        simplemente ya no vale."""
        filas, _ = await self.listar(
            filtros={
                "token_hash": {"op": "=", "valor": _hash(token)},
                "usado": {"op": "=", "valor": False},
                "fecha_expiracion": {"op": ">", "valor": datetime.now(timezone.utc)},
            },
            limit=1,
        )
        return filas[0] if filas else None

    async def marcar_usada(self, id_solicitud: int) -> None:
        await self.update(id_solicitud, {"usado": True})
