#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Panel para que el cliente vea y busque sus propios documentos (ver
docs/gestion-documental.md) — guardar/corregir sigue siendo solo por
conversación con su IA, esto no lo sustituye. También deja a un
admin_tenant gestionar las API keys de su proyecto (emitir, revocar,
eliminar), para conectar sus propios clientes MCP sin depender del
panel de administración.

Reutiliza el login del panel de administración del repo core (mismo
JWT, mismo usuario/contraseña de su empresa) y la misma capa `modelos`
que usan las herramientas MCP — no hay lógica de negocio duplicada.

Sirve a CUALQUIER cliente que use este producto (resuelve el proyecto
por id en cada petición, con su base de datos propia) — por eso, a
diferencia de mcp_server/herramientas/, sync.py del repo core NO lo
despliega dentro de apps/mcp_server/proyectos/<slug>/ de ningún cliente
concreto (eso lo dejaría atado a que ese proyecto en particular siga
existiendo). Va a una ruta estable por producto:
`apps/mcp_server/paneles_cliente/<nombre_del_repo>/`.

Pensado para ejecutarse ya desplegado, vía
`python -m apps.mcp_server.paneles_cliente.<nombre_del_repo>.panel_cliente.servidor`
(WorkingDirectory = raíz del repo core, de ahí resuelven los imports
absolutos a database.config_db / lib.*). Para probar en local antes de
desplegar, ver guia_nuevo_proyecto.md sobre cómo simular el árbol final."""

import os
from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from mtpk_mariadb import AsyncCrudBase
from pydantic import BaseModel

from database.config_db import get_db_config
from database.control.dependencias._dep_api_keys import TABLA_API_KEYS
from lib.api_keys import generar_api_key

from ..database.modelos._mod_chunks import ChunksCRUD
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_credenciales import CredencialesCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_documentos_pendientes import DocumentosPendientesCRUD
from ..database.modelos._mod_embeddings import generar_embeddings, obtener_api_key
from ..database.modelos._mod_estilos import EstilosCRUD, EstilosImagenesCRUD
from ..database.modelos._mod_tipos_documento import TiposDocumentoCRUD
from ..database.modelos._mod_versiones import VersionesCRUD
from .dependencias import admin_gestion_documental_actual, api_key_de_gestion_documental, es_admin_actual, proyecto_gestion_documental_actual

app = FastAPI(title="Gestión documental — Panel del cliente")

# En producción vive bajo el mismo dominio que el resto (/gd, mismo
# origen); en desarrollo el frontend corre aparte con Vite.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/v1/proyectos/{id_proyecto}")
async def ver_proyecto(
    id_proyecto: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    es_admin: bool = Depends(es_admin_actual),
) -> dict:
    """Datos básicos del proyecto (nombre, slug) — lo usa el frontend
    cuando entra directo a un proyecto conocido (enlace del superadmin
    desde el panel de administración) sin pasar por el selector.
    `es_admin` le dice al frontend si mostrar la gestión de API keys y de
    usuarios; `id_tenant` hace falta para gestionar los usuarios de la
    empresa (viven por tenant, no por proyecto)."""
    return {
        "id": proyecto["id"], "id_tenant": proyecto["id_tenant"], "nombre": proyecto["nombre"],
        "slug": proyecto["slug"], "es_admin": es_admin,
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
    config = get_db_config(proyecto["slug"])

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
    api_key = await obtener_api_key(proveedor_embedding, proyecto["slug"])
    if not api_key:
        raise HTTPException(503, "La búsqueda semántica no tiene una clave de API configurada")
    (embedding_pregunta,) = await generar_embeddings(proveedor_embedding, api_key, [q])
    return await ChunksCRUD(config).buscar_semantico(embedding_pregunta, limite=30)


# --- Documentos pendientes (subida masiva; más adelante también la
# ingesta por email escribirá aquí) — ver docs/gestion-documental.md →
# "Documentos pendientes". Mismo criterio de permisos que
# archivar/desarchivar: día a día con documentos, no admin.


@app.get("/v1/proyectos/{id_proyecto}/documentos-pendientes")
async def listar_documentos_pendientes(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
    await DocumentosPendientesCRUD(config).eliminar(id_pendiente)


# --- Tipos de documento (catálogo abierto, no una lista cerrada) ---
# Lectura para cualquiera con acceso (lo usa el filtro del listado);
# alta/borrado del catálogo, solo admin — igual criterio que estilos.


class NuevoTipoDocumento(BaseModel):
    nombre: str


@app.get("/v1/proyectos/{id_proyecto}/tipos-documento")
async def listar_tipos_documento(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["slug"])
    return await TiposDocumentoCRUD(config).listar_nombres()


@app.post("/v1/proyectos/{id_proyecto}/tipos-documento")
async def crear_tipo_documento(
    id_proyecto: int, datos: NuevoTipoDocumento, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["slug"])
    tipos = TiposDocumentoCRUD(config)
    existentes, _ = await tipos.listar(filtros={"nombre": {"op": "=", "valor": datos.nombre}}, limit=1)
    if existentes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Ya existe el tipo "{datos.nombre}"')
    id_tipo = await tipos.crear(datos.nombre)
    return await tipos.obtener(id_tipo)


@app.delete("/v1/proyectos/{id_proyecto}/tipos-documento/{id_tipo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_tipo_documento(
    id_proyecto: int, id_tipo: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    """Solo quita el tipo del catálogo de sugerencias — los documentos ya
    guardados con ese tipo no cambian, tipo_documento es texto libre, sin
    referencia a esta tabla."""
    config = get_db_config(proyecto["slug"])
    await TiposDocumentoCRUD(config).eliminar(id_tipo)


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}")
async def obtener_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["slug"])
    documento = await DocumentosCRUD(config).obtener(id_documento)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    version = await VersionesCRUD(config).obtener_completo(id_documento)
    return {
        **documento,
        "markdown": version["markdown_actual"] if version else None,
        "fecha_documento": version["fecha_documento"] if version else None,
        "fecha_caducidad": version["fecha_caducidad"] if version else None,
        "revisado_manualmente": version["revisado_manualmente"] if version else None,
        "url_origen": version["url_origen"] if version else None,
    }


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/archivar")
async def archivar_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    """Archiva un documento — cualquiera con acceso al proyecto puede
    hacerlo (a diferencia de las API keys, no es una acción de
    administración: es parte del día a día con los documentos)."""
    config = get_db_config(proyecto["slug"])
    documento = await DocumentosCRUD(config).archivar(id_documento)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    return documento


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/desarchivar")
async def desarchivar_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["slug"])
    documento = await DocumentosCRUD(config).desarchivar(id_documento)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    return documento


# --- Aviso de caducidad por email (ver docs/gestion-documental.md →
# "Fechas de caducidad") — solo admin, es configuración de cuenta, no día
# a día con documentos.


class ActualizarConfiguracionAvisos(BaseModel):
    email_avisos: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/configuracion/avisos")
async def obtener_configuracion_avisos(
    id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["slug"])
    return {"email_avisos": await ConfiguracionCRUD(config).obtener_email_avisos()}


@app.put("/v1/proyectos/{id_proyecto}/configuracion/avisos")
async def actualizar_configuracion_avisos(
    id_proyecto: int, datos: ActualizarConfiguracionAvisos,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
    return await ConfiguracionCRUD(config).obtener_cuenta_email_metadatos()


@app.put("/v1/proyectos/{id_proyecto}/configuracion/cuenta-email")
async def actualizar_cuenta_email(
    id_proyecto: int, datos: ActualizarCuentaEmail,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
    return await CredencialesCRUD(config).listar_metadatos()


@app.post("/v1/proyectos/{id_proyecto}/credenciales")
async def crear_credencial(
    id_proyecto: int, datos: NuevaCredencial, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
    await CredencialesCRUD(config).eliminar(id_credencial)


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
    config = get_db_config(proyecto["slug"])
    return await EstilosCRUD(config).listar_tipos()


@app.post("/v1/proyectos/{id_proyecto}/estilos")
async def crear_estilo(
    id_proyecto: int, datos: NuevoEstilo, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
    estilos = EstilosCRUD(config)
    if not await estilos.obtener(id_estilo):
        raise HTTPException(404, "Estilo no encontrado")
    await estilos.update(id_estilo, {"instrucciones": datos.instrucciones})
    return await estilos.obtener(id_estilo)


@app.delete("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_estilo(
    id_proyecto: int, id_estilo: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    config = get_db_config(proyecto["slug"])
    await EstilosCRUD(config).eliminar(id_estilo)


@app.get("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}/imagenes")
async def listar_imagenes_estilo(
    id_proyecto: int, id_estilo: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
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
    config = get_db_config(proyecto["slug"])
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
