"""Quién hace la petición al panel del cliente de gestión documental —
mismo JWT que el panel de administración del repo core (login
compartido, ver lib/jwt_tokens.py) y su sistema de roles por proyecto
(lib/roles_proyecto.py). Guardar un documento nuevo o corregir una
lectura mal hecha de la IA sigue siendo solo por conversación con ella;
editar el texto ya guardado sí se puede hacer desde aquí (ver
puede_editar_documento_actual y docs/gestion-documental.md → "Edición
desde el panel"). La única acción de administración real que vive aquí
es gestionar las API keys del proyecto, restringida a admin_tenant (ver
admin_gestion_documental_actual).

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
from database.control.dependencias._dep_api_keys import TABLA_API_KEYS
from database.control.dependencias._dep_auditoria_soporte import TABLA_AUDITORIA_SOPORTE
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS
from lib.jwt_tokens import decodificar_token
from lib.roles_proyecto import es_admin_de_proyecto, puede_editar_proyecto, tiene_acceso_a_proyecto

_proyectos = AsyncCrudBase(TABLA_PROYECTOS, get_db_config("control"))
_auditoria = AsyncCrudBase(TABLA_AUDITORIA_SOPORTE, get_db_config("control"))
_api_keys = AsyncCrudBase(TABLA_API_KEYS, get_db_config("control"))


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


async def es_admin_actual(
    proyecto: dict = Depends(proyecto_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual)
) -> bool:
    """Si quien pide el proyecto puede además administrarlo (gestionar
    sus API keys) — admin_tenant o superadmin, no basta cualquier rol."""
    if identidad.tipo == "superadmin":
        return True
    return await es_admin_de_proyecto(identidad.id, proyecto["id"])


async def puede_editar_documento_actual(
    proyecto: dict = Depends(proyecto_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual)
) -> int:
    """Dependencia para editar documentos desde el panel (ver
    docs/gestion-documental.md → "Edición desde el panel"): cualquier
    usuario de empresa salvo invitado (solo lectura); un superadmin no
    puede, porque el registro de quién edita (gd_historial_ediciones)
    referencia mcpc_usuarios, no mcpc_superadmins — para dar soporte
    editando un documento de un cliente, que entre con un usuario real
    de ese tenant. Devuelve el id_usuario a registrar en el historial."""
    if identidad.tipo != "usuario" or not await puede_editar_proyecto(identidad.id, proyecto["id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permiso para editar documentos de este proyecto")
    return identidad.id


async def escritor_gestion_documental_actual(
    proyecto: dict = Depends(proyecto_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual)
) -> dict:
    """Como proyecto_gestion_documental_actual, pero para escribir: cualquier
    usuario de empresa salvo invitado (solo lectura). A diferencia de
    puede_editar_documento_actual, un superadmin sí pasa (da soporte) y no
    devuelve id_usuario, porque no se registra quién escribe."""
    if identidad.tipo == "usuario" and not await puede_editar_proyecto(identidad.id, proyecto["id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu rol es de solo lectura en este proyecto")
    return proyecto


async def admin_gestion_documental_actual(
    proyecto: dict = Depends(proyecto_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual)
) -> dict:
    """Como proyecto_gestion_documental_actual, pero además exige que un
    usuario de empresa sea admin_tenant de este proyecto (no basta
    cualquier rol) — las API keys sí son una acción de administración,
    aunque vivan en este panel de solo lectura de documentos."""
    if identidad.tipo == "usuario" and not await es_admin_de_proyecto(identidad.id, proyecto["id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere ser admin de este proyecto")
    return proyecto


async def api_key_de_gestion_documental(id_api_key: int, identidad: Identidad = Depends(identidad_actual)) -> dict:
    """Para revocar/eliminar, que solo llevan id_api_key en el path (no
    id_proyecto en la URL): resuelve el proyecto dueño de la key y aplica
    las mismas comprobaciones que admin_gestion_documental_actual."""
    fila_key = await _api_keys.obtener(id_api_key)
    if not fila_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key no encontrada")

    proyecto = await _proyectos.obtener(fila_key["id_proyecto"])
    if not proyecto or proyecto["tipo_producto"] != "gestion_documental":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key no encontrada")

    if identidad.tipo == "superadmin":
        await _auditoria.insert({
            "id_superadmin": identidad.id,
            "id_proyecto": proyecto["id"],
            "accion": "gestionar_api_keys_gd",
        })
    elif proyecto["id_tenant"] != identidad.id_tenant or not await es_admin_de_proyecto(identidad.id, proyecto["id"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requiere ser admin de este proyecto")

    return fila_key
