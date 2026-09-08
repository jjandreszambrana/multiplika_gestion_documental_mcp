"""Quién hace la petición al panel del cliente de gestión documental —
mismo JWT que el panel de administración del repo core (login
compartido, ver lib/jwt_tokens.py) y su sistema de roles por proyecto
(lib/roles_proyecto.py). Solo lectura: no hay acciones de administración
aquí, guardar/corregir sigue siendo por conversación con la IA."""

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from mtpk_mariadb import AsyncCrudBase

from database.config_db import get_db_config
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS
from lib.jwt_tokens import decodificar_token
from lib.roles_proyecto import tiene_acceso_a_proyecto

_proyectos = AsyncCrudBase(TABLA_PROYECTOS, get_db_config("control"))


@dataclass
class Identidad:
    id_usuario: int
    id_tenant: int


def _token_crudo(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta el token de acceso")
    return authorization.removeprefix("Bearer ").strip()


def identidad_actual(token: str = Depends(_token_crudo)) -> Identidad:
    payload = decodificar_token(token)
    if payload is None or payload.get("tipo") != "usuario":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o caducado")
    return Identidad(id_usuario=payload["id_usuario"], id_tenant=payload["id_tenant"])


async def proyecto_gestion_documental_actual(
    id_proyecto: int, identidad: Identidad = Depends(identidad_actual)
) -> dict:
    """Dependencia de ruta: el proyecto pedido tiene que ser de este
    tenant, de tipo gestion_documental, activo, y el usuario tiene que
    tener algún rol asignado en él."""
    proyecto = await _proyectos.obtener(id_proyecto)
    if (
        not proyecto
        or proyecto["id_tenant"] != identidad.id_tenant
        or proyecto["tipo_producto"] != "gestion_documental"
        or proyecto["estado"] != 1
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proyecto no encontrado")
    if not await tiene_acceso_a_proyecto(identidad.id_usuario, id_proyecto):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a este proyecto")
    return proyecto
