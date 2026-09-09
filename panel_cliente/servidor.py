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

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mtpk_mariadb import AsyncCrudBase
from pydantic import BaseModel

from database.config_db import get_db_config
from database.control.dependencias._dep_api_keys import TABLA_API_KEYS
from lib.api_keys import generar_api_key

from ..database.modelos._mod_chunks import ChunksCRUD
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_embeddings import generar_embeddings, obtener_api_key
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
    `es_admin` le dice al frontend si mostrar la gestión de API keys."""
    return {"id": proyecto["id"], "nombre": proyecto["nombre"], "slug": proyecto["slug"], "es_admin": es_admin}


@app.get("/v1/proyectos/{id_proyecto}/documentos")
async def listar_o_buscar_documentos(
    id_proyecto: int, q: str | None = None, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    """Sin `q`: listado simple de documentos. Con `q`: búsqueda por
    contenido (fulltext o semántica, según el modo activo del proyecto)."""
    config = get_db_config(proyecto["slug"])

    if not q:
        # A diferencia de la búsqueda por contenido, el listado simple sí
        # incluye archivados (con su estado visible) — así se pueden
        # encontrar para desarchivarlos.
        return await DocumentosCRUD(config).buscar(limite=200, incluir_archivados=True)

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
        "revisado_manualmente": version["revisado_manualmente"] if version else None,
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
