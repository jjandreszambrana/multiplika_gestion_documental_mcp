#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Panel para que el cliente vea, busque y edite sus propios documentos
(ver docs/gestion-documental.md) — guardar un documento nuevo o corregir
una mala lectura de la IA sigue siendo solo por conversación con ella,
esto no lo sustituye; editar el texto ya guardado sí se puede hacer
desde aquí (ver "Edición desde el panel"). También deja a un
admin_tenant gestionar las API keys de su proyecto (emitir, revocar,
eliminar), para conectar sus propios clientes MCP sin depender del
panel de administración.

Reutiliza el login del panel de administración del repo core (mismo
JWT, mismo usuario/contraseña de su empresa) y la misma capa `modelos`
que usan las herramientas MCP — no hay lógica de negocio duplicada.

Sirve a CUALQUIER cliente que use este producto (resuelve el proyecto
por id en cada petición, con su base de datos propia) — por eso, a
diferencia de mcp_server/herramientas/, sync.py del repo core NO lo
despliega dentro de apps/mcp_server/proyectos/p<id>/ de ningún cliente
concreto (eso lo dejaría atado a que ese proyecto en particular siga
existiendo). Va a una ruta estable por producto:
`apps/mcp_server/paneles_cliente/<nombre_del_repo>/`.

Pensado para ejecutarse ya desplegado, vía
`python -m apps.mcp_server.paneles_cliente.<nombre_del_repo>.panel_cliente.servidor`
(WorkingDirectory = raíz del repo core, de ahí resuelven los imports
absolutos a database.config_db / lib.*). Para probar en local antes de
desplegar, ver guia_nuevo_proyecto.md sobre cómo simular el árbol final."""

import html
import os
from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from mtpk_mariadb import AsyncCrudBase
from pydantic import BaseModel

from database.config_db import get_db_config
from database.control.dependencias._dep_api_keys import TABLA_API_KEYS
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS
from database.control.dependencias._dep_usuarios import TABLA_USUARIOS
from lib.api_keys import generar_api_key
from lib.roles_proyecto import puede_editar_proyecto

from ..database.ayuda_gd import TEXTO_AYUDA_GD
from ..database.modelos._mod_chunks import ChunksCRUD
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_credenciales import CredencialesCRUD
from ..database.modelos._mod_solicitudes_credencial import SolicitudesCredencialCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_documentos_pendientes import DocumentosPendientesCRUD
from ..database.modelos._mod_embeddings import generar_embeddings, obtener_api_key
from ..database.modelos._mod_estilos import EstilosCRUD, EstilosImagenesCRUD
from ..database.modelos._mod_historial_ediciones import HistorialEdicionesCRUD, calcular_diff
from ..database.modelos._mod_registros import (
    RegistrosCRUD,
    RegistrosRelacionesCRUD,
    crear_registro,
    listar_registros_documento,
    resolver_incidencia,
)
from ..database.modelos._mod_tipos_documento import TiposDocumentoCRUD
from ..database.modelos._mod_versiones import VersionesCRUD, confirmar_edicion, revertir_edicion
from .dependencias import (
    Identidad,
    admin_gestion_documental_actual,
    api_key_de_gestion_documental,
    es_admin_actual,
    identidad_actual,
    proyecto_gestion_documental_actual,
    puede_editar_documento_actual,
)

app = FastAPI(title="Gestión documental — Panel del cliente")

# En producción vive bajo el mismo dominio que el resto (/gd, mismo
# origen); en desarrollo el frontend corre aparte con Vite.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_usuarios = AsyncCrudBase(TABLA_USUARIOS, get_db_config("control"))
_proyectos_control = AsyncCrudBase(TABLA_PROYECTOS, get_db_config("control"))


async def _nombre_usuario(id_usuario: int | None) -> str | None:
    if id_usuario is None:
        return None
    usuario = await _usuarios.obtener(id_usuario)
    return usuario["nombre"] if usuario else None


@app.get("/v1/ayuda")
async def obtener_ayuda() -> dict:
    """Mismo texto que la tool MCP `obtener_ayuda_gd()` (ver
    database/ayuda_gd.py) — cómo funciona la Gestión Documental, para la
    pantalla "Ayuda" del panel. No depende de ningún proyecto ni requiere
    sesión: es contenido estático, igual para cualquier cliente."""
    return {"markdown": TEXTO_AYUDA_GD}


@app.get("/v1/proyectos/{id_proyecto}")
async def ver_proyecto(
    id_proyecto: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    es_admin: bool = Depends(es_admin_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Datos básicos del proyecto (nombre) — lo usa el frontend cuando
    entra directo a un proyecto conocido (enlace del superadmin desde el
    panel de administración) sin pasar por el selector. `es_admin` le
    dice al frontend si mostrar la gestión de API keys y de usuarios;
    `puede_editar` si mostrar la edición de documentos (ver
    puede_editar_documento_actual: ningún superadmin, ni un usuario con
    rol invitado); `id_tenant` hace falta para gestionar los usuarios de
    la empresa (viven por tenant, no por proyecto)."""
    puede_editar = identidad.tipo == "usuario" and await puede_editar_proyecto(identidad.id, proyecto["id"])
    return {
        "id": proyecto["id"], "id_tenant": proyecto["id_tenant"], "nombre": proyecto["nombre"],
        "es_admin": es_admin, "puede_editar": puede_editar,
    }


@app.get("/v1/proyectos/{id_proyecto}/documentos")
async def listar_o_buscar_documentos(
    id_proyecto: int,
    q: str | None = None,
    tipo_documento: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """Sin `q`: listado simple de documentos, con filtros opcionales de
    tipo y rango de fechas. Con `q`: búsqueda por contenido (fulltext o
    semántica, según el modo activo del proyecto) — los filtros no
    aplican ahí, solo al listado simple."""
    config = get_db_config(proyecto["id"])

    if not q:
        # A diferencia de la búsqueda por contenido, el listado simple sí
        # incluye archivados (con su estado visible) — así se pueden
        # encontrar para desarchivarlos.
        return await DocumentosCRUD(config).buscar(
            tipo_documento=tipo_documento, limite=200, incluir_archivados=True,
            fecha_desde=fecha_desde, fecha_hasta=fecha_hasta,
        )

    configuracion = ConfiguracionCRUD(config)
    modo = await configuracion.obtener_modo_busqueda()
    if modo == "fulltext":
        return await VersionesCRUD(config).buscar_fulltext(q, limite=30)

    proveedor_embedding = await configuracion.obtener_proveedor_embedding()
    api_key = await obtener_api_key(proveedor_embedding, proyecto["id"])
    if not api_key:
        raise HTTPException(503, "La búsqueda semántica no tiene una clave de API configurada")
    (embedding_pregunta,) = await generar_embeddings(proveedor_embedding, api_key, [q])
    return await ChunksCRUD(config).buscar_semantico(embedding_pregunta, limite=30)


# --- Contexto de negocio (mcpc_proyectos.descripcion/preferencias_trabajo,
# ver docs/decisiones.md del repo core → "Contexto compartido: separar
# negocio de preferencias"): es lo que la IA lee al conectar por MCP. Vivía
# solo en el panel de soporte de superadmin; el admin_tenant del proyecto
# lo edita también aquí, sin pasar por soporte.


class ActualizarContextoNegocio(BaseModel):
    texto: str


class ActualizarPreferenciasNegocio(BaseModel):
    texto: str


@app.get("/v1/proyectos/{id_proyecto}/contexto")
async def obtener_contexto_negocio(
    id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    return {
        "descripcion": proyecto["descripcion"],
        "preferencias_trabajo": proyecto["preferencias_trabajo"],
    }


@app.put("/v1/proyectos/{id_proyecto}/contexto")
async def actualizar_contexto_negocio(
    id_proyecto: int, datos: ActualizarContextoNegocio, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    await _proyectos_control.update(id_proyecto, {"descripcion": datos.texto})
    return {"descripcion": datos.texto}


@app.put("/v1/proyectos/{id_proyecto}/preferencias")
async def actualizar_preferencias_negocio(
    id_proyecto: int, datos: ActualizarPreferenciasNegocio, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    await _proyectos_control.update(id_proyecto, {"preferencias_trabajo": datos.texto})
    return {"preferencias_trabajo": datos.texto}


# --- Documentos pendientes (subida masiva; más adelante también la
# ingesta por email escribirá aquí) — ver docs/gestion-documental.md →
# "Documentos pendientes". Mismo criterio de permisos que
# archivar/desarchivar: día a día con documentos, no admin.


@app.get("/v1/proyectos/{id_proyecto}/documentos-pendientes")
async def listar_documentos_pendientes(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await DocumentosPendientesCRUD(config).listar_metadatos()


@app.post("/v1/proyectos/{id_proyecto}/documentos-pendientes")
async def subir_documentos_pendientes(
    id_proyecto: int,
    archivos: list[UploadFile] = File(...),
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """Subida masiva: varios ficheros en una sola petición, uno por cada
    fila nueva en la cola de pendientes. No se procesan aquí — eso lo hace
    la IA en una conversación posterior (ver guardar_documento_gd)."""
    config = get_db_config(proyecto["id"])
    pendientes = DocumentosPendientesCRUD(config)
    creados = []
    for archivo in archivos:
        contenido = await archivo.read()
        id_pendiente = await pendientes.crear(
            contenido, archivo.content_type or "application/octet-stream",
            archivo.filename or "sin_nombre", "panel",
        )
        creados.append(await pendientes.obtener(id_pendiente))
    return [{k: v for k, v in fila.items() if k != "archivo"} for fila in creados]


@app.delete(
    "/v1/proyectos/{id_proyecto}/documentos-pendientes/{id_pendiente}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_documento_pendiente(
    id_proyecto: int, id_pendiente: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> None:
    """Descarta un pendiente sin procesarlo (p.ej. una subida por error)."""
    config = get_db_config(proyecto["id"])
    await DocumentosPendientesCRUD(config).eliminar(id_pendiente)


# --- Tipos de documento (catálogo abierto, no una lista cerrada) ---
# Lectura para cualquiera con acceso (lo usa el filtro del listado);
# alta/borrado del catálogo, solo admin — igual criterio que estilos.


class NuevoTipoDocumento(BaseModel):
    nombre: str


class ActualizarTipoDocumento(BaseModel):
    formato_requerido: str | None = None
    normativa_aplicable: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/tipos-documento")
async def listar_tipos_documento(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await TiposDocumentoCRUD(config).listar_nombres()


@app.post("/v1/proyectos/{id_proyecto}/tipos-documento")
async def crear_tipo_documento(
    id_proyecto: int, datos: NuevoTipoDocumento, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    tipos = TiposDocumentoCRUD(config)
    existentes, _ = await tipos.listar(filtros={"nombre": {"op": "=", "valor": datos.nombre}}, limit=1)
    if existentes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Ya existe el tipo "{datos.nombre}"')
    id_tipo = await tipos.crear(datos.nombre)
    return await tipos.obtener(id_tipo)


@app.put("/v1/proyectos/{id_proyecto}/tipos-documento/{id_tipo}")
async def actualizar_tipo_documento(
    id_proyecto: int, id_tipo: int, datos: ActualizarTipoDocumento,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    """Define (o borra) el formato/normativa que debe cumplir un
    documento de este tipo — ver docs/gestion-documental.md →
    "Cumplimiento de formato/normativa". No afecta a documentos ya
    guardados, solo a cómo la IA evalúa los que se guarden a partir de
    ahora."""
    config = get_db_config(proyecto["id"])
    tipos = TiposDocumentoCRUD(config)
    if not await tipos.obtener(id_tipo):
        raise HTTPException(404, "Tipo de documento no encontrado")
    await tipos.actualizar_requisitos(id_tipo, datos.formato_requerido, datos.normativa_aplicable)
    return await tipos.obtener(id_tipo)


@app.delete("/v1/proyectos/{id_proyecto}/tipos-documento/{id_tipo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tipo_documento(
    id_proyecto: int, id_tipo: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    """Solo quita el tipo del catálogo de sugerencias — los documentos ya
    guardados con ese tipo no cambian, tipo_documento es texto libre, sin
    referencia a esta tabla."""
    config = get_db_config(proyecto["id"])
    await TiposDocumentoCRUD(config).eliminar(id_tipo)


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}")
async def obtener_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    documento = await DocumentosCRUD(config).obtener(id_documento)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    version = await VersionesCRUD(config).obtener_completo(id_documento)
    return {
        **documento,
        "id_version": version["id"] if version else None,
        "markdown": version["markdown_actual"] if version else None,
        "fecha_documento": version["fecha_documento"] if version else None,
        "fecha_caducidad": version["fecha_caducidad"] if version else None,
        "fecha_subida": version["fecha_subida"] if version else None,
        "revisado_manualmente": version["revisado_manualmente"] if version else None,
        "incumplimientos": version["incumplimientos"] if version else None,
        "url_origen": version["url_origen"] if version else None,
        # Borrador de edición sin confirmar (ver docs/gestion-documental.md
        # → "Edición desde el panel") — si "tmp" tiene contenido, el
        # frontend debe cargarlo en el editor en vez de "markdown" y avisar
        # de quién lo dejó a medias.
        "tmp": version["tmp"] if version else None,
        "tmp_usuario": await _nombre_usuario(version["tmp_id_usuario"]) if version else None,
        "tmp_fecha": version["tmp_fecha"] if version else None,
    }


# --- Edición desde el panel (ver docs/gestion-documental.md → "Edición
# desde el panel"): cualquier usuario con permiso de edición (no
# invitado). "borrador" guarda intermedios sin generar historial ni
# tocar el texto confirmado; "confirmar-edicion" es la única acción que
# de verdad cierra un cambio y lo dejar registrado, igual que un commit.


class GuardarBorrador(BaseModel):
    markdown: str


@app.put("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/versiones/{id_version}/borrador")
async def guardar_borrador_documento(
    id_proyecto: int, id_documento: int, id_version: int, datos: GuardarBorrador,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    version = await VersionesCRUD(config).guardar_borrador(id_version, datos.markdown, id_usuario)
    if not version or version["id_documento"] != id_documento:
        raise HTTPException(404, "Versión no encontrada")
    return {"id_version": version["id"], "tmp_fecha": version["tmp_fecha"]}


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/versiones/{id_version}/confirmar-edicion")
async def confirmar_edicion_documento(
    id_proyecto: int, id_documento: int, id_version: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    version_previa = await VersionesCRUD(config).obtener(id_version)
    if not version_previa or version_previa["id_documento"] != id_documento:
        raise HTTPException(404, "Versión no encontrada")
    version = await confirmar_edicion(config, id_version, id_usuario)
    if not version:
        raise HTTPException(400, "No hay ningún borrador pendiente que confirmar")
    return {"id_version": version["id"], "markdown": version["markdown_actual"]}


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/versiones/{id_version}/historial")
async def listar_historial_edicion(
    id_proyecto: int, id_documento: int, id_version: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """Más reciente primero. Cada entrada representa una confirmación:
    quién, cuándo, y el estado de antes — el diff con el estado de
    después se pide aparte (endpoint .../diff) para no calcularlo de
    más si nadie lo mira."""
    config = get_db_config(proyecto["id"])
    version = await VersionesCRUD(config).obtener(id_version)
    if not version or version["id_documento"] != id_documento:
        raise HTTPException(404, "Versión no encontrada")
    registros = await HistorialEdicionesCRUD(config).listar_de_version(id_version)
    return [
        {
            "id": r["id"],
            "fecha": r["fecha"],
            "usuario": await _nombre_usuario(r["id_usuario"]),
        }
        for r in registros
    ]


@app.get(
    "/v1/proyectos/{id_proyecto}/documentos/{id_documento}/versiones/{id_version}/historial/{id_registro}/diff"
)
async def obtener_diff_historial(
    id_proyecto: int, id_documento: int, id_version: int, id_registro: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> dict:
    """Diff entre el estado justo antes de esta confirmación
    (markdown_anterior) y el siguiente (el markdown_anterior de la
    confirmación posterior, o el markdown_actual vigente si esta es la
    más reciente)."""
    config = get_db_config(proyecto["id"])
    version = await VersionesCRUD(config).obtener(id_version)
    if not version or version["id_documento"] != id_documento:
        raise HTTPException(404, "Versión no encontrada")
    historial = HistorialEdicionesCRUD(config)
    registro = await historial.obtener(id_registro)
    if not registro or registro["id_version"] != id_version:
        raise HTTPException(404, "Registro de historial no encontrado")

    registros = await historial.listar_de_version(id_version)  # más reciente primero
    posicion = next(i for i, r in enumerate(registros) if r["id"] == id_registro)
    texto_despues = registros[posicion - 1]["markdown_anterior"] if posicion > 0 else version["markdown_actual"]
    return {"id": id_registro, "diff": calcular_diff(registro["markdown_anterior"], texto_despues)}


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/versiones/{id_version}/revertir/{id_registro}")
async def revertir_documento(
    id_proyecto: int, id_documento: int, id_version: int, id_registro: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    version_previa = await VersionesCRUD(config).obtener(id_version)
    if not version_previa or version_previa["id_documento"] != id_documento:
        raise HTTPException(404, "Versión no encontrada")
    version = await revertir_edicion(config, id_version, id_registro, id_usuario)
    if not version:
        raise HTTPException(404, "Registro de historial no encontrado")
    return {"id_version": version["id"], "markdown": version["markdown_actual"]}


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/archivar")
async def archivar_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    """Archiva un documento — cualquiera con acceso al proyecto puede
    hacerlo (a diferencia de las API keys, no es una acción de
    administración: es parte del día a día con los documentos)."""
    config = get_db_config(proyecto["id"])
    documento = await DocumentosCRUD(config).archivar(id_documento)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    return documento


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/desarchivar")
async def desarchivar_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    documento = await DocumentosCRUD(config).desarchivar(id_documento)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    return documento


# --- Registros de seguimiento (comentarios, anotaciones, observaciones,
# incidencias y sus resoluciones) — ver docs/gestion-documental.md →
# "Registros de seguimiento". Cuelgan del documento, no de una versión
# concreta: siguen disponibles con cualquier versión nueva. Leer: cualquiera
# con acceso al proyecto (incluido invitado, es consulta). Crear/resolver/
# asignar: igual criterio que editar el documento (no invitado, no
# superadmin) — de ahí sale además `creado_por`, el nombre real de quien
# actúa, sin tener que pedírselo.


class NuevoRegistro(BaseModel):
    tipo: str
    texto: str
    responsable: str | None = None
    responsable_email: str | None = None
    id_version_origen: int | None = None
    id_relacionado: int | None = None
    tipo_relacion: str | None = None


class ResolverIncidencia(BaseModel):
    texto_resolucion: str


class ActualizarResponsableRegistro(BaseModel):
    responsable: str | None = None
    responsable_email: str | None = None


class NuevaRelacionRegistro(BaseModel):
    id_destino: int
    tipo_relacion: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/registros")
async def listar_registros(
    id_proyecto: int, id_documento: int, tipo: str | None = None,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise HTTPException(404, "Documento no encontrado")
    return await listar_registros_documento(config, id_documento, tipo)


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/registros")
async def crear_registro_endpoint(
    id_proyecto: int, id_documento: int, datos: NuevoRegistro,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise HTTPException(404, "Documento no encontrado")
    creado_por = await _nombre_usuario(id_usuario) or "Usuario eliminado"
    try:
        id_registro = await crear_registro(
            config, id_documento, datos.tipo, datos.texto, creado_por,
            id_version_origen=datos.id_version_origen, responsable=datos.responsable,
            responsable_email=datos.responsable_email,
            id_relacionado=datos.id_relacionado, tipo_relacion=datos.tipo_relacion,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return await RegistrosCRUD(config).obtener(id_registro)


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/registros/{id_registro}/resolver")
async def resolver_incidencia_endpoint(
    id_proyecto: int, id_documento: int, id_registro: int, datos: ResolverIncidencia,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    creado_por = await _nombre_usuario(id_usuario) or "Usuario eliminado"
    try:
        return await resolver_incidencia(config, id_registro, datos.texto_resolucion, creado_por)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


@app.put("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/registros/{id_registro}/responsable")
async def actualizar_responsable_registro(
    id_proyecto: int, id_documento: int, id_registro: int, datos: ActualizarResponsableRegistro,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    registro = await RegistrosCRUD(config).actualizar_responsable(id_registro, datos.responsable, datos.responsable_email)
    if not registro:
        raise HTTPException(404, "Registro no encontrado")
    return registro


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/registros/{id_registro}/relaciones")
async def crear_relacion_registro(
    id_proyecto: int, id_documento: int, id_registro: int, datos: NuevaRelacionRegistro,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    registros = RegistrosCRUD(config)
    if not await registros.obtener(id_registro) or not await registros.obtener(datos.id_destino):
        raise HTTPException(404, "Registro no encontrado")
    id_relacion = await RegistrosRelacionesCRUD(config).crear(id_registro, datos.id_destino, datos.tipo_relacion)
    return await RegistrosRelacionesCRUD(config).obtener(id_relacion)


# --- Aviso de caducidad por email (ver docs/gestion-documental.md →
# "Fechas de caducidad") — solo admin, es configuración de cuenta, no día
# a día con documentos.


class ActualizarConfiguracionAvisos(BaseModel):
    email_avisos: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/configuracion/avisos")
async def obtener_configuracion_avisos(
    id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    return {"email_avisos": await ConfiguracionCRUD(config).obtener_email_avisos()}


@app.put("/v1/proyectos/{id_proyecto}/configuracion/avisos")
async def actualizar_configuracion_avisos(
    id_proyecto: int, datos: ActualizarConfiguracionAvisos,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    await ConfiguracionCRUD(config).actualizar_email_avisos(datos.email_avisos)
    return {"email_avisos": await ConfiguracionCRUD(config).obtener_email_avisos()}


# --- Cuenta de correo del cliente (ver docs/gestion-documental.md →
# "Ingesta por email") — su propia cuenta, no un buzón de la plataforma:
# sirve tanto para mandar los avisos de caducidad como para recibir
# documentos por email. Solo admin, igual que credenciales/avisos —
# lleva una contraseña.


SeguridadEmail = Literal["starttls", "ssl", "ninguna"]


class ActualizarCuentaEmail(BaseModel):
    direccion: str | None = None
    usuario: str | None = None
    password: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_seguridad: SeguridadEmail | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    imap_seguridad: SeguridadEmail | None = None


@app.get("/v1/proyectos/{id_proyecto}/configuracion/cuenta-email")
async def obtener_cuenta_email(
    id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    """Nunca incluye la contraseña, aunque esté guardada — igual que
    credenciales."""
    config = get_db_config(proyecto["id"])
    return await ConfiguracionCRUD(config).obtener_cuenta_email_metadatos()


@app.put("/v1/proyectos/{id_proyecto}/configuracion/cuenta-email")
async def actualizar_cuenta_email(
    id_proyecto: int, datos: ActualizarCuentaEmail,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    configuracion = ConfiguracionCRUD(config)
    await configuracion.actualizar_cuenta_email(
        datos.direccion, datos.usuario, datos.password,
        datos.smtp_host, datos.smtp_port, datos.smtp_seguridad,
        datos.imap_host, datos.imap_port, datos.imap_seguridad,
    )
    return await configuracion.obtener_cuenta_email_metadatos()


# --- Credenciales (ver docs/gestion-documental.md → "Credenciales") ---
# Solo admin_tenant/superadmin: es la única información realmente sensible
# de este panel, a diferencia de documentos o estilos.


class NuevaCredencial(BaseModel):
    nombre: str
    descripcion: str
    valor: str
    usuario: str | None = None


class ActualizarCredencial(BaseModel):
    descripcion: str | None = None
    valor: str | None = None
    usuario: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/credenciales")
async def listar_credenciales(
    id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await CredencialesCRUD(config).listar_metadatos()


@app.post("/v1/proyectos/{id_proyecto}/credenciales")
async def crear_credencial(
    id_proyecto: int, datos: NuevaCredencial, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    credenciales = CredencialesCRUD(config)
    if await credenciales.obtener_por_nombre(datos.nombre):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Ya existe una credencial llamada "{datos.nombre}"')
    id_credencial = await credenciales.crear(datos.nombre, datos.descripcion, datos.valor, datos.usuario)
    fila = await credenciales.obtener(id_credencial)
    return {k: v for k, v in fila.items() if k != "valor_cifrado"}


@app.put("/v1/proyectos/{id_proyecto}/credenciales/{id_credencial}")
async def actualizar_credencial(
    id_proyecto: int, id_credencial: int, datos: ActualizarCredencial,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    credenciales = CredencialesCRUD(config)
    if not await credenciales.obtener(id_credencial):
        raise HTTPException(404, "Credencial no encontrada")
    await credenciales.actualizar(id_credencial, datos.descripcion, datos.valor, datos.usuario)
    fila = await credenciales.obtener(id_credencial)
    return {k: v for k, v in fila.items() if k != "valor_cifrado"}


@app.delete("/v1/proyectos/{id_proyecto}/credenciales/{id_credencial}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_credencial(
    id_proyecto: int, id_credencial: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    config = get_db_config(proyecto["id"])
    await CredencialesCRUD(config).eliminar(id_credencial)


# --- Formulario de credencial (enlace de un solo uso) ---
# Solo para clientes MCP sin soporte de elicitation (PonNodo, ver
# mcp_server/herramientas/_herr_credenciales.py) — el resto sigue usando el
# formulario nativo del cliente MCP, esto no se les muestra nunca. A
# propósito público (sin JWT ni x-api-key): quien abre el enlace es la
# persona del cliente en su propio navegador, no una sesión del panel — la
# única protección es el token en sí (aleatorio, de un solo uso, caduca a
# los 15 minutos). Va antes del `app.mount("/", ...)` del frontend para que
# no se lo trague el fallback de la SPA.


def _pagina_formulario_credencial(nombre: str, descripcion: str, error: str | None = None) -> str:
    aviso = f'<p class="error">{html.escape(error)}</p>' if error else ""
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Credencial — {html.escape(nombre)}</title>
<style>
body {{ font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }}
label {{ display: block; margin-top: 1rem; font-weight: 600; }}
input {{ width: 100%; padding: 0.5rem; margin-top: 0.25rem; box-sizing: border-box; font-size: 1rem; }}
button {{ margin-top: 1.5rem; padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }}
.error {{ color: #b00020; }}
.ayuda {{ color: #555; font-size: 0.9rem; }}
</style></head><body>
<h1>Nueva credencial: {html.escape(nombre)}</h1>
<p class="ayuda">{html.escape(descripcion)}</p>
{aviso}
<form method="post">
<label for="valor">Contraseña o API key</label>
<input type="password" id="valor" name="valor" required autofocus>
<button type="submit">Guardar</button>
</form>
<p class="ayuda">Este valor se guarda cifrado en el servidor y no lo ve ni la IA ni nadie del equipo.</p>
</body></html>"""


def _pagina_mensaje_credencial(titulo: str, mensaje: str) -> str:
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>{html.escape(titulo)}</title>
<style>body {{ font-family: system-ui, sans-serif; max-width: 480px; margin: 3rem auto; padding: 0 1rem; }}</style>
</head><body><h1>{html.escape(titulo)}</h1><p>{html.escape(mensaje)}</p></body></html>"""


_ENLACE_NO_VALIDO = _pagina_mensaje_credencial(
    "Enlace no válido", "Este enlace ha caducado, ya se usó, o no existe. Pídele a tu IA que te dé uno nuevo.",
)


def _config_proyecto_o_none(id_proyecto: int) -> dict | None:
    """None si el proyecto no existe o no está activo — nunca deja
    escapar el ValueError de get_db_config() hacia esta ruta pública, que
    no debe distinguirle de un token inválido de cara a quien abre el
    enlace."""
    try:
        return get_db_config(id_proyecto)
    except ValueError:
        return None


@app.get("/v1/proyectos/{id_proyecto}/credenciales/solicitudes/{token}", response_class=HTMLResponse)
async def ver_formulario_credencial(id_proyecto: int, token: str) -> HTMLResponse:
    config = _config_proyecto_o_none(id_proyecto)
    solicitud = await SolicitudesCredencialCRUD(config).obtener_vigente(token) if config else None
    if not solicitud:
        return HTMLResponse(_ENLACE_NO_VALIDO, status_code=status.HTTP_404_NOT_FOUND)
    return HTMLResponse(_pagina_formulario_credencial(solicitud["nombre"], solicitud["descripcion"]))


@app.post("/v1/proyectos/{id_proyecto}/credenciales/solicitudes/{token}", response_class=HTMLResponse)
async def rellenar_formulario_credencial(id_proyecto: int, token: str, valor: str = Form(...)) -> HTMLResponse:
    config = _config_proyecto_o_none(id_proyecto)
    solicitudes = SolicitudesCredencialCRUD(config) if config else None
    solicitud = await solicitudes.obtener_vigente(token) if solicitudes else None
    if not solicitud:
        return HTMLResponse(_ENLACE_NO_VALIDO, status_code=status.HTTP_404_NOT_FOUND)

    credenciales = CredencialesCRUD(config)
    if await credenciales.obtener_por_nombre(solicitud["nombre"]):
        await solicitudes.marcar_usada(solicitud["id"])
        return HTMLResponse(
            _pagina_mensaje_credencial(
                "Ya existe esa credencial",
                f'Ya se creó una credencial llamada "{solicitud["nombre"]}" — este enlace ya no hace falta.',
            ),
            status_code=status.HTTP_409_CONFLICT,
        )

    if not valor:
        return HTMLResponse(_pagina_formulario_credencial(
            solicitud["nombre"], solicitud["descripcion"], error="Escribe un valor antes de guardar.",
        ))

    await credenciales.crear(solicitud["nombre"], solicitud["descripcion"], valor, solicitud["usuario"])
    await solicitudes.marcar_usada(solicitud["id"])
    return HTMLResponse(_pagina_mensaje_credencial(
        "Credencial guardada", f'Ya puedes cerrar esta ventana — "{solicitud["nombre"]}" está lista.',
    ))


# --- Tabla de estilos (ver docs/gestion-documental.md → "Tabla de estilos") ---
# Lectura: cualquiera con acceso al proyecto. Alta/edición/borrado (incluidas
# las imágenes): admin_tenant/superadmin, igual que las API keys — es
# configuración de fondo, no el día a día con documentos.


class NuevoEstilo(BaseModel):
    nombre_tipo: str
    instrucciones: str


class ActualizarEstilo(BaseModel):
    instrucciones: str


@app.get("/v1/proyectos/{id_proyecto}/estilos")
async def listar_estilos(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await EstilosCRUD(config).listar_tipos()


@app.post("/v1/proyectos/{id_proyecto}/estilos")
async def crear_estilo(
    id_proyecto: int, datos: NuevoEstilo, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    estilos = EstilosCRUD(config)
    if await estilos.obtener_por_tipo(datos.nombre_tipo):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Ya existe un estilo llamado "{datos.nombre_tipo}"')
    id_estilo = await estilos.insert({"nombre_tipo": datos.nombre_tipo, "instrucciones": datos.instrucciones})
    return await estilos.obtener(id_estilo)


@app.put("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}")
async def actualizar_estilo(
    id_proyecto: int, id_estilo: int, datos: ActualizarEstilo,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    estilos = EstilosCRUD(config)
    if not await estilos.obtener(id_estilo):
        raise HTTPException(404, "Estilo no encontrado")
    await estilos.update(id_estilo, {"instrucciones": datos.instrucciones})
    return await estilos.obtener(id_estilo)


@app.delete("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_estilo(
    id_proyecto: int, id_estilo: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    config = get_db_config(proyecto["id"])
    await EstilosCRUD(config).eliminar(id_estilo)


@app.get("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}/imagenes")
async def listar_imagenes_estilo(
    id_proyecto: int, id_estilo: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await EstilosImagenesCRUD(config).listar_metadatos_de_estilo(id_estilo)


@app.post("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}/imagenes")
async def subir_imagen_estilo(
    id_proyecto: int,
    id_estilo: int,
    nombre: str = Form(...),
    descripcion_uso: str = Form(...),
    archivo: UploadFile = File(...),
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    if not await EstilosCRUD(config).obtener(id_estilo):
        raise HTTPException(404, "Estilo no encontrado")
    contenido = await archivo.read()
    imagenes = EstilosImagenesCRUD(config)
    id_imagen = await imagenes.insert({
        "id_estilo": id_estilo,
        "nombre": nombre,
        "descripcion_uso": descripcion_uso,
        "imagen": contenido,
        "tipo_mime": archivo.content_type or "application/octet-stream",
    })
    fila = await imagenes.obtener(id_imagen)
    return {k: v for k, v in fila.items() if k != "imagen"}


@app.get("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}/imagenes/{id_imagen}/contenido")
async def ver_imagen_estilo(
    id_proyecto: int, id_estilo: int, id_imagen: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> Response:
    """Sirve el binario — para previsualizarla en el panel (pide sesión, no es pública)."""
    config = get_db_config(proyecto["id"])
    fila = await EstilosImagenesCRUD(config).obtener(id_imagen)
    if not fila or fila["id_estilo"] != id_estilo:
        raise HTTPException(404, "Imagen no encontrada")
    return Response(content=bytes(fila["imagen"]), media_type=fila["tipo_mime"])


@app.delete(
    "/v1/proyectos/{id_proyecto}/estilos/{id_estilo}/imagenes/{id_imagen}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_imagen_estilo(
    id_proyecto: int, id_estilo: int, id_imagen: int,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await EstilosImagenesCRUD(config).eliminar(id_imagen)


_api_keys = AsyncCrudBase(TABLA_API_KEYS, get_db_config("control"))


class NuevaApiKey(BaseModel):
    nombre: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/api-keys")
async def listar_api_keys(id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)) -> list[dict]:
    filas, _ = await _api_keys.listar(
        filtros={"id_proyecto": {"op": "=", "valor": id_proyecto}}, orden="id DESC", limit=100,
    )
    return [{k: v for k, v in fila.items() if k != "api_key_cifrada"} for fila in filas]


@app.post("/v1/proyectos/{id_proyecto}/api-keys")
async def emitir_api_key(
    id_proyecto: int, datos: NuevaApiKey, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    key = generar_api_key()
    id_api_key = await _api_keys.insert({
        "id_proyecto": id_proyecto,
        "nombre": datos.nombre,
        "prefijo": key["prefijo"],
        "api_key_cifrada": key["api_key_cifrada"],
    })
    return {"id": id_api_key, "nombre": datos.nombre, "prefijo": key["prefijo"], "api_key": key["api_key"]}


@app.post("/v1/api-keys/{id_api_key}/revocar")
async def revocar_api_key(id_api_key: int, fila: dict = Depends(api_key_de_gestion_documental)) -> dict:
    await _api_keys.update(id_api_key, {"estado": 0, "fecha_revocacion": datetime.now(timezone.utc)})
    actualizada = await _api_keys.obtener(id_api_key)
    return {k: v for k, v in actualizada.items() if k != "api_key_cifrada"}


@app.delete("/v1/api-keys/{id_api_key}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_api_key(id_api_key: int, fila: dict = Depends(api_key_de_gestion_documental)) -> None:
    await _api_keys.eliminar(id_api_key)


# El frontend compilado se sirve si existe (ver README de este repo sobre
# cómo se construye y se sube — no hay Node en el servidor, se compila
# en local y se copia ya construido).
_DIST_FRONTEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
if os.path.isdir(_DIST_FRONTEND):
    app.mount("/", StaticFiles(directory=_DIST_FRONTEND, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    host, puerto = os.environ.get("PANEL_CLIENTE_BIND", "127.0.0.1:8002").split(":")
    uvicorn.run(app, host=host, port=int(puerto))
