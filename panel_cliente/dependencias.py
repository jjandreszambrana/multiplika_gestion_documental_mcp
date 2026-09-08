"""Quién hace la petición al panel del cliente de gestión documental —
mismo JWT que el panel de administración del repo core (login
compartido, ver lib/jwt_tokens.py) y su sistema de roles por proyecto
(lib/roles_proyecto.py). Solo lectura: no hay acciones de administración
aquí, guardar/corregir sigue siendo por conversación con la IA.

Un superadmin también puede entrar (mismo token que usa en /panel, sin
contraseña aparte — pensado para dar soporte a un cliente) pero SIEMPRE
deja rastro: cada vez que su token se usa aquí se registra en
mcpc_auditoria_soporte, igual que la herramienta de soporte del panel de
administración. No hace falta llamarlo aparte — queda registrado en
cuanto se resuelve el proyecto, en cualquier endpoint de este backend."""

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from mtpk_mariadb import AsyncCrudBase

from database.config_db import get_db_config
from database.control.dependencias._dep_auditoria_soporte import TABLA_AUDITORIA_SOPORTE
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS
from lib.jwt_tokens import decodificar_token
from lib.roles_proyecto import tiene_acceso_a_proyecto

_proyectos = AsyncCrudBase(TABLA_PROYECTOS, get_db_config("control"))
_auditoria = AsyncCrudBase(TABLA_AUDITORIA_SOPORTE, get_db_config("control"))


@dataclass
class Identidad:
    tipo: str  # "usuario" o "superadmin"
    id: int
    id_tenant: int | None = None  # None para superadmin: no pertenece a ningún tenant


def _token_crudo(authorization: str = Header(default="")) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Falta el token de acceso")
    return authorization.removeprefix("Bearer ").strip()


def identidad_actual(token: str = Depends(_token_crudo)) -> Identidad:
    payload = decodificar_token(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o caducado")
    if payload.get("tipo") == "superadmin":
        return Identidad(tipo="superadmin", id=payload["id_superadmin"])
    if payload.get("tipo") == "usuario":
        return Identidad(tipo="usuario", id=payload["id_usuario"], id_tenant=payload["id_tenant"])
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o caducado")


async def proyecto_gestion_documental_actual(
    id_proyecto: int, identidad: Identidad = Depends(identidad_actual)
) -> dict:
    """Dependencia de ruta: el proyecto pedido tiene que ser de tipo
    gestion_documental y estar activo. Un superadmin puede ver cualquiera
    (queda registrado en mcpc_auditoria_soporte); un usuario de empresa
    solo el de su propio tenant, y solo si tiene algún rol asignado en él."""
    proyecto = await _proyectos.obtener(id_proyecto)
    if not proyecto or proyecto["tipo_producto"] != "gestion_documental" or proyecto["estado"] != 1:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proyecto no encontrado")

    if identidad.tipo == "superadmin":
        await _auditoria.insert({
            "id_superadmin": identidad.id,
            "id_proyecto": id_proyecto,
            "accion": "ver_panel_cliente_gd",
        })
        return proyecto

    if proyecto["id_tenant"] != identidad.id_tenant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proyecto no encontrado")
    if not await tiene_acceso_a_proyecto(identidad.id, id_proyecto):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a este proyecto")
    return proyecto
