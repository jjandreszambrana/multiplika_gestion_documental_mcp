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
import io
import json
import os
import zipfile
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import quote

import anthropic
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from mtpk_mariadb import AsyncCrudBase
from pydantic import BaseModel, Field

from database.config_db import get_anthropic_api_key, get_anthropic_modelo, get_db_config
from database.control.dependencias._dep_api_keys import TABLA_API_KEYS
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS
from database.control.dependencias._dep_roles import ID_ROL_OPERADOR
from database.control.dependencias._dep_usuarios import TABLA_USUARIOS
from lib.api_keys import comprobar_dueno_api_key, generar_api_key, nombre_api_key_disponible
from lib.roles_proyecto import ROLES_API_KEY, puede_editar_proyecto

from ..database import biblioteca_contable
from ..database.ayuda_gd import indice_ayuda, obtener_seccion
from ..database.modelos._mod_actividad import ActividadCRUD, registrar_sin_fallar
from ..database.modelos._mod_certificados import CertificadosCRUD, CertificadosLogCRUD
from ..database.modelos._mod_chat import ChatConversacionesCRUD
from ..database.modelos._mod_chat import _titulo_de_muestra as _titulo_de_muestra_chat
from ..database.modelos._mod_chunks import ChunksCRUD, limpiar_chunks_no_buscables, reindexar_version
from ..database.modelos._mod_compartidos import CompartidosCRUD, anular_compartido, crear_compartido
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._mod_credenciales import CredencialesCRUD
from ..database.modelos._mod_solicitudes_credencial import SolicitudesCredencialCRUD
from ..database.modelos._tipos_archivo import comprobar_tipo_archivo
from ..database.modelos._mod_credenciales_campos import CredencialesCamposCRUD
from ..database.modelos._mod_documentos import DocumentosCRUD
from ..database.modelos._mod_pdf import pdf_de_documento
from ..database.modelos._mod_documentos_pendientes import DocumentosPendientesCRUD
from ..database.modelos._mod_embeddings import generar_embeddings, obtener_api_key
from ..database.dependencias._dep_aprendizajes import ESTADO_CANDIDATO, ESTADO_PENDIENTE_REVISION, ESTADO_RECHAZADO
from ..database.dependencias._dep_enlaces import SENTIDO_CENTRAL, SENTIDO_ENLAZADA
from ..database.modelos._mod_aprendizajes import AprendizajesCRUD
from ..database.modelos._mod_enlaces import (
    EnlaceError,
    EnlacesCRUD,
    PreguntasPendientesCRUD,
    UsoEnlacesCRUD,
    emitir_key_gd_enlazada,
    llamar_enlace,
    probar_enlace,
    revocar_key,
    url_mcp_propia,
)
from ..database.dependencias._dep_activos_digitales import CAPACIDAD_POR_PLATAFORMA, NIVELES_PERMISO, PLATAFORMAS, PLATAFORMAS_CONECTABLES, TIPOS_ACTIVO
from ..database.modelos._mod_activos_digitales import ActivosDigitalesCRUD, catalogo_ajustes
from ..database.modelos._mod_cambios_externos import OPERACIONES, CambiosExternosCRUD
from ..database.modelos import _mod_vigilancia as vigilancia
from ..database.modelos import _mod_google as google_seo
from ..database.modelos import _mod_seo as seo
from ..database.modelos import _mod_bases_datos as bd
from ..database.modelos import _mod_geo as geo
from ..database.modelos._mod_ficheros import FicherosError, ficheros_de
from ..database.modelos._mod_publicaciones import PublicacionError, PublicacionesCRUD, medio_publico
from ..database.modelos._mod_activos_digitales import ajustes_efectivos
from ..database.modelos._mod_conector import ClienteConector, ConectorError, listar_remoto
from ..database.modelos._mod_entidades import DocumentosEntidadesCRUD, EntidadesCRUD
from ..database.modelos._mod_wordpress import WordPressError
from ..database.modelos._mod_envios import (
    EnviosCRUD,
    cancelar_envio,
    crear_envios,
    detectar_variables_documento,
    enviar_envio,
    reintentar_envio,
)
from ..database.modelos._mod_estilos import EstilosCRUD, EstilosImagenesCRUD
from ..database.modelos._mod_grupos import DocumentosGruposCRUD, GruposCRUD
from ..database.modelos._mod_historial_ediciones import HistorialEdicionesCRUD, calcular_diff
from ..database.modelos._mod_registros import (
    LIMITE_REGISTROS,
    ModelosRegistroCRUD,
    RegistrosCRUD,
    RegistrosDocumentosCRUD,
    plantilla_de_valores,
    sin_archivo,
)
from ..database.modelos._mod_reglas import (
    CARACTERES_POR_TOKEN,
    ReglasCRUD,
    reglas_heredadas,
    texto_reglas_globales,
)
from ..database.modelos._mod_programaciones import (
    actualizar_programacion,
    archivar_notificaciones,
    cambiar_pausa,
    contar_no_leidas,
    crear_programacion,
    eliminar_programacion,
    listar_notificaciones,
    listar_programaciones,
    marcar_hecho,
    marcar_leidas,
    obtener_programacion,
    purgar_notificaciones,
    usuarios_del_proyecto,
)
from ..database.modelos._mod_scripts import DocumentosScriptsCRUD, ScriptsCRUD
from ..database.modelos import _mod_bloc_notas as bloc
from ..database.modelos import _mod_seguimiento as seguimiento
from ..database.modelos import _mod_crm as crm
from ..database.modelos import _mod_erp as erp
from ..database.modelos import _mod_sif as sif
from ..database.modelos import _mod_copias_bd as copias_bd
from ..database.modelos._mod_notas import (
    NotasCRUD,
    NotasRelacionesCRUD,
    crear_nota,
    listar_notas_documento,
    resolver_incidencia,
)
from ..database.modelos._mod_tipos_documento import TiposDocumentoCRUD
from ..database.modelos._mod_versiones import VersionesCRUD, confirmar_edicion, guardar_documento, revertir_edicion
from . import chat_ia
from .actividad_panel import ActividadPanelMiddleware, _quien
from .extraccion_pdf import extraer_texto, texto_unido
from .dependencias import (
    Identidad,
    admin_certificados_actual,
    admin_gestion_documental_actual,
    api_key_de_gestion_documental,
    conversacion_chat_gd_actual,
    escritor_gestion_documental_actual,
    es_admin_actual,
    identidad_actual,
    proyecto_gestion_documental_actual,
    puede_editar_documento_actual,
    usuario_chat_gd_actual,
)

app = FastAPI(title="Gestión documental — Panel del cliente")

# En producción vive bajo el mismo dominio que el resto (/gd, mismo
# origen); en desarrollo el frontend corre aparte con Vite.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
    # X-Nuevo-Token: el frontend necesita poder LEER esta cabecera de la
    # respuesta (no solo mandarla el servidor) para renovar la sesión sola
    # — sin esto el navegador la oculta a JS en peticiones entre orígenes
    # (ver identidad_actual en dependencias.py).
    expose_headers=["X-Nuevo-Token"],
)

# Apunta en gd_actividad los cambios hechos desde el panel (ver
# actividad_panel.py). Recibe la lista de rutas (la misma, no una copia)
# para emparejar cada petición con su endpoint.
app.add_middleware(ActividadPanelMiddleware, rutas=app.router.routes)

_usuarios = AsyncCrudBase(TABLA_USUARIOS, get_db_config("control"))
_proyectos_control = AsyncCrudBase(TABLA_PROYECTOS, get_db_config("control"))


async def _nombre_usuario(id_usuario: int | None) -> str | None:
    if id_usuario is None:
        return None
    usuario = await _usuarios.obtener(id_usuario)
    return usuario["nombre"] if usuario else None


async def _reindexar_si_semantico(config: dict, id_proyecto: int, id_documento: int, id_version: int, markdown: str) -> None:
    """Igual que su equivalente de mcp_server/herramientas/_herr_documentos.py
    (no se reutiliza tal cual porque esa versión lanza ToolError, propio de
    fastmcp, en vez de HTTPException) — tras crear un documento a mano desde
    el panel, si el modo de búsqueda es semántico hay que indexarlo igual
    que si lo hubiera guardado la IA."""
    configuracion = ConfiguracionCRUD(config)
    modo = await configuracion.obtener_modo_busqueda()
    if modo != "semantico":
        return
    proveedor_embedding = await configuracion.obtener_proveedor_embedding()
    api_key = await obtener_api_key(proveedor_embedding, id_proyecto)
    if not api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "El modo de búsqueda es 'semantico' pero no hay ninguna clave de API de embeddings "
            "configurada para esta empresa",
        )
    await reindexar_version(config, proveedor_embedding, api_key, id_version, markdown)
    await limpiar_chunks_no_buscables(config, id_documento)


@app.get("/v1/ayuda")
async def obtener_ayuda() -> dict:
    """Índice de la ayuda (id, título y resumen de cada parte, en el orden
    del menú) — mismo contenido que la tool MCP `obtener_ayuda_gd()`, ver
    database/ayuda_gd.py. No depende de ningún proyecto ni requiere
    sesión: es contenido estático, igual para cualquier cliente."""
    return {"secciones": indice_ayuda()}


@app.get("/v1/ayuda/{id_seccion}")
async def obtener_seccion_ayuda(id_seccion: str) -> dict:
    """Una parte de la ayuda, en markdown (sin el título, que ya va en
    `titulo`)."""
    seccion = obtener_seccion(id_seccion)
    if not seccion:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa sección de la ayuda")
    return seccion


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
    modulo_contable = await ConfiguracionCRUD(get_db_config(proyecto["id"])).obtener_modulo_contable()
    return {
        "id": proyecto["id"], "id_tenant": proyecto["id_tenant"], "nombre": proyecto["nombre"],
        "es_admin": es_admin, "puede_editar": puede_editar, "modulo_contable": modulo_contable,
    }


# --- Asesor contable (ver docs/contabilidad/planificacion.md, fase 1). La
# biblioteca es la misma para todos los clientes (database/biblioteca_contable.py);
# solo se sirve en las GD con el apartado activado. Activarlo es cosa del admin.


class ActualizarModuloContable(BaseModel):
    activo: bool


async def biblioteca_contable_disponible(proyecto: dict = Depends(proyecto_gestion_documental_actual)) -> dict:
    if not await ConfiguracionCRUD(get_db_config(proyecto["id"])).obtener_modulo_contable():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El asesor contable no está activado en esta gestión documental")
    return proyecto


@app.put("/v1/proyectos/{id_proyecto}/contabilidad/modulo")
async def actualizar_modulo_contable(
    id_proyecto: int, datos: ActualizarModuloContable, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    await ConfiguracionCRUD(get_db_config(proyecto["id"])).actualizar_modulo_contable(datos.activo)
    return {"activo": datos.activo}


@app.get("/v1/proyectos/{id_proyecto}/contabilidad/indice")
async def indice_biblioteca_contable(
    id_proyecto: int, id_nodo: int | None = None, proyecto: dict = Depends(biblioteca_contable_disponible)
) -> dict:
    resultado = biblioteca_contable.indice(id_nodo)
    if resultado is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa parte de la biblioteca")
    return resultado


@app.get("/v1/proyectos/{id_proyecto}/contabilidad/buscar")
async def buscar_biblioteca_contable(
    id_proyecto: int, q: str, proyecto: dict = Depends(biblioteca_contable_disponible)
) -> dict:
    return {"temas": biblioteca_contable.buscar(q)}


@app.get("/v1/proyectos/{id_proyecto}/contabilidad/temas/{id_tema}")
async def obtener_tema_contable(
    id_proyecto: int, id_tema: int, proyecto: dict = Depends(biblioteca_contable_disponible)
) -> dict:
    resultado = biblioteca_contable.tema(id_tema)
    if resultado is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese tema")
    return resultado


@app.get("/v1/proyectos/{id_proyecto}/contabilidad/fuentes/{id_fuente:path}")
async def obtener_fuente_contable(
    id_proyecto: int, id_fuente: str, proyecto: dict = Depends(biblioteca_contable_disponible)
) -> dict:
    resultado = biblioteca_contable.fuente(id_fuente)
    if resultado is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No se conserva esa fuente")
    return resultado


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
        coincidencias = await VersionesCRUD(config).buscar_fulltext(q, limite=30)
    else:
        proveedor_embedding = await configuracion.obtener_proveedor_embedding()
        api_key = await obtener_api_key(proveedor_embedding, proyecto["id"])
        if not api_key:
            raise HTTPException(503, "La búsqueda semántica no tiene una clave de API configurada")
        (embedding_pregunta,) = await generar_embeddings(proveedor_embedding, api_key, [q])
        coincidencias = await ChunksCRUD(config).buscar_semantico(embedding_pregunta, limite=30)

    # Una fila por documento (el fragmento más relevante), con los mismos
    # campos que el listado simple para que el panel pinte las mismas columnas.
    fragmentos = {}
    for c in coincidencias:
        fragmentos.setdefault(c["id_documento"], c["fragmento"])
    documentos = {
        d["id"]: d for d in await DocumentosCRUD(config).buscar(ids=list(fragmentos), limite=len(fragmentos))
    }
    return [{**documentos[i], "fragmento": f} for i, f in fragmentos.items() if i in documentos]


# --- Alta manual desde el panel: a diferencia de guardar_documento_gd
# (conversación con la IA, que hace la conversión a markdown), aquí el
# propio usuario pega o escribe el markdown ya convertido — pensado para
# cuando no hace falta pasar por la IA (texto que ya se tiene, o una
# corrección rápida). Puede adjuntar además el PDF original tal cual, sin
# convertirlo (no hay OCR en el panel): queda guardado solo como
# referencia descargable, el markdown pegado sigue siendo lo que manda y
# lo que se busca. Mismo criterio de permisos que editar un documento.


@app.post("/v1/proyectos/{id_proyecto}/documentos", status_code=status.HTTP_201_CREATED)
async def crear_documento_manual(
    id_proyecto: int,
    nombre: str = Form(...),
    tipo_documento: str = Form(...),
    markdown: str = Form(...),
    fecha_documento: str = Form(...),
    fecha_caducidad: str | None = Form(default=None),
    ambito: str | None = Form(default=None),
    todas_versiones_buscables: bool = Form(default=False),
    archivo_original: UploadFile | None = File(default=None),
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        if archivo_original is not None:
            comprobar_tipo_archivo(archivo_original.content_type, archivo_original.filename)
        resultado = await guardar_documento(
            config, nombre, tipo_documento, markdown, fecha_documento,
            todas_versiones_buscables=todas_versiones_buscables,
            fecha_caducidad=fecha_caducidad or None, ambito=ambito or None,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    if archivo_original is not None:
        contenido = await archivo_original.read()
        await VersionesCRUD(config).guardar_archivo_original(
            resultado["id_version"], contenido,
            archivo_original.content_type or "application/octet-stream",
            archivo_original.filename or "documento.pdf",
        )

    await _reindexar_si_semantico(config, proyecto["id"], resultado["id_documento"], resultado["id_version"], markdown)
    return resultado


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/versiones/{id_version}/archivo-original")
async def descargar_archivo_original_documento(
    id_proyecto: int, id_documento: int, id_version: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> Response:
    config = get_db_config(proyecto["id"])
    version = await VersionesCRUD(config).obtener(id_version)
    if not version or version["id_documento"] != id_documento:
        raise HTTPException(404, "Versión no encontrada")
    if not version["archivo_original"]:
        raise HTTPException(404, "Esta versión no tiene ningún archivo original adjunto")
    nombre_codificado = quote(version["archivo_original_nombre"])
    return Response(
        content=version["archivo_original"], media_type=version["archivo_original_tipo_mime"],
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{nombre_codificado}"},
    )


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
    try:
        for archivo in archivos:
            comprobar_tipo_archivo(archivo.content_type, archivo.filename)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
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


async def _obtener_pendiente_o_404(config: dict, id_pendiente: int) -> dict:
    fila = await DocumentosPendientesCRUD(config).obtener(id_pendiente)
    if not fila:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Documento pendiente no encontrado")
    return fila


@app.get("/v1/proyectos/{id_proyecto}/documentos-pendientes/{id_pendiente}/vista-previa")
async def vista_previa_documento_pendiente(
    id_proyecto: int, id_pendiente: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    """Extracción de texto instantánea y sin IA (pdfplumber + OCR de
    respaldo con Tesseract, ver panel_cliente/extraccion_pdf.py) — v1,
    "puede verse un poco desestructurado" a propósito: es solo una vista
    previa rápida, no persiste nada, se puede pedir las veces que haga
    falta."""
    config = get_db_config(proyecto["id"])
    fila = await _obtener_pendiente_o_404(config, id_pendiente)
    try:
        paginas = extraer_texto(fila["archivo"], fila["tipo_mime"])
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return {"paginas": paginas, "texto": texto_unido(paginas)}


MAX_TOKENS_ESTRUCTURAR_PENDIENTE = 8000  # borrador de markdown, no debería doblar el texto original


class EstructurarDocumentoPendiente(BaseModel):
    texto: str | None = None  # si el frontend ya llamó a vista-previa, se lo pasa para no re-extraerlo


PROMPT_ESTRUCTURAR_PENDIENTE = (
    "El siguiente texto se extrajo automáticamente de un documento, página a página "
    "(directo o por OCR de un escaneo) — puede venir con saltos de línea sueltos o "
    "algún error de OCR. Conviértelo en markdown limpio y bien estructurado (títulos, "
    "tablas, listas donde corresponda). Sé fiel al original: no inventes datos que no "
    "estén, no resumas ni omitas contenido. Devuelve solo el markdown, sin ningún "
    "comentario tuyo antes o después.\n\n---\n\n{texto}"
)


@app.post("/v1/proyectos/{id_proyecto}/documentos-pendientes/{id_pendiente}/estructurar")
async def estructurar_documento_pendiente(
    id_proyecto: int,
    id_pendiente: int,
    datos: EstructurarDocumentoPendiente,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> dict:
    """Manda el texto ya extraído (sin IA) a Claude para que lo convierta
    en markdown limpio — mucho más barato que mandarle el PDF o las
    imágenes directamente. Solo un borrador para que el cliente lo revise:
    NO guarda nada como documento definitivo (eso sigue siendo, en esta
    v1, exclusivamente por conversación con la IA — ver
    docs/gestion-documental.md → "Documentos pendientes")."""
    config = get_db_config(proyecto["id"])
    texto = datos.texto
    if not texto:
        fila = await _obtener_pendiente_o_404(config, id_pendiente)
        try:
            texto = texto_unido(extraer_texto(fila["archivo"], fila["tipo_mime"]))
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    clave = await get_anthropic_api_key(proyecto["id"])
    if not clave:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Esta empresa no tiene configurada una clave de API de Claude")
    modelo = await get_anthropic_modelo(proyecto["id"])
    cliente = anthropic.AsyncAnthropic(api_key=clave)
    respuesta = await cliente.messages.create(
        model=modelo,
        max_tokens=MAX_TOKENS_ESTRUCTURAR_PENDIENTE,
        messages=[{"role": "user", "content": PROMPT_ESTRUCTURAR_PENDIENTE.format(texto=texto)}],
    )
    markdown = "\n".join(b.text for b in respuesta.content if b.type == "text")
    return {"markdown": markdown}


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
        "archivo_original_nombre": version["archivo_original_nombre"] if version else None,
        # Borrador de edición sin confirmar (ver docs/gestion-documental.md
        # → "Edición desde el panel") — si "tmp" tiene contenido, el
        # frontend debe cargarlo en el editor en vez de "markdown" y avisar
        # de quién lo dejó a medias.
        "tmp": version["tmp"] if version else None,
        "tmp_usuario": await _nombre_usuario(version["tmp_id_usuario"]) if version else None,
        "tmp_fecha": version["tmp_fecha"] if version else None,
    }


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/pdf")
async def exportar_documento_pdf(
    id_proyecto: int, id_documento: int, incluir_metadatos: bool = False,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> Response:
    """Exporta la versión vigente del documento a PDF, con el mismo
    formato que se ve en el panel — ver pdf_de_documento en
    database/modelos/_mod_pdf.py."""
    config = get_db_config(proyecto["id"])
    documento = await DocumentosCRUD(config).obtener(id_documento)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    version = await VersionesCRUD(config).obtener_vigente(id_documento)
    if not version:
        raise HTTPException(404, "Este documento no tiene ninguna versión vigente")

    try:
        pdf_bytes = await pdf_de_documento(config, documento, version, incluir_metadatos)
    except RuntimeError as e:
        raise HTTPException(500, str(e)) from e

    nombre_archivo = quote(f"{documento['nombre']}.pdf")
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{nombre_archivo}"},
    )


# --- Edición desde el panel (ver docs/gestion-documental.md → "Edición
# desde el panel"): cualquier usuario con permiso de edición (no
# invitado). "borrador" guarda intermedios sin generar historial ni
# tocar el texto confirmado; "confirmar-edicion" es la única acción que
# de verdad cierra un cambio y lo dejar registrado, igual que un commit.


class ActualizarMetadatos(BaseModel):
    tipo_documento: str
    ambito: str | None = None
    fecha_caducidad: str | None = None


@app.put("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/metadatos")
async def actualizar_metadatos_documento(
    id_proyecto: int, id_documento: int, datos: ActualizarMetadatos,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    """Tipo de documento y ámbito viven en gd_documentos; fecha de
    caducidad vive en la versión vigente (ver gd_versiones) — mismos
    metadatos que se piden al guardar por conversación, editables aquí
    a mano si hace falta corregirlos."""
    config = get_db_config(proyecto["id"])
    await TiposDocumentoCRUD(config).asegurar_existe(datos.tipo_documento)
    documento = await DocumentosCRUD(config).actualizar_metadatos(
        id_documento, datos.tipo_documento, datos.ambito
    )
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    version = await VersionesCRUD(config).actualizar_fecha_caducidad(id_documento, datos.fecha_caducidad)
    return {**documento, "fecha_caducidad": version["fecha_caducidad"] if version else None}


class AsignarEstilo(BaseModel):
    id_estilo: int | None = None


@app.put("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/estilo")
async def asignar_estilo_documento(
    id_proyecto: int, id_documento: int, datos: AsignarEstilo,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    """Vincula (o desvincula, con id_estilo=null) el documento a un estilo
    de informe — mismo vínculo que ya podía cambiar la IA con
    asignar_estilo_documento_gd, expuesto aquí también para el panel."""
    config = get_db_config(proyecto["id"])
    documento = await DocumentosCRUD(config).asignar_estilo(id_documento, datos.id_estilo)
    if not documento:
        raise HTTPException(404, "Documento no encontrado")
    return documento


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


@app.delete(
    "/v1/proyectos/{id_proyecto}/documentos/{id_documento}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> None:
    """Borrado definitivo — solo archivados y nunca enviados (ver
    DocumentosCRUD.eliminar_definitivo). Invitados no."""
    resultado = await DocumentosCRUD(get_db_config(proyecto["id"])).eliminar_definitivo(id_documento)
    if resultado == "no_existe":
        raise HTTPException(404, "Documento no encontrado")
    if resultado == "no_archivado":
        raise HTTPException(409, "Solo se puede borrar un documento archivado")
    if resultado == "enviado":
        raise HTTPException(409, "Este documento se ha enviado por correo: no se puede borrar, solo dejarlo archivado")


class CambioReservado(BaseModel):
    reservado: bool


@app.put("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/reservado")
async def cambiar_reservado_documento(
    id_proyecto: int, id_documento: int, datos: CambioReservado,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    """Reservado = no se comparte con las GDs enlazadas a esta (ver
    "GDs enlazadas"). Cualquiera que pueda escribir, como editar."""
    documento = await DocumentosCRUD(get_db_config(proyecto["id"])).marcar_reservado(id_documento, datos.reservado)
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


# --- Notas de seguimiento (comentarios, anotaciones, observaciones,
# incidencias y sus resoluciones) — ver docs/gestion-documental.md →
# "Notas de seguimiento". Cuelgan del documento, no de una versión
# concreta: siguen disponibles con cualquier versión nueva. Leer: cualquiera
# con acceso al proyecto (incluido invitado, es consulta). Crear/resolver/
# asignar: igual criterio que editar el documento (no invitado, no
# superadmin) — de ahí sale además `creado_por`, el nombre real de quien
# actúa, sin tener que pedírselo.


class NuevaNota(BaseModel):
    tipo: str
    texto: str
    responsable: str | None = None
    responsable_email: str | None = None
    id_version_origen: int | None = None
    id_relacionado: int | None = None
    tipo_relacion: str | None = None


class ResolverIncidencia(BaseModel):
    texto_resolucion: str


class ActualizarResponsableNota(BaseModel):
    responsable: str | None = None
    responsable_email: str | None = None


class NuevaRelacionNota(BaseModel):
    id_destino: int
    tipo_relacion: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/notas")
async def listar_notas(
    id_proyecto: int, id_documento: int, tipo: str | None = None,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise HTTPException(404, "Documento no encontrado")
    return await listar_notas_documento(config, id_documento, tipo)


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/notas")
async def crear_nota_endpoint(
    id_proyecto: int, id_documento: int, datos: NuevaNota,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    if not await DocumentosCRUD(config).obtener(id_documento):
        raise HTTPException(404, "Documento no encontrado")
    creado_por = await _nombre_usuario(id_usuario) or "Usuario eliminado"
    try:
        id_nota = await crear_nota(
            config, id_documento, datos.tipo, datos.texto, creado_por,
            id_version_origen=datos.id_version_origen, responsable=datos.responsable,
            responsable_email=datos.responsable_email,
            id_relacionado=datos.id_relacionado, tipo_relacion=datos.tipo_relacion,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return await NotasCRUD(config).obtener(id_nota)


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/notas/{id_nota}/resolver")
async def resolver_incidencia_endpoint(
    id_proyecto: int, id_documento: int, id_nota: int, datos: ResolverIncidencia,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    creado_por = await _nombre_usuario(id_usuario) or "Usuario eliminado"
    try:
        return await resolver_incidencia(config, id_nota, datos.texto_resolucion, creado_por)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


@app.put("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/notas/{id_nota}/responsable")
async def actualizar_responsable_nota(
    id_proyecto: int, id_documento: int, id_nota: int, datos: ActualizarResponsableNota,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    nota = await NotasCRUD(config).actualizar_responsable(id_nota, datos.responsable, datos.responsable_email)
    if not nota:
        raise HTTPException(404, "Nota no encontrada")
    return nota


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/notas/{id_nota}/relaciones")
async def crear_relacion_nota(
    id_proyecto: int, id_documento: int, id_nota: int, datos: NuevaRelacionNota,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    notas = NotasCRUD(config)
    if not await notas.obtener(id_nota) or not await notas.obtener(datos.id_destino):
        raise HTTPException(404, "Nota no encontrada")
    id_relacion = await NotasRelacionesCRUD(config).crear(id_nota, datos.id_destino, datos.tipo_relacion)
    return await NotasRelacionesCRUD(config).obtener(id_relacion)


# --- Grupos de documentos (ver docs/gestion-documental.md → "Grupos de
# documentos"): un grupo agrupa documentos para un fin concreto; no todos
# los documentos están en uno, y uno mismo puede estar en varios. Mismo
# criterio de permisos que notas/archivar: día a día con documentos,
# no administración — cualquiera con acceso puede leer, puede_editar hace
# falta para crear/asignar/quitar.


class NuevoGrupo(BaseModel):
    nombre: str
    proposito: str


class ActualizarGrupo(BaseModel):
    nombre: str | None = None
    proposito: str | None = None


class AsignarDocumentoGrupo(BaseModel):
    id_documento: int


@app.get("/v1/proyectos/{id_proyecto}/grupos")
async def listar_grupos(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    grupos = await GruposCRUD(config).listar_todos()
    recuento = await DocumentosGruposCRUD(config).contar_por_grupo()
    return [{**g, "total_documentos": recuento.get(g["id"], 0)} for g in grupos]


@app.post("/v1/proyectos/{id_proyecto}/grupos")
async def crear_grupo(
    id_proyecto: int, datos: NuevoGrupo,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    grupos = GruposCRUD(config)
    if await grupos.obtener_por_nombre(datos.nombre):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Ya existe un grupo llamado "{datos.nombre}"')
    id_grupo = await grupos.crear(datos.nombre, datos.proposito)
    return await grupos.obtener(id_grupo)


@app.put("/v1/proyectos/{id_proyecto}/grupos/{id_grupo}")
async def actualizar_grupo(
    id_proyecto: int, id_grupo: int, datos: ActualizarGrupo,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    grupo = await GruposCRUD(config).actualizar(id_grupo, datos.nombre, datos.proposito)
    if not grupo:
        raise HTTPException(404, "Grupo no encontrado")
    return grupo


@app.delete("/v1/proyectos/{id_proyecto}/grupos/{id_grupo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_grupo(
    id_proyecto: int, id_grupo: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await GruposCRUD(config).eliminar(id_grupo)


@app.get("/v1/proyectos/{id_proyecto}/grupos/{id_grupo}/documentos")
async def listar_documentos_grupo(
    id_proyecto: int, id_grupo: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    if not await GruposCRUD(config).obtener(id_grupo):
        raise HTTPException(404, "Grupo no encontrado")
    return await DocumentosGruposCRUD(config).listar_documentos_de_grupo(id_grupo, incluir_archivados=True)


@app.post("/v1/proyectos/{id_proyecto}/grupos/{id_grupo}/documentos")
async def asignar_documento_grupo(
    id_proyecto: int, id_grupo: int, datos: AsignarDocumentoGrupo,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    if not await GruposCRUD(config).obtener(id_grupo):
        raise HTTPException(404, "Grupo no encontrado")
    if not await DocumentosCRUD(config).obtener(datos.id_documento):
        raise HTTPException(404, "Documento no encontrado")
    await DocumentosGruposCRUD(config).asignar(datos.id_documento, id_grupo)
    return {"id_documento": datos.id_documento, "id_grupo": id_grupo}


@app.delete(
    "/v1/proyectos/{id_proyecto}/grupos/{id_grupo}/documentos/{id_documento}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def quitar_documento_grupo(
    id_proyecto: int, id_grupo: int, id_documento: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await DocumentosGruposCRUD(config).quitar(id_documento, id_grupo)


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/grupos")
async def listar_grupos_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await DocumentosGruposCRUD(config).listar_grupos_de_documento(id_documento)


# --- Entidades (ver docs/gestion-documental.md → "Entidades"): clientes,
# proveedores, empleados... relacionables con documentos. Mismo criterio de
# permisos que grupos/notas: cualquiera con acceso lee, puede_editar
# hace falta para crear/editar/borrar/relacionar.


class DatosEntidad(BaseModel):
    nombre: str
    tipo: str
    direccion: str | None = None
    localidad: str | None = None
    provincia: str | None = None
    codigo_postal: str | None = None
    pais: str | None = None
    telefono: str | None = None
    email: str | None = None
    observaciones: str | None = None
    codigo: str | None = None
    nif: str | None = None


class ActualizarEntidad(BaseModel):
    nombre: str | None = None
    tipo: str | None = None
    direccion: str | None = None
    localidad: str | None = None
    provincia: str | None = None
    codigo_postal: str | None = None
    pais: str | None = None
    telefono: str | None = None
    email: str | None = None
    observaciones: str | None = None
    codigo: str | None = None
    nif: str | None = None


class RelacionarDocumentoEntidad(BaseModel):
    id_documento: int


@app.get("/v1/proyectos/{id_proyecto}/entidades")
async def listar_entidades(
    id_proyecto: int, q: str | None = None, tipo: str | None = None,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await EntidadesCRUD(config).buscar(q, tipo)


@app.post("/v1/proyectos/{id_proyecto}/entidades")
async def crear_entidad(
    id_proyecto: int, datos: DatosEntidad,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    entidades = EntidadesCRUD(config)
    if datos.codigo and await entidades.obtener_por_codigo(datos.codigo):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Ya existe una entidad con el código "{datos.codigo}"')
    id_entidad = await entidades.crear(datos.model_dump())
    return await entidades.obtener(id_entidad)


@app.get("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}")
async def obtener_entidad(
    id_proyecto: int, id_entidad: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    entidad = await EntidadesCRUD(config).obtener(id_entidad)
    if not entidad:
        raise HTTPException(404, "Entidad no encontrada")
    return entidad


@app.put("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}")
async def actualizar_entidad(
    id_proyecto: int, id_entidad: int, datos: ActualizarEntidad,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    entidades = EntidadesCRUD(config)
    if datos.codigo:
        existente = await entidades.obtener_por_codigo(datos.codigo)
        if existente and existente["id"] != id_entidad:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Ya existe una entidad con el código "{datos.codigo}"')
    entidad = await entidades.actualizar_campos(id_entidad, datos.model_dump())
    if not entidad:
        raise HTTPException(404, "Entidad no encontrada")
    return entidad


@app.delete("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_entidad(
    id_proyecto: int, id_entidad: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await EntidadesCRUD(config).eliminar(id_entidad)


@app.get("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/documentos")
async def listar_documentos_entidad(
    id_proyecto: int, id_entidad: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    if not await EntidadesCRUD(config).obtener(id_entidad):
        raise HTTPException(404, "Entidad no encontrada")
    return await DocumentosEntidadesCRUD(config).listar_documentos_de_entidad(id_entidad, incluir_archivados=True)


@app.post("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/documentos")
async def relacionar_documento_entidad(
    id_proyecto: int, id_entidad: int, datos: RelacionarDocumentoEntidad,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    if not await EntidadesCRUD(config).obtener(id_entidad):
        raise HTTPException(404, "Entidad no encontrada")
    if not await DocumentosCRUD(config).obtener(datos.id_documento):
        raise HTTPException(404, "Documento no encontrado")
    await DocumentosEntidadesCRUD(config).asignar(datos.id_documento, id_entidad)
    return {"id_documento": datos.id_documento, "id_entidad": id_entidad}


@app.delete(
    "/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/documentos/{id_documento}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def quitar_relacion_documento_entidad(
    id_proyecto: int, id_entidad: int, id_documento: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await DocumentosEntidadesCRUD(config).quitar(id_documento, id_entidad)


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/entidades")
async def listar_entidades_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await DocumentosEntidadesCRUD(config).listar_entidades_de_documento(id_documento)


# --- Comunicaciones y envíos (ver docs/gestion-documental.md →
# "Comunicaciones y envíos"): un documento usado como plantilla, con
# variables `{{asi}}`, se manda por email a una o varias entidades. Mismo
# criterio de permisos que notas/grupos/entidades: cualquiera con
# acceso lee, puede_editar hace falta para crear/mandar/cancelar/reintentar.


class NuevosEnvios(BaseModel):
    ids_entidad: list[int]
    variables_personalizadas: dict = {}
    fecha_programada: str | None = None
    enviar_ya: bool = False


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/variables")
async def detectar_variables_documento_endpoint(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        return await detectar_variables_documento(config, id_documento)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/envios")
async def listar_envios_documento_endpoint(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await EnviosCRUD(config).listar_de_documento(id_documento)


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/envios")
async def crear_envios_endpoint(
    id_proyecto: int, id_documento: int, datos: NuevosEnvios,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    creado_por = await _nombre_usuario(id_usuario) or "Usuario eliminado"
    fecha = datetime.fromisoformat(datos.fecha_programada) if datos.fecha_programada else None
    try:
        creados = await crear_envios(
            config, id_documento, datos.ids_entidad, datos.variables_personalizadas, creado_por, fecha,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e

    if datos.enviar_ya:
        creados = [
            await enviar_envio(config, e["id"]) if e["estado"] == "programado" else e
            for e in creados
        ]
    return creados


@app.get("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/envios")
async def listar_envios_entidad_endpoint(
    id_proyecto: int, id_entidad: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await EnviosCRUD(config).listar_de_entidad(id_entidad)


@app.post("/v1/proyectos/{id_proyecto}/envios/{id_envio}/cancelar")
async def cancelar_envio_endpoint(
    id_proyecto: int, id_envio: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        return await cancelar_envio(config, id_envio)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


@app.post("/v1/proyectos/{id_proyecto}/envios/{id_envio}/reintentar")
async def reintentar_envio_endpoint(
    id_proyecto: int, id_envio: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        return await reintentar_envio(config, id_envio)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


# --- Compartir un documento por enlace (ver docs/gestion-documental.md →
# "Compartir un documento por enlace"). Mismo criterio de permisos que los
# envíos: cualquiera con acceso ve los enlaces, puede_editar hace falta
# para crearlos y anularlos. La página pública que abre el destinatario va
# más abajo, junto al formulario de credencial (también pública).


class NuevoCompartido(BaseModel):
    dias_validez: int = 7
    incluir_original: bool = False
    email_destino: str | None = None
    mensaje: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/compartidos")
async def listar_compartidos_endpoint(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    try:
        return await CompartidosCRUD(config).listar_de_documento(proyecto["id"], id_documento)
    except ValueError as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e)) from e


@app.post("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/compartidos")
async def crear_compartido_endpoint(
    id_proyecto: int, id_documento: int, datos: NuevoCompartido,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    creado_por = await _nombre_usuario(id_usuario) or "Usuario eliminado"
    try:
        return await crear_compartido(
            config, proyecto["id"], id_documento, creado_por, datos.dias_validez,
            datos.incluir_original, (datos.email_destino or "").strip() or None, datos.mensaje,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


@app.post("/v1/proyectos/{id_proyecto}/compartidos/{id_compartido}/anular")
async def anular_compartido_endpoint(
    id_proyecto: int, id_compartido: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        return await anular_compartido(config, proyecto["id"], id_compartido)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


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


class CampoExtraCredencial(BaseModel):
    nombre: str
    valor: str


class NuevaCredencial(BaseModel):
    nombre: str
    descripcion: str
    valor: str
    usuario: str | None = None
    campos_extra: list[CampoExtraCredencial] = []


class ActualizarCredencial(BaseModel):
    descripcion: str | None = None
    valor: str | None = None
    usuario: str | None = None
    campos_extra: list[CampoExtraCredencial] | None = None


async def _con_campos_extra(config: dict, fila: dict) -> dict:
    nombres = await CredencialesCamposCRUD(config).listar_nombres(fila["id"])
    return {**{k: v for k, v in fila.items() if k != "valor_cifrado"}, "campos_extra": nombres}


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
    try:
        id_credencial = await credenciales.crear(
            datos.nombre, datos.descripcion, datos.valor, datos.usuario,
            campos_extra=[c.model_dump() for c in datos.campos_extra],
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    fila = await credenciales.obtener(id_credencial)
    return await _con_campos_extra(config, fila)


@app.put("/v1/proyectos/{id_proyecto}/credenciales/{id_credencial}")
async def actualizar_credencial(
    id_proyecto: int, id_credencial: int, datos: ActualizarCredencial,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    credenciales = CredencialesCRUD(config)
    if not await credenciales.obtener(id_credencial):
        raise HTTPException(404, "Credencial no encontrada")
    campos_extra = [c.model_dump() for c in datos.campos_extra] if datos.campos_extra is not None else None
    await credenciales.actualizar(id_credencial, datos.descripcion, datos.valor, datos.usuario, campos_extra)
    fila = await credenciales.obtener(id_credencial)
    return await _con_campos_extra(config, fila)


@app.delete("/v1/proyectos/{id_proyecto}/credenciales/{id_credencial}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_credencial(
    id_proyecto: int, id_credencial: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    config = get_db_config(proyecto["id"])
    await CredencialesCRUD(config).eliminar(id_credencial)


# --- Certificados de entidades (ver docs/gestion-documental.md →
# "Certificados de entidades") --- Igual de sensible que las
# credenciales: solo admin_tenant. La descarga, además, exige un
# usuario real (no superadmin) porque queda registrada en
# gd_certificados_log con su id.


class ActualizarCertificado(BaseModel):
    nombre: str
    descripcion: str | None = None
    id_entidad: int | None = None


@app.get("/v1/proyectos/{id_proyecto}/certificados")
async def listar_certificados(
    id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await CertificadosCRUD(config).listar_metadatos()


@app.post("/v1/proyectos/{id_proyecto}/certificados")
async def crear_certificado(
    id_proyecto: int,
    nombre: str = Form(...),
    descripcion: str | None = Form(None),
    id_entidad: int | None = Form(None),
    contrasena: str | None = Form(None),
    archivo: UploadFile = File(...),
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    contenido = await archivo.read()
    try:
        return await CertificadosCRUD(config).crear(nombre, descripcion, id_entidad, contenido, contrasena or None)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


@app.put("/v1/proyectos/{id_proyecto}/certificados/{id_certificado}")
async def actualizar_certificado(
    id_proyecto: int, id_certificado: int, datos: ActualizarCertificado,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    certificado = await CertificadosCRUD(config).actualizar_metadatos(
        id_certificado, datos.nombre, datos.descripcion, datos.id_entidad
    )
    if not certificado:
        raise HTTPException(404, "Certificado no encontrado")
    return certificado


@app.delete("/v1/proyectos/{id_proyecto}/certificados/{id_certificado}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_certificado(
    id_proyecto: int, id_certificado: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    config = get_db_config(proyecto["id"])
    await CertificadosCRUD(config).eliminar(id_certificado)


@app.get("/v1/proyectos/{id_proyecto}/certificados/{id_certificado}/archivo")
async def descargar_certificado(
    id_proyecto: int, id_certificado: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(admin_certificados_actual),
) -> Response:
    """Reconstruye el archivo al vuelo (nunca hay un .p12 ya montado
    guardado) y lo sirve — cada descarga queda registrada en
    gd_certificados_log (quién y cuándo), es el motivo por el que esto
    es delicado y no un simple estático."""
    config = get_db_config(proyecto["id"])
    certificados = CertificadosCRUD(config)
    certificado = await certificados.obtener(id_certificado)
    if not certificado:
        raise HTTPException(404, "Certificado no encontrado")
    resultado = await certificados.generar_copia(id_certificado)
    if not resultado:
        raise HTTPException(404, "Certificado no encontrado")
    contenido, nombre_fichero = resultado
    await CertificadosLogCRUD(config).registrar(id_certificado, certificado["nombre"], id_usuario, "descarga")
    nombre_codificado = quote(nombre_fichero)
    return Response(
        content=contenido, media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{nombre_codificado}"},
    )


@app.get("/v1/proyectos/{id_proyecto}/certificados/{id_certificado}/log")
async def listar_log_certificado(
    id_proyecto: int, id_certificado: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    registros = await CertificadosLogCRUD(config).listar_de_certificado(id_certificado)
    return [
        {"id": r["id"], "accion": r["accion"], "detalle": r["detalle"], "fecha": r["fecha"],
         "usuario": await _nombre_usuario(r["id_usuario"])}
        for r in registros
    ]


# ---------- Copias de seguridad de la base (ver docs/gestion-documental.md →
# "Copias de seguridad de la base de datos"). Todo de administración: una
# copia es la base entera, y restaurar machaca todo lo actual.

class RestaurarCopiaBD(BaseModel):
    contrasena: str | None = None
    confirmacion: str


class PeriodoCopiasBD(BaseModel):
    id: int | None = None
    regla: dict
    conservar_modo: Literal["copias", "dias"] = "copias"
    conservar: int


class AjustesCopiasBD(BaseModel):
    programada: bool | None = None
    periodos: list[PeriodoCopiasBD] | None = None
    cifrar: bool | None = None
    contrasena: str | None = None
    sftp_credencial: str | None = None
    sftp_carpeta: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/copias-bd")
async def listar_copias_bd(id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)) -> dict:
    return {
        "copias": copias_bd.listar_copias(proyecto["id"]),
        "ajustes": await copias_bd.ajustes_publicos(copias_bd.leer_ajustes(proyecto["id"]), get_db_config(proyecto["id"])),
        "espacio_libre": copias_bd.espacio_libre(),
    }


@app.post("/v1/proyectos/{id_proyecto}/copias-bd")
async def crear_copia_bd(id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)) -> dict:
    try:
        return await copias_bd.crear_copia(proyecto["id"], get_db_config(proyecto["id"]), "manual")
    except copias_bd.CopiaBDError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


@app.put("/v1/proyectos/{id_proyecto}/copias-bd/ajustes")
async def actualizar_ajustes_copias_bd(
    id_proyecto: int, datos: AjustesCopiasBD, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    try:
        config = get_db_config(proyecto["id"])
        ajustes = await copias_bd.guardar_ajustes(proyecto["id"], config, datos.model_dump(exclude_unset=True))
    except copias_bd.CopiaBDError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return await copias_bd.ajustes_publicos(ajustes, config)


@app.get("/v1/proyectos/{id_proyecto}/copias-bd/{nombre}/archivo")
async def descargar_copia_bd(
    id_proyecto: int, nombre: str, request: Request, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> FileResponse:
    try:
        ruta = copias_bd.ruta_copia(proyecto["id"], nombre)
    except copias_bd.CopiaBDError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e)) from e
    # El middleware de actividad solo mira lo que escribe; llevarse la base
    # entera también tiene que quedar apuntado.
    await registrar_sin_fallar(
        get_db_config(proyecto["id"]), **await _quien(request.scope, "descargar_copia_bd"), origen="panel",
        accion="descargar_copia_bd", descripcion=f"descargó la copia de seguridad de la base «{nombre}»",
        tipo_objeto=None, id_objeto=None, nombre_objeto=nombre, detalle=None,
    )
    return FileResponse(ruta, media_type="application/octet-stream", filename=nombre)


@app.delete("/v1/proyectos/{id_proyecto}/copias-bd/{nombre}", status_code=status.HTTP_204_NO_CONTENT)
async def borrar_copia_bd(
    id_proyecto: int, nombre: str, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    try:
        await copias_bd.borrar_copia(proyecto["id"], get_db_config(proyecto["id"]), nombre)
    except copias_bd.CopiaBDError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e)) from e


@app.post("/v1/proyectos/{id_proyecto}/copias-bd/{nombre}/restaurar")
async def restaurar_copia_bd(
    id_proyecto: int, nombre: str, datos: RestaurarCopiaBD,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    if datos.confirmacion.strip() != copias_bd.CONFIRMACION_RESTAURAR:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Para restaurar hay que escribir {copias_bd.CONFIRMACION_RESTAURAR}",
        )
    try:
        return await copias_bd.restaurar_copia(proyecto["id"], get_db_config(proyecto["id"]), nombre, datos.contrasena)
    except copias_bd.CopiaBDError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


async def _nombre_api_key_o_400(id_proyecto: int, nombre: str, id_excluir: int | None = None) -> str:
    try:
        return await nombre_api_key_disponible(id_proyecto, nombre, id_excluir)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e


# ---------- GDs enlazadas (ver docs/gestion-documental.md → "GDs enlazadas") ----------
# Todo de administración: enlazar es dar acceso de lectura a otra empresa.

class NuevoEnlace(BaseModel):
    nombre: str
    url_mcp: str
    api_key: str


def _nombre_key_para(nombre_central: str) -> str:
    return f"Central: {nombre_central}"


@app.get("/v1/proyectos/{id_proyecto}/enlaces")
async def listar_enlaces(id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)) -> list[dict]:
    return await EnlacesCRUD(get_db_config(proyecto["id"])).listar_metadatos()


@app.post("/v1/proyectos/{id_proyecto}/enlaces")
async def enlazar_con_central(
    id_proyecto: int, datos: NuevoEnlace, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    """Enlace en ambos sentidos en un solo paso: con la key que la central
    nos dio (1) se comprueba que responde, (2) emitimos nuestra propia key
    gd_enlazada para ella y (3) se la registramos llamando a su
    registrar_enlace_gd; solo entonces (4) se guarda el enlace aquí. Si
    (3) falla, la key de (2) se revoca y no queda nada a medias."""
    url_propia = url_mcp_propia()
    if not url_propia:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "Este servidor no tiene configurada GD_URL_PUBLICA — la central no podría llamarnos de vuelta")
    url_central = datos.url_mcp.strip()
    try:
        herramientas = await probar_enlace(url_central, datos.api_key.strip())
    except EnlaceError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    if "registrar_enlace_gd" not in herramientas:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "La central responde, pero esa key no es de tipo \"GD enlazada\" (o su servidor es anterior a esta función)")

    nombre_key_propia = await _nombre_api_key_o_400(proyecto["id"], _nombre_key_para(datos.nombre.strip()))
    id_key_propia, key_propia = await emitir_key_gd_enlazada(proyecto["id"], nombre_key_propia)
    try:
        await llamar_enlace(url_central, datos.api_key.strip(), "registrar_enlace_gd",
                            {"url_mcp": url_propia, "api_key": key_propia})
    except EnlaceError as e:
        await revocar_key(id_key_propia)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La central no aceptó el enlace: {e}")

    enlaces = EnlacesCRUD(get_db_config(proyecto["id"]))
    id_enlace = await enlaces.crear(datos.nombre.strip(), url_central, datos.api_key.strip(), SENTIDO_CENTRAL, id_key_propia)
    return {k: v for k, v in (await enlaces.obtener(id_enlace)).items() if k != "api_key_cifrada"}


@app.post("/v1/proyectos/{id_proyecto}/enlaces/{id_enlace}/probar")
async def probar_enlace_existente(
    id_proyecto: int, id_enlace: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    enlace = await EnlacesCRUD(get_db_config(proyecto["id"])).obtener_con_clave(id_enlace)
    if not enlace:
        raise HTTPException(404, "Enlace no encontrado")
    try:
        herramientas = await probar_enlace(enlace["url_mcp"], enlace["api_key"])
    except EnlaceError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return {"ok": True, "herramientas": herramientas}


@app.put("/v1/proyectos/{id_proyecto}/enlaces/{id_enlace}/activo")
async def cambiar_activo_enlace(
    id_proyecto: int, id_enlace: int, datos: dict, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    enlace = await EnlacesCRUD(get_db_config(proyecto["id"])).cambiar_activo(id_enlace, bool(datos.get("activo")))
    if not enlace:
        raise HTTPException(404, "Enlace no encontrado")
    return {k: v for k, v in enlace.items() if k != "api_key_cifrada"}


@app.delete("/v1/proyectos/{id_proyecto}/enlaces/{id_enlace}", status_code=status.HTTP_204_NO_CONTENT)
async def desenlazar(
    id_proyecto: int, id_enlace: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> None:
    """Deshace los dos sentidos desde cualquiera de los dos lados: avisa a
    la otra GD (eliminar_enlace_gd: borra su fila y revoca la key que nos
    dio), revoca la key que le dimos y borra el enlace. Si la otra GD no
    responde se sigue igual — lo importante es que aquí no quede acceso."""
    enlaces = EnlacesCRUD(get_db_config(proyecto["id"]))
    enlace = await enlaces.obtener_con_clave(id_enlace)
    if not enlace:
        raise HTTPException(404, "Enlace no encontrado")
    try:
        await llamar_enlace(enlace["url_mcp"], enlace["api_key"], "eliminar_enlace_gd")
    except EnlaceError as e:
        print(f"[enlaces] la otra GD no respondió al desenlazar ({enlace['url_mcp']}): {e}")
    await revocar_key(enlace["id_api_key_emitida"])
    await enlaces.eliminar(id_enlace)


@app.get("/v1/proyectos/{id_proyecto}/preguntas-pendientes")
async def listar_preguntas_pendientes(
    id_proyecto: int, estado: str | None = None, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> list[dict]:
    return await PreguntasPendientesCRUD(get_db_config(proyecto["id"])).listar_por_estado(estado or None)


@app.put("/v1/proyectos/{id_proyecto}/preguntas-pendientes/{id_pregunta}/estado")
async def cambiar_estado_pregunta_pendiente(
    id_proyecto: int, id_pregunta: int, datos: dict, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    estado = datos.get("estado")
    if estado not in ("pendiente", "resuelta"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "estado debe ser 'pendiente' o 'resuelta'")
    pregunta = await PreguntasPendientesCRUD(get_db_config(proyecto["id"])).cambiar_estado(id_pregunta, estado)
    if not pregunta:
        raise HTTPException(404, "Pregunta no encontrada")
    return pregunta


@app.get("/v1/proyectos/{id_proyecto}/uso-enlaces")
async def resumen_uso_enlaces(
    id_proyecto: int, mes: str, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> list[dict]:
    """`mes` = YYYY-MM. Lo que cada GD enlazada consumió de esta central,
    para repercutírselo — la factura se hace fuera con este informe."""
    if len(mes) != 7 or mes[4] != "-" or not (mes[:4] + mes[5:]).isdigit():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "mes debe tener el formato YYYY-MM")
    filas = await UsoEnlacesCRUD(get_db_config(proyecto["id"])).resumen_mensual(mes)
    return [{**f, "coste_estimado": float(f["coste_estimado"] or 0)} for f in filas]


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


# --- Enlace compartido: lo que abre el destinatario ---
# Público a propósito (sin JWT ni x-api-key), como el formulario de
# credencial de arriba: la única protección es el token aleatorio, y que
# caduca o se puede anular. Ni se indexa ni se guarda en caché.

_CABECERAS_COMPARTIDO = {
    "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
}
_COMPARTIDO_NO_VALIDO = _pagina_mensaje_credencial(
    "Enlace no disponible",
    "Este enlace ha caducado, se ha anulado o no existe. Pide a quien te lo mandó uno nuevo.",
)


async def _compartido_vigente(id_proyecto: int, token: str) -> tuple[dict, dict] | None:
    config = _config_proyecto_o_none(id_proyecto)
    compartido = await CompartidosCRUD(config).obtener_vigente(token) if config else None
    return (config, compartido) if compartido else None


def _pagina_compartido(compartido: dict, token: str, nombre_original: str | None) -> str:
    nombre = html.escape(compartido["nombre_documento"])
    fecha = compartido["fecha_expiracion"].strftime("%d/%m/%Y")
    boton_original = (
        f'<a class="boton secundario" href="{token}/original">Descargar archivo original'
        f'<small>{html.escape(nombre_original)}</small></a>'
        if nombre_original else ""
    )
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{nombre}</title>
<style>
body {{ font-family: system-ui, sans-serif; max-width: 520px; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }}
h1 {{ font-size: 1.4rem; margin-bottom: 0.3rem; }}
.ayuda {{ color: #666; font-size: 0.9rem; }}
.boton {{ display: block; margin-top: 1rem; padding: 0.8rem 1rem; border-radius: 8px; background: #1c7ed6;
          color: #fff; text-decoration: none; font-weight: 600; text-align: center; }}
.boton.secundario {{ background: #e7f5ff; color: #1864ab; }}
.boton small {{ display: block; font-weight: 400; font-size: 0.8rem; margin-top: 0.2rem; }}
</style></head><body>
<p class="ayuda">{html.escape(compartido["creado_por"])} te ha compartido este documento</p>
<h1>{nombre}</h1>
<a class="boton" href="{token}/pdf">Descargar PDF</a>
{boton_original}
<p class="ayuda">Este enlace funciona hasta el {fecha}.</p>
</body></html>"""


@app.get("/v1/compartido/{id_proyecto}/{token}", response_class=HTMLResponse)
async def ver_compartido(id_proyecto: int, token: str) -> HTMLResponse:
    vigente = await _compartido_vigente(id_proyecto, token)
    if not vigente:
        return HTMLResponse(_COMPARTIDO_NO_VALIDO, status.HTTP_404_NOT_FOUND, headers=_CABECERAS_COMPARTIDO)
    config, compartido = vigente
    nombre_original = None
    if compartido["incluir_original"]:
        version = await VersionesCRUD(config).obtener(compartido["id_version"])
        nombre_original = version["archivo_original_nombre"] if version and version["archivo_original"] else None
    return HTMLResponse(_pagina_compartido(compartido, token, nombre_original), headers=_CABECERAS_COMPARTIDO)


@app.get("/v1/compartido/{id_proyecto}/{token}/pdf")
async def descargar_compartido_pdf(id_proyecto: int, token: str) -> Response:
    vigente = await _compartido_vigente(id_proyecto, token)
    if not vigente:
        return HTMLResponse(_COMPARTIDO_NO_VALIDO, status.HTTP_404_NOT_FOUND, headers=_CABECERAS_COMPARTIDO)
    config, compartido = vigente
    await CompartidosCRUD(config).apuntar_descarga(compartido["id"], "descargas_pdf")
    nombre_archivo = quote(f"{compartido['nombre_documento']}.pdf")
    return Response(
        content=bytes(compartido["pdf"]), media_type="application/pdf",
        headers={**_CABECERAS_COMPARTIDO, "Content-Disposition": f"attachment; filename*=UTF-8''{nombre_archivo}"},
    )


@app.get("/v1/compartido/{id_proyecto}/{token}/original")
async def descargar_compartido_original(id_proyecto: int, token: str) -> Response:
    vigente = await _compartido_vigente(id_proyecto, token)
    if not vigente or not vigente[1]["incluir_original"]:
        return HTMLResponse(_COMPARTIDO_NO_VALIDO, status.HTTP_404_NOT_FOUND, headers=_CABECERAS_COMPARTIDO)
    config, compartido = vigente
    version = await VersionesCRUD(config).obtener(compartido["id_version"])
    if not version or not version["archivo_original"]:
        return HTMLResponse(_COMPARTIDO_NO_VALIDO, status.HTTP_404_NOT_FOUND, headers=_CABECERAS_COMPARTIDO)
    await CompartidosCRUD(config).apuntar_descarga(compartido["id"], "descargas_original")
    nombre_codificado = quote(version["archivo_original_nombre"])
    return Response(
        content=bytes(version["archivo_original"]), media_type=version["archivo_original_tipo_mime"],
        headers={**_CABECERAS_COMPARTIDO, "Content-Disposition": f"attachment; filename*=UTF-8''{nombre_codificado}"},
    )


# --- Tabla de estilos (ver docs/gestion-documental.md → "Tabla de estilos") ---
# Lectura: cualquiera con acceso al proyecto. Alta/edición/borrado (incluidas
# las imágenes): cualquiera salvo invitado, igual que los documentos.


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
    id_proyecto: int, datos: NuevoEstilo, proyecto: dict = Depends(escritor_gestion_documental_actual)
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
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    estilos = EstilosCRUD(config)
    if not await estilos.obtener(id_estilo):
        raise HTTPException(404, "Estilo no encontrado")
    await estilos.update(id_estilo, {"instrucciones": datos.instrucciones})
    return await estilos.obtener(id_estilo)


@app.delete("/v1/proyectos/{id_proyecto}/estilos/{id_estilo}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_estilo(
    id_proyecto: int, id_estilo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
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
    proyecto: dict = Depends(escritor_gestion_documental_actual),
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
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await EstilosImagenesCRUD(config).eliminar(id_imagen)


_api_keys = AsyncCrudBase(TABLA_API_KEYS, get_db_config("control"))


class NuevaApiKey(BaseModel):
    nombre: str  # obligatorio: ver lib/api_keys.py::nombre_api_key_disponible del núcleo
    id_rol: int = ID_ROL_OPERADOR
    id_usuario: int | None = None  # de quién es; None = de todos (ver _dep_api_keys.py del núcleo)


class RenombrarApiKey(BaseModel):
    nombre: str



@app.get("/v1/proyectos/{id_proyecto}/api-keys")
async def listar_api_keys(id_proyecto: int, proyecto: dict = Depends(admin_gestion_documental_actual)) -> list[dict]:
    filas, _ = await _api_keys.listar(
        filtros={"id_proyecto": {"op": "=", "valor": id_proyecto}}, orden="id DESC", limit=100,
    )
    nombres = {}
    for id_usuario in {f.get("id_usuario") for f in filas} - {None}:
        nombres[id_usuario] = await _nombre_usuario(id_usuario)
    return [
        {
            **{k: v for k, v in fila.items() if k != "api_key_cifrada"},
            "nombre_usuario": nombres.get(fila.get("id_usuario")),
        }
        for fila in filas
    ]


@app.post("/v1/proyectos/{id_proyecto}/api-keys")
async def emitir_api_key(
    id_proyecto: int, datos: NuevaApiKey, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    if datos.id_rol not in ROLES_API_KEY:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Una API key solo puede ser operador, invitado o GD enlazada")
    nombre = await _nombre_api_key_o_400(id_proyecto, datos.nombre)
    try:
        await comprobar_dueno_api_key(id_proyecto, datos.id_usuario, datos.id_rol)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    key = generar_api_key()
    id_api_key = await _api_keys.insert({
        "id_proyecto": id_proyecto,
        "nombre": nombre,
        "id_rol": datos.id_rol,
        "id_usuario": datos.id_usuario,
        "prefijo": key["prefijo"],
        "api_key_cifrada": key["api_key_cifrada"],
    })
    return {
        "id": id_api_key, "nombre": nombre, "id_rol": datos.id_rol, "id_usuario": datos.id_usuario,
        "prefijo": key["prefijo"], "api_key": key["api_key"],
    }


@app.put("/v1/api-keys/{id_api_key}")
async def renombrar_api_key(
    id_api_key: int, datos: RenombrarApiKey, fila: dict = Depends(api_key_de_gestion_documental)
) -> dict:
    """Cambiar el nombre no toca la key en sí: sirve para identificar las
    que se emitieron sin nombre, sin revocarlas ni reconfigurar el cliente
    que las usa."""
    nombre = await _nombre_api_key_o_400(fila["id_proyecto"], datos.nombre, id_excluir=id_api_key)
    await _api_keys.update(id_api_key, {"nombre": nombre})
    actualizada = await _api_keys.obtener(id_api_key)
    return {k: v for k, v in actualizada.items() if k != "api_key_cifrada"}


@app.post("/v1/api-keys/{id_api_key}/revocar")
async def revocar_api_key(id_api_key: int, fila: dict = Depends(api_key_de_gestion_documental)) -> dict:
    await _api_keys.update(id_api_key, {"estado": 0, "fecha_revocacion": datetime.now(timezone.utc)})
    actualizada = await _api_keys.obtener(id_api_key)
    return {k: v for k, v in actualizada.items() if k != "api_key_cifrada"}


@app.delete("/v1/api-keys/{id_api_key}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_api_key(id_api_key: int, fila: dict = Depends(api_key_de_gestion_documental)) -> None:
    await _api_keys.eliminar(id_api_key)


class MensajeChat(BaseModel):
    mensaje: str


class ConfirmacionChat(BaseModel):
    confirmacion_id: str
    aceptar: bool


class NuevaConversacionChat(BaseModel):
    titulo: str | None = None


class RenombrarConversacionChat(BaseModel):
    titulo: str


@app.get("/v1/proyectos/{id_proyecto}/chat/conversaciones")
async def listar_conversaciones_chat(id_proyecto: int, usuario: tuple = Depends(usuario_chat_gd_actual)) -> list[dict]:
    id_usuario, _ = usuario
    return await ChatConversacionesCRUD(get_db_config(id_proyecto)).listar_conversaciones(id_usuario)


@app.post("/v1/proyectos/{id_proyecto}/chat/conversaciones")
async def crear_conversacion_chat(
    id_proyecto: int, datos: NuevaConversacionChat, usuario: tuple = Depends(usuario_chat_gd_actual)
) -> dict:
    id_usuario, _ = usuario
    return await ChatConversacionesCRUD(get_db_config(id_proyecto)).crear_conversacion(id_usuario, datos.titulo)


@app.get("/v1/proyectos/{id_proyecto}/chat/conversaciones/{id_conversacion}")
async def obtener_conversacion_chat(
    id_proyecto: int, id_conversacion: int, conversacion: tuple = Depends(conversacion_chat_gd_actual)
) -> dict:
    fila, _, _ = conversacion
    mensajes = json.loads(fila["mensajes_json"])
    titulo = fila["titulo"] or _titulo_de_muestra_chat(mensajes)
    return {"id": fila["id"], "titulo": titulo, "mensajes": mensajes}


@app.put("/v1/proyectos/{id_proyecto}/chat/conversaciones/{id_conversacion}")
async def renombrar_conversacion_chat(
    id_proyecto: int, id_conversacion: int, datos: RenombrarConversacionChat,
    conversacion: tuple = Depends(conversacion_chat_gd_actual),
) -> dict:
    await ChatConversacionesCRUD(get_db_config(id_proyecto)).renombrar(id_conversacion, datos.titulo)
    return {"id": id_conversacion, "titulo": datos.titulo}


@app.delete("/v1/proyectos/{id_proyecto}/chat/conversaciones/{id_conversacion}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_conversacion_chat(
    id_proyecto: int, id_conversacion: int, conversacion: tuple = Depends(conversacion_chat_gd_actual)
) -> None:
    await ChatConversacionesCRUD(get_db_config(id_proyecto)).eliminar(id_conversacion)


@app.post("/v1/proyectos/{id_proyecto}/chat/conversaciones/{id_conversacion}/mensajes")
async def enviar_mensaje_chat(
    id_proyecto: int, id_conversacion: int, datos: MensajeChat,
    conversacion: tuple = Depends(conversacion_chat_gd_actual),
) -> dict:
    _, id_usuario, es_editor = conversacion
    try:
        return await chat_ia.enviar_mensaje(id_proyecto, id_conversacion, id_usuario, es_editor, datos.mensaje)
    except ValueError as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error))


@app.post("/v1/proyectos/{id_proyecto}/chat/confirmar")
async def confirmar_chat(id_proyecto: int, datos: ConfirmacionChat, usuario: tuple = Depends(usuario_chat_gd_actual)) -> dict:
    id_usuario, _ = usuario
    return await chat_ia.confirmar(id_usuario, datos.confirmacion_id, datos.aceptar)


# --- Scripts reutilizables (ver docs/gestion-documental.md → "Scripts
# reutilizables") --- Los crea/actualiza la IA por MCP; el panel es solo
# para consultarlos y curar sus metadatos — el código NO se puede editar
# desde aquí a propósito (ActualizarScript no tiene ese campo), solo
# desde la conversación con la IA.
class ActualizarScript(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    lenguaje: str | None = None
    etiquetas: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/scripts")
async def listar_scripts(
    id_proyecto: int, q: str | None = None, lenguaje: str | None = None, incluir_archivados: bool = False,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await ScriptsCRUD(config).buscar(q, lenguaje, incluir_archivados)


@app.get("/v1/proyectos/{id_proyecto}/scripts/{id_script}")
async def obtener_script(
    id_proyecto: int, id_script: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    script = await ScriptsCRUD(config).obtener(id_script)
    if not script:
        raise HTTPException(404, "Script no encontrado")
    return script


@app.put("/v1/proyectos/{id_proyecto}/scripts/{id_script}")
async def actualizar_script(
    id_proyecto: int, id_script: int, datos: ActualizarScript,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    script = await ScriptsCRUD(config).actualizar_campos(id_script, datos.model_dump())
    if not script:
        raise HTTPException(404, "Script no encontrado")
    return script


@app.post("/v1/proyectos/{id_proyecto}/scripts/{id_script}/archivar")
async def archivar_script(
    id_proyecto: int, id_script: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    script = await ScriptsCRUD(config).archivar(id_script)
    if not script:
        raise HTTPException(404, "Script no encontrado")
    return script


@app.post("/v1/proyectos/{id_proyecto}/scripts/{id_script}/desarchivar")
async def desarchivar_script(
    id_proyecto: int, id_script: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    script = await ScriptsCRUD(config).desarchivar(id_script)
    if not script:
        raise HTTPException(404, "Script no encontrado")
    return script


class RelacionarDocumentoScript(BaseModel):
    id_documento: int


@app.get("/v1/proyectos/{id_proyecto}/scripts/{id_script}/documentos")
async def listar_documentos_script(
    id_proyecto: int, id_script: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    if not await ScriptsCRUD(config).obtener(id_script):
        raise HTTPException(404, "Script no encontrado")
    return await DocumentosScriptsCRUD(config).listar_documentos_de_script(id_script, incluir_archivados=True)


@app.post("/v1/proyectos/{id_proyecto}/scripts/{id_script}/documentos")
async def relacionar_documento_script(
    id_proyecto: int, id_script: int, datos: RelacionarDocumentoScript,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    if not await ScriptsCRUD(config).obtener(id_script):
        raise HTTPException(404, "Script no encontrado")
    if not await DocumentosCRUD(config).obtener(datos.id_documento):
        raise HTTPException(404, "Documento no encontrado")
    await DocumentosScriptsCRUD(config).asignar(datos.id_documento, id_script)
    return {"id_documento": datos.id_documento, "id_script": id_script}


@app.delete(
    "/v1/proyectos/{id_proyecto}/scripts/{id_script}/documentos/{id_documento}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def quitar_relacion_documento_script(
    id_proyecto: int, id_script: int, id_documento: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await DocumentosScriptsCRUD(config).quitar(id_documento, id_script)


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/scripts")
async def listar_scripts_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    return await DocumentosScriptsCRUD(config).listar_scripts_de_documento(id_documento)


# ---------- Aprendizajes (ver docs → "Aprendizaje de la central") ----------
# Solo admin: decide qué se aspira de otra empresa y qué pasa a la base común.

class NuevoAprendizaje(BaseModel):
    id_enlace: int
    id_documento: int


class EdicionAprendizaje(BaseModel):
    markdown_anonimizado: str


class RechazoAprendizaje(BaseModel):
    motivo: str | None = None


async def _enlazada_o_404(config: dict, id_enlace: int) -> dict:
    enlace = await EnlacesCRUD(config).obtener_con_clave(id_enlace)
    if not enlace or enlace["sentido"] != SENTIDO_ENLAZADA:
        raise HTTPException(404, "Esa GD no está enlazada como enlazada nuestra")
    return enlace


async def _aprendizaje_o_404(config: dict, id_aprendizaje: int, estado_esperado: str | None = None) -> dict:
    aprendizaje = await AprendizajesCRUD(config).obtener(id_aprendizaje)
    if not aprendizaje:
        raise HTTPException(404, "Aprendizaje no encontrado")
    if estado_esperado and aprendizaje["estado"] != estado_esperado:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Este aprendizaje está en estado '{aprendizaje['estado']}', no '{estado_esperado}'")
    return aprendizaje


async def _documento_de_origen(enlace: dict, id_documento: int) -> dict:
    try:
        return await llamar_enlace(enlace["url_mcp"], enlace["api_key"], "obtener_documento_completo_gd", {"id_documento": id_documento})
    except EnlaceError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))


@app.get("/v1/proyectos/{id_proyecto}/enlaces/{id_enlace}/documentos")
async def listar_documentos_de_enlazada(
    id_proyecto: int, id_enlace: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> list[dict]:
    """Documentos no reservados de una GD enlazada, con el estado del
    aprendizaje si ya se aspiró alguno — para elegir cuáles aspirar."""
    config = get_db_config(proyecto["id"])
    enlace = await _enlazada_o_404(config, id_enlace)
    try:
        documentos = await llamar_enlace(enlace["url_mcp"], enlace["api_key"], "buscar_documentos_gd", {"limite": 200})
    except EnlaceError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))
    aprendizajes = AprendizajesCRUD(config)
    salida = []
    for d in documentos or []:
        existente = await aprendizajes.obtener_por_origen(id_enlace, d["id"])
        salida.append({
            "id_documento": d["id"], "nombre": d["nombre"], "tipo_documento": d["tipo_documento"],
            "fecha_alta": d.get("fecha_alta"), "estado_aprendizaje": existente["estado"] if existente else None,
            "id_aprendizaje": existente["id"] if existente else None,
        })
    return salida


@app.post("/v1/proyectos/{id_proyecto}/aprendizajes")
async def aspirar_aprendizaje(
    id_proyecto: int, datos: NuevoAprendizaje, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    """Paso 1: la central trae el documento, la IA lo resume y queda como
    candidato. El texto completo no se guarda."""
    config = get_db_config(proyecto["id"])
    enlace = await _enlazada_o_404(config, datos.id_enlace)
    aprendizajes = AprendizajesCRUD(config)
    if await aprendizajes.obtener_por_origen(datos.id_enlace, datos.id_documento):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ese documento ya se aspiró")
    documento = await _documento_de_origen(enlace, datos.id_documento)
    try:
        return await aprendizajes.crear_candidato(proyecto["id"], enlace, documento)
    except ValueError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))


@app.get("/v1/proyectos/{id_proyecto}/aprendizajes")
async def listar_aprendizajes(
    id_proyecto: int, estado: str | None = None, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> list[dict]:
    return await AprendizajesCRUD(get_db_config(proyecto["id"])).listar_por_estado(estado or None)


@app.get("/v1/proyectos/{id_proyecto}/aprendizajes/{id_aprendizaje}")
async def obtener_aprendizaje(
    id_proyecto: int, id_aprendizaje: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    aprendizaje = await _aprendizaje_o_404(get_db_config(proyecto["id"]), id_aprendizaje)
    return {**aprendizaje, "sustituciones": json.loads(aprendizaje["sustituciones"] or "[]")}


@app.post("/v1/proyectos/{id_proyecto}/aprendizajes/{id_aprendizaje}/via-libre")
async def dar_via_libre_aprendizaje(
    id_proyecto: int, id_aprendizaje: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    """Paso 2: se vuelve a traer el documento completo, la IA lo reescribe
    sin datos identificativos y queda pendiente de revisión."""
    config = get_db_config(proyecto["id"])
    aprendizaje = await _aprendizaje_o_404(config, id_aprendizaje, ESTADO_CANDIDATO)
    enlace = await _enlazada_o_404(config, aprendizaje["id_enlace"])
    documento = await _documento_de_origen(enlace, aprendizaje["id_documento_origen"])
    try:
        return await AprendizajesCRUD(config).anonimizar(proyecto["id"], aprendizaje, documento["markdown"])
    except ValueError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))


@app.put("/v1/proyectos/{id_proyecto}/aprendizajes/{id_aprendizaje}")
async def editar_aprendizaje(
    id_proyecto: int, id_aprendizaje: int, datos: EdicionAprendizaje,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    await _aprendizaje_o_404(config, id_aprendizaje, ESTADO_PENDIENTE_REVISION)
    return await AprendizajesCRUD(config).editar_markdown(id_aprendizaje, datos.markdown_anonimizado)


@app.post("/v1/proyectos/{id_proyecto}/aprendizajes/{id_aprendizaje}/aprobar")
async def aprobar_aprendizaje(
    id_proyecto: int, id_aprendizaje: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    """Paso 3: la copia anonimizada pasa a ser un documento normal de esta
    central (compartible como cualquier otro)."""
    config = get_db_config(proyecto["id"])
    aprendizaje = await _aprendizaje_o_404(config, id_aprendizaje, ESTADO_PENDIENTE_REVISION)
    fecha = aprendizaje["fecha_documento"] or datetime.now(timezone.utc).date()
    resultado = await guardar_documento(
        config, aprendizaje["nombre"], aprendizaje["tipo_documento"], aprendizaje["markdown_anonimizado"], str(fecha),
    )
    await _reindexar_si_semantico(config, proyecto["id"], resultado["id_documento"], resultado["id_version"], aprendizaje["markdown_anonimizado"])
    return await AprendizajesCRUD(config).marcar_aprobado(id_aprendizaje, resultado["id_documento"])


@app.post("/v1/proyectos/{id_proyecto}/aprendizajes/{id_aprendizaje}/rechazar")
async def rechazar_aprendizaje(
    id_proyecto: int, id_aprendizaje: int, datos: RechazoAprendizaje,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    aprendizaje = await _aprendizaje_o_404(config, id_aprendizaje)
    if aprendizaje["estado"] not in (ESTADO_CANDIDATO, ESTADO_PENDIENTE_REVISION):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo se puede rechazar un candidato o uno pendiente de revisión")
    return await AprendizajesCRUD(config).rechazar(id_aprendizaje, datos.motivo)


@app.post("/v1/proyectos/{id_proyecto}/aprendizajes/{id_aprendizaje}/reabrir")
async def reabrir_aprendizaje(
    id_proyecto: int, id_aprendizaje: int, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    await _aprendizaje_o_404(config, id_aprendizaje, ESTADO_RECHAZADO)
    return await AprendizajesCRUD(config).volver_a_candidato(id_aprendizaje)


# ---------- Reglas de comportamiento (ver docs → "Reglas de comportamiento") ----------
# Lectura: cualquiera con acceso al proyecto. Alta/edición/borrado: cualquiera
# salvo invitado, igual que los estilos de informe (son de la misma especie:
# instrucciones para la IA, no documentos).

class NuevaRegla(BaseModel):
    nombre: str
    texto: str
    categoria: str
    es_global: bool = False
    prioridad: int = 0
    reservada: bool = False


class ActualizarRegla(BaseModel):
    nombre: str | None = None
    texto: str | None = None
    categoria: str | None = None
    es_global: bool | None = None
    prioridad: int | None = None
    activa: bool | None = None
    reservada: bool | None = None


@app.get("/v1/proyectos/{id_proyecto}/reglas")
async def listar_reglas(
    id_proyecto: int, categoria: str | None = None, incluir_inactivas: bool = True,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """Las propias. Por defecto incluye las inactivas: esta pantalla es para
    gestionarlas, y una regla desactivada tiene que poder recuperarse."""
    config = get_db_config(proyecto["id"])
    return await ReglasCRUD(config).listar_reglas(categoria, incluir_inactivas=incluir_inactivas)


@app.get("/v1/proyectos/{id_proyecto}/reglas/heredadas")
async def listar_reglas_heredadas(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    """Las de las GDs centrales enlazadas, pedidas en vivo — solo se
    consultan, se cambian en la central. Si una central no responde, sus
    reglas simplemente no salen."""
    return await reglas_heredadas(get_db_config(proyecto["id"]))


@app.get("/v1/proyectos/{id_proyecto}/reglas/globales/texto")
async def texto_reglas_globales_proyecto(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> dict:
    """Exactamente el bloque que recibe la IA al abrir sesión, para poder ver
    lo que ocupa (`caracteres`/`tokens_aproximados`, ver el aviso de peso de
    la pantalla de reglas)."""
    texto = await texto_reglas_globales(get_db_config(proyecto["id"]))
    return {"texto": texto, "caracteres": len(texto), "tokens_aproximados": len(texto) // CARACTERES_POR_TOKEN}


@app.post("/v1/proyectos/{id_proyecto}/reglas")
async def crear_regla(
    id_proyecto: int, datos: NuevaRegla, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    reglas = ReglasCRUD(config)
    try:
        id_regla = await reglas.crear(datos.model_dump())
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return await reglas.obtener(id_regla)


@app.put("/v1/proyectos/{id_proyecto}/reglas/{id_regla}")
async def actualizar_regla(
    id_proyecto: int, id_regla: int, datos: ActualizarRegla,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        regla = await ReglasCRUD(config).actualizar_campos(id_regla, datos.model_dump())
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    if not regla:
        raise HTTPException(404, "Regla no encontrada")
    return regla


@app.delete("/v1/proyectos/{id_proyecto}/reglas/{id_regla}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_regla(
    id_proyecto: int, id_regla: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> None:
    config = get_db_config(proyecto["id"])
    await ReglasCRUD(config).eliminar(id_regla)


# ---------- Registros de datos (ver docs → "Registros de datos") ----------
# Lectura: cualquiera con acceso al proyecto. Alta/edición: cualquiera salvo
# invitado, igual que las reglas y los estilos. Un modelo con registros no se
# puede editar: el CRUD lanza ValueError y aquí sale como 400.

class NuevoModeloRegistro(BaseModel):
    nombre: str
    titulo: str
    descripcion: str
    esquema: dict
    periodicidad: str | None = None


class CorreccionModeloRegistro(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    esquema: dict | None = None
    periodicidad: str | None = None


class NuevaVersionModeloRegistro(CorreccionModeloRegistro):
    esquema: dict
    motivo: str


class CambioActivoModelo(BaseModel):
    activo: bool


class NuevoRegistro(BaseModel):
    valores: dict
    fecha: str
    hora: str | None = None
    id_modelo: int | None = None
    modelo: str | None = None
    creado_por: str | None = None
    conforme: bool | None = None
    observaciones: str | None = None
    id_entidad: int | None = None
    id_documentos: list[int] = []


class CorreccionRegistro(BaseModel):
    valores: dict | None = None
    fecha: str | None = None
    hora: str | None = None
    conforme: bool | None = None
    observaciones: str | None = None
    id_entidad: int | None = None


class VinculoDocumentoRegistro(BaseModel):
    id_documento: int


def _modelo_con_plantilla(modelo: dict) -> dict:
    esquema = json.loads(modelo["esquema"])
    return {**modelo, "esquema": esquema, "valores_de_ejemplo": plantilla_de_valores(esquema)}


async def _modelo_o_404(config: dict, id_modelo: int) -> dict:
    modelo = await ModelosRegistroCRUD(config).obtener(id_modelo)
    if not modelo:
        raise HTTPException(404, "Modelo de registro no encontrado")
    return modelo


@app.get("/v1/proyectos/{id_proyecto}/registros/modelos")
async def listar_modelos_registro(
    id_proyecto: int, incluir_inactivos: bool = True,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """La última versión de cada modelo. Por defecto incluye los retirados:
    esta pantalla es para gestionarlos."""
    config = get_db_config(proyecto["id"])
    modelos = ModelosRegistroCRUD(config)
    salida = []
    for m in await modelos.listar_modelos(incluir_inactivos):
        salida.append({**_modelo_con_plantilla(m), "tiene_registros": await modelos.tiene_registros(m["id"])})
    return salida


@app.get("/v1/proyectos/{id_proyecto}/registros/modelos/{id_modelo}/versiones")
async def listar_versiones_modelo_registro(
    id_proyecto: int, id_modelo: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    modelo = await _modelo_o_404(config, id_modelo)
    return [_modelo_con_plantilla(v) for v in await ModelosRegistroCRUD(config).listar_versiones(modelo["nombre"])]


@app.post("/v1/proyectos/{id_proyecto}/registros/modelos")
async def crear_modelo_registro(
    id_proyecto: int, datos: NuevoModeloRegistro, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    modelos = ModelosRegistroCRUD(config)
    try:
        id_modelo = await modelos.crear(datos.model_dump())
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return _modelo_con_plantilla(await modelos.obtener(id_modelo))


@app.put("/v1/proyectos/{id_proyecto}/registros/modelos/{id_modelo}")
async def corregir_modelo_registro(
    id_proyecto: int, id_modelo: int, datos: CorreccionModeloRegistro,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    """Solo mientras no tenga registros (o si solo cambian las leyendas de
    los campos) — si no, 400 pidiendo una versión nueva."""
    config = get_db_config(proyecto["id"])
    try:
        modelo = await ModelosRegistroCRUD(config).actualizar(id_modelo, datos.model_dump())
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    if not modelo:
        raise HTTPException(404, "Modelo de registro no encontrado")
    return _modelo_con_plantilla(modelo)


@app.post("/v1/proyectos/{id_proyecto}/registros/modelos/{id_modelo}/versiones")
async def nueva_version_modelo_registro(
    id_proyecto: int, id_modelo: int, datos: NuevaVersionModeloRegistro,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        return _modelo_con_plantilla(await ModelosRegistroCRUD(config).nueva_version(
            id_modelo, datos.esquema, datos.motivo,
            {"titulo": datos.titulo, "descripcion": datos.descripcion, "periodicidad": datos.periodicidad},
        ))
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@app.put("/v1/proyectos/{id_proyecto}/registros/modelos/{id_modelo}/activo")
async def cambiar_activo_modelo_registro(
    id_proyecto: int, id_modelo: int, datos: CambioActivoModelo,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    modelo = await ModelosRegistroCRUD(config).cambiar_activo(id_modelo, datos.activo)
    if not modelo:
        raise HTTPException(404, "Modelo de registro no encontrado")
    return _modelo_con_plantilla(modelo)


@app.get("/v1/proyectos/{id_proyecto}/registros")
async def listar_registros(
    id_proyecto: int, id_modelo: int | None = None, desde: str | None = None, hasta: str | None = None,
    conforme: bool | None = None, limite: int = 200,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """`id_modelo` es cualquiera de las versiones: se listan los registros de
    TODAS las versiones de ese modelo, que es lo que se espera al mirar el
    histórico."""
    config = get_db_config(proyecto["id"])
    ids = None
    if id_modelo is not None:
        modelo = await _modelo_o_404(config, id_modelo)
        versiones = await ModelosRegistroCRUD(config).listar_versiones(modelo["nombre"])
        ids = [v["id"] for v in versiones] or [modelo["id"]]
    return await RegistrosCRUD(config).buscar(
        ids, desde, hasta, None, conforme, None, min(limite, LIMITE_REGISTROS)
    )


@app.post("/v1/proyectos/{id_proyecto}/registros")
async def crear_registro(
    id_proyecto: int, datos: NuevoRegistro,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    """`creado_por` sale de la sesión, como en las notas: aquí sí se sabe
    quién está escribiendo."""
    config = get_db_config(proyecto["id"])
    modelos = ModelosRegistroCRUD(config)
    modelo = None
    if datos.id_modelo is not None:
        modelo = await _modelo_o_404(config, datos.id_modelo)
    elif datos.modelo:
        modelo = await modelos.obtener_por_nombre(datos.modelo)
    if not modelo:
        raise HTTPException(404, "Modelo de registro no encontrado")
    registros = RegistrosCRUD(config)
    for id_documento in datos.id_documentos:
        if not await DocumentosCRUD(config).obtener(id_documento):
            raise HTTPException(404, f"Documento {id_documento} no encontrado")
    try:
        id_registro = await registros.crear(modelo, {
            **datos.model_dump(exclude={"modelo", "id_modelo", "creado_por", "id_documentos"}),
            "creado_por": await _nombre_usuario(id_usuario) or "Usuario eliminado",
        })
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    vinculos = RegistrosDocumentosCRUD(config)
    for id_documento in datos.id_documentos:
        await vinculos.vincular(id_registro, id_documento)
    return sin_archivo(await registros.obtener(id_registro))


@app.put("/v1/proyectos/{id_proyecto}/registros/{id_registro}")
async def corregir_registro(
    id_proyecto: int, id_registro: int, datos: CorreccionRegistro,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    registros = RegistrosCRUD(config)
    fila = await registros.obtener(id_registro)
    if not fila:
        raise HTTPException(404, "Registro no encontrado")
    modelo = await _modelo_o_404(config, fila["id_modelo"])
    try:
        actualizado = await registros.corregir(id_registro, modelo, datos.model_dump())
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return sin_archivo(actualizado)


@app.post("/v1/proyectos/{id_proyecto}/registros/{id_registro}/archivo-original")
async def subir_archivo_original_registro(
    id_proyecto: int, id_registro: int, archivo: UploadFile = File(...),
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    """Adjunta el archivo del que salen los datos, o sustituye el que hubiera
    — igual que el archivo original de un documento (ver "Alta manual desde
    el panel"). Va aparte del alta porque esa es JSON, no un formulario."""
    config = get_db_config(proyecto["id"])
    registros = RegistrosCRUD(config)
    if not await registros.obtener(id_registro):
        raise HTTPException(404, "Registro no encontrado")
    try:
        await registros.guardar_archivo_original(
            id_registro, await archivo.read(),
            archivo.content_type or "application/octet-stream", archivo.filename or "archivo",
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return sin_archivo(await registros.obtener(id_registro))


@app.get("/v1/proyectos/{id_proyecto}/registros/{id_registro}/archivo-original")
async def descargar_archivo_original_registro(
    id_proyecto: int, id_registro: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> Response:
    fila = await RegistrosCRUD(get_db_config(proyecto["id"])).obtener(id_registro)
    if not fila:
        raise HTTPException(404, "Registro no encontrado")
    if not fila["archivo_original"]:
        raise HTTPException(404, "Este registro no tiene ningún archivo original adjunto")
    return Response(
        content=fila["archivo_original"], media_type=fila["archivo_original_tipo_mime"],
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(fila['archivo_original_nombre'])}"},
    )


@app.post("/v1/proyectos/{id_proyecto}/registros/{id_registro}/documentos")
async def vincular_documento_registro(
    id_proyecto: int, id_registro: int, datos: VinculoDocumentoRegistro,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    if not await RegistrosCRUD(config).obtener(id_registro):
        raise HTTPException(404, "Registro no encontrado")
    if not await DocumentosCRUD(config).obtener(datos.id_documento):
        raise HTTPException(404, "Documento no encontrado")
    await RegistrosDocumentosCRUD(config).vincular(id_registro, datos.id_documento)
    return {"id_registro": id_registro, "id_documento": datos.id_documento}


@app.delete(
    "/v1/proyectos/{id_proyecto}/registros/{id_registro}/documentos/{id_documento}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def desvincular_documento_registro(
    id_proyecto: int, id_registro: int, id_documento: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> None:
    await RegistrosDocumentosCRUD(get_db_config(proyecto["id"])).desvincular(id_registro, id_documento)


@app.get("/v1/proyectos/{id_proyecto}/documentos/{id_documento}/registros")
async def listar_registros_documento(
    id_proyecto: int, id_documento: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """Registros vinculados a un documento, de cualquier modelo — para la
    ficha del documento."""
    return await RegistrosCRUD(get_db_config(proyecto["id"])).buscar(id_documento=id_documento)


@app.delete("/v1/proyectos/{id_proyecto}/registros/{id_registro}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_registro(
    id_proyecto: int, id_registro: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    id_usuario: int = Depends(puede_editar_documento_actual),
) -> None:
    config = get_db_config(proyecto["id"])
    await RegistrosCRUD(config).eliminar(id_registro)


# --- Registro de actividad (ver docs/gestion-documental.md → "Registro de
# actividad"). Lo apunta ActividadPanelMiddleware (panel) y el middleware
# MCP (IA y chat). Lo ve cualquiera salvo invitado — un superadmin sí,
# para dar soporte.


@app.get("/v1/proyectos/{id_proyecto}/actividad")
async def listar_actividad(
    id_proyecto: int,
    quien: str | None = None,
    origen: Literal["ia", "chat", "panel"] | None = None,
    tipo_objeto: str | None = None,
    id_objeto: int | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    q: str | None = None,
    pagina: int = 1,
    por_pagina: int = 50,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    por_pagina = max(1, min(por_pagina, 200))
    filas, total = await ActividadCRUD(get_db_config(proyecto["id"])).buscar(
        quien=quien, origen=origen, tipo_objeto=tipo_objeto, id_objeto=id_objeto,
        desde=desde, hasta=hasta, q=q, limite=por_pagina, offset=(max(pagina, 1) - 1) * por_pagina,
    )
    return {"total": total, "filas": filas}


@app.get("/v1/proyectos/{id_proyecto}/actividad/quienes")
async def listar_quienes_actividad(
    id_proyecto: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[str]:
    return await ActividadCRUD(get_db_config(proyecto["id"])).quienes()


# --- Programaciones y notificaciones (ver docs/gestion-documental.md →
# "Programaciones y notificaciones"). Verlas, cualquiera con acceso;
# crearlas y cambiarlas, cualquiera salvo invitado. Las notificaciones
# son de cada usuario: un superadmin no tiene.


def _error_programacion(e: Exception) -> HTTPException:
    return HTTPException(404 if isinstance(e, LookupError) else 400, str(e))


async def _quien_panel(identidad: Identidad) -> tuple[str, int | None]:
    if identidad.tipo != "usuario":
        return "Soporte Multiplika", None
    return await _nombre_usuario(identidad.id) or f"Usuario n.º {identidad.id}", identidad.id


class DatosProgramacion(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    regla: dict | None = None
    ids_usuarios: list[int] | None = None
    ids_documentos: list[int] | None = None
    avisar_por_email: bool | None = None
    requiere_hecho: bool | None = None
    max_recordatorios: int | None = None
    cada_dias_recordatorio: int | None = None
    id_nota_bloc: int | None = None  # recordatorio de una nota del bloc de notas


@app.get("/v1/proyectos/{id_proyecto}/usuarios-proyecto")
async def listar_usuarios_para_avisar(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    """`puede_editar`: si no es invitado (los invitados no pueden encargarse
    de nada en el seguimiento)."""
    return [
        {"id": u["id"], "nombre": u["nombre"], "puede_editar": await puede_editar_proyecto(u["id"], proyecto["id"])}
        for u in await usuarios_del_proyecto(proyecto["id"])
    ]


@app.get("/v1/proyectos/{id_proyecto}/programaciones")
async def listar_programaciones_endpoint(
    id_proyecto: int, estado: Literal["activa", "pausada", "terminada"] | None = None,
    id_documento: int | None = None, id_nota_bloc: int | None = None,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    return await listar_programaciones(
        get_db_config(proyecto["id"]), proyecto["id"], estado, id_documento, id_nota_bloc,
    )


@app.post("/v1/proyectos/{id_proyecto}/programaciones")
async def crear_programacion_endpoint(
    id_proyecto: int, datos: DatosProgramacion,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, id_usuario = await _quien_panel(identidad)
    campos = datos.model_dump(exclude={"ids_usuarios", "ids_documentos"}, exclude_none=True)
    campos["max_recordatorios"] = datos.max_recordatorios
    try:
        if datos.id_nota_bloc:  # solo sobre una nota que ve quien lo pide
            await bloc.obtener_nota(get_db_config(proyecto["id"]), id_usuario, datos.id_nota_bloc)
        return await crear_programacion(
            get_db_config(proyecto["id"]), proyecto["id"], campos,
            datos.ids_usuarios or ([id_usuario] if id_usuario else []), datos.ids_documentos or [],
            quien, id_usuario,
        )
    except (ValueError, LookupError) as e:
        raise _error_programacion(e) from e


@app.get("/v1/proyectos/{id_proyecto}/programaciones/{id_programacion}")
async def obtener_programacion_endpoint(
    id_proyecto: int, id_programacion: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> dict:
    programacion = await obtener_programacion(get_db_config(proyecto["id"]), proyecto["id"], id_programacion)
    if not programacion:
        raise HTTPException(404, "Programación no encontrada")
    return programacion


@app.put("/v1/proyectos/{id_proyecto}/programaciones/{id_programacion}")
async def actualizar_programacion_endpoint(
    id_proyecto: int, id_programacion: int, datos: DatosProgramacion,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    # exclude_unset: max_recordatorios=null (sin límite) no es lo mismo que no mandarlo
    campos = datos.model_dump(exclude={"ids_usuarios", "ids_documentos"}, exclude_unset=True)
    try:
        return await actualizar_programacion(
            get_db_config(proyecto["id"]), proyecto["id"], id_programacion, campos,
            datos.ids_usuarios, datos.ids_documentos,
        )
    except (ValueError, LookupError) as e:
        raise _error_programacion(e) from e


@app.post("/v1/proyectos/{id_proyecto}/programaciones/{id_programacion}/pausar")
async def pausar_programacion_endpoint(
    id_proyecto: int, id_programacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        return await cambiar_pausa(get_db_config(proyecto["id"]), proyecto["id"], id_programacion, True)
    except (ValueError, LookupError) as e:
        raise _error_programacion(e) from e


@app.post("/v1/proyectos/{id_proyecto}/programaciones/{id_programacion}/reanudar")
async def reanudar_programacion_endpoint(
    id_proyecto: int, id_programacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        return await cambiar_pausa(get_db_config(proyecto["id"]), proyecto["id"], id_programacion, False)
    except (ValueError, LookupError) as e:
        raise _error_programacion(e) from e


@app.delete("/v1/proyectos/{id_proyecto}/programaciones/{id_programacion}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_programacion_endpoint(
    id_proyecto: int, id_programacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> None:
    if not await eliminar_programacion(get_db_config(proyecto["id"]), id_programacion):
        raise HTTPException(404, "Programación no encontrada")


@app.get("/v1/proyectos/{id_proyecto}/notificaciones")
async def listar_notificaciones_endpoint(
    id_proyecto: int, solo_no_leidas: bool = False, archivadas: bool = False,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> list[dict]:
    if identidad.tipo != "usuario":
        return []
    return await listar_notificaciones(
        get_db_config(proyecto["id"]), identidad.id, solo_no_leidas, archivadas=archivadas,
    )


@app.get("/v1/proyectos/{id_proyecto}/notificaciones/no-leidas")
async def contar_notificaciones_no_leidas(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    if identidad.tipo != "usuario":
        return {"total": 0}
    return {"total": await contar_no_leidas(get_db_config(proyecto["id"]), identidad.id)}


@app.post("/v1/proyectos/{id_proyecto}/notificaciones/leer-todas", status_code=status.HTTP_204_NO_CONTENT)
async def leer_todas_notificaciones(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> None:
    if identidad.tipo == "usuario":
        await marcar_leidas(get_db_config(proyecto["id"]), identidad.id)


class SeleccionNotificaciones(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)
    archivada: bool = True


@app.post("/v1/proyectos/{id_proyecto}/notificaciones/archivar")
async def archivar_notificaciones_endpoint(
    id_proyecto: int, datos: SeleccionNotificaciones, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Archivar (archivada=true) o sacar del archivo (false). Solo las suyas."""
    if identidad.tipo != "usuario":
        return {"cambiadas": 0}
    return {"cambiadas": await archivar_notificaciones(
        get_db_config(proyecto["id"]), identidad.id, datos.ids, datos.archivada,
    )}


@app.post("/v1/proyectos/{id_proyecto}/notificaciones/purgar")
async def purgar_notificaciones_endpoint(
    id_proyecto: int, datos: SeleccionNotificaciones, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Borrado definitivo; solo de las archivadas y solo las suyas."""
    if identidad.tipo != "usuario":
        return {"borradas": 0}
    return {"borradas": await purgar_notificaciones(get_db_config(proyecto["id"]), identidad.id, datos.ids)}


@app.post("/v1/proyectos/{id_proyecto}/notificaciones/{id_notificacion}/leida", status_code=status.HTTP_204_NO_CONTENT)
async def leer_notificacion(
    id_proyecto: int, id_notificacion: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> None:
    if identidad.tipo == "usuario":
        await marcar_leidas(get_db_config(proyecto["id"]), identidad.id, id_notificacion)


@app.post("/v1/proyectos/{id_proyecto}/avisos/{id_ejecucion}/hecho")
async def marcar_hecho_endpoint(
    id_proyecto: int, id_ejecucion: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Lo puede cerrar quien recibió el aviso (aunque sea invitado) o
    cualquiera que pueda escribir en el proyecto."""
    config = get_db_config(proyecto["id"])
    if identidad.tipo == "usuario" and not await puede_editar_proyecto(identidad.id, proyecto["id"]):
        mias = await listar_notificaciones(config, identidad.id, limite=1000, archivadas=None)
        if not any(n["id_ejecucion"] == id_ejecucion for n in mias):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Este aviso no es tuyo")
    quien, _ = await _quien_panel(identidad)
    try:
        return await marcar_hecho(config, id_ejecucion, quien)
    except (ValueError, LookupError) as e:
        raise _error_programacion(e) from e


# ---------- Bloc de notas (ver docs/gestion-documental.md → "Bloc de notas") ----------
# Verlas, cualquiera con acceso (cada uno las suyas, las compartidas con
# él y las de todos; soporte solo las de todos); escribir, cualquiera
# salvo invitado.

def _error_bloc(e: Exception) -> HTTPException:
    if isinstance(e, PermissionError):
        return HTTPException(status.HTTP_403_FORBIDDEN, str(e))
    return HTTPException(404 if isinstance(e, LookupError) else 400, str(e))


class DatosNotaBloc(BaseModel):
    titulo: str | None = None
    descripcion: str | None = None
    contenido: str | None = None
    fecha: str | None = None
    fijada: bool | None = None
    archivada: bool | None = None
    color: str | None = None  # ver COLORES en _dep_bloc_notas.py; null lo quita
    visibilidad: Literal["privada", "personas", "todos"] | None = None
    ids_personas: list[int] | None = None
    etiquetas: list[str] | None = None
    ids_notas: list[int] | None = None
    ids_documentos: list[int] | None = None
    ids_registros: list[int] | None = None
    ids_entidades: list[int] | None = None


class EnlaceNotaBloc(BaseModel):
    tipo: Literal["nota", "documento", "registro", "entidad"]
    id_destino: int


@app.get("/v1/proyectos/{id_proyecto}/bloc-notas")
async def listar_notas_bloc_endpoint(
    id_proyecto: int, texto: str | None = None, etiqueta: str | None = None,
    desde: str | None = None, hasta: str | None = None, id_documento: int | None = None,
    id_registro: int | None = None, id_nota: int | None = None, id_entidad: int | None = None,
    archivadas: Literal["no", "si", "todas"] = "no", solo_mias: bool = False, color: str | None = None,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> list[dict]:
    _, id_usuario = await _quien_panel(identidad)
    config = get_db_config(proyecto["id"])
    try:
        notas = await bloc.buscar_notas(
            config, id_usuario, texto, etiqueta, desde, hasta,
            id_documento, id_registro, id_nota, {"no": False, "si": True, "todas": None}[archivadas],
            solo_mias, limite=500, color=color, id_entidad=id_entidad,
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e
    estados = await seguimiento.seguimientos_de(config, "nota_bloc", [n["id"] for n in notas])
    return [{**n, "seguimiento": estados.get(n["id"])} for n in notas]


@app.get("/v1/proyectos/{id_proyecto}/bloc-notas/etiquetas")
async def listar_etiquetas_bloc_endpoint(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> list[dict]:
    _, id_usuario = await _quien_panel(identidad)
    return await bloc.etiquetas_en_uso(get_db_config(proyecto["id"]), id_usuario)


@app.get("/v1/proyectos/{id_proyecto}/bloc-notas/{id_nota}")
async def obtener_nota_bloc_endpoint(
    id_proyecto: int, id_nota: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    _, id_usuario = await _quien_panel(identidad)
    try:
        return await bloc.obtener_nota(get_db_config(proyecto["id"]), id_usuario, id_nota, proyecto["id"])
    except LookupError as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/bloc-notas")
async def crear_nota_bloc_endpoint(
    id_proyecto: int, datos: DatosNotaBloc, proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, id_usuario = await _quien_panel(identidad)
    try:
        return await bloc.crear_nota(
            get_db_config(proyecto["id"]), proyecto["id"], id_usuario, quien, datos.model_dump(exclude_none=True),
        )
    except (ValueError, LookupError, PermissionError) as e:
        raise _error_bloc(e) from e


@app.put("/v1/proyectos/{id_proyecto}/bloc-notas/{id_nota}")
async def actualizar_nota_bloc_endpoint(
    id_proyecto: int, id_nota: int, datos: DatosNotaBloc,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, id_usuario = await _quien_panel(identidad)
    # exclude_unset: descripcion=null (vaciarla) no es lo mismo que no mandarla
    campos = datos.model_dump(exclude_unset=True, exclude={"ids_notas", "ids_documentos", "ids_registros", "ids_entidades"})
    try:
        return await bloc.actualizar_nota(get_db_config(proyecto["id"]), proyecto["id"], id_usuario, quien, id_nota, campos)
    except (ValueError, LookupError, PermissionError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/bloc-notas/{id_nota}/enlaces")
async def enlazar_nota_bloc_endpoint(
    id_proyecto: int, id_nota: int, datos: EnlaceNotaBloc,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, id_usuario = await _quien_panel(identidad)
    try:
        return await bloc.enlazar(
            get_db_config(proyecto["id"]), id_usuario, quien, id_nota, datos.tipo, datos.id_destino, proyecto["id"],
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.delete("/v1/proyectos/{id_proyecto}/bloc-notas/{id_nota}/enlaces/{tipo}/{id_destino}")
async def desenlazar_nota_bloc_endpoint(
    id_proyecto: int, id_nota: int, tipo: Literal["nota", "documento", "registro", "entidad"], id_destino: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, id_usuario = await _quien_panel(identidad)
    try:
        return await bloc.desenlazar(
            get_db_config(proyecto["id"]), id_usuario, quien, id_nota, tipo, id_destino, proyecto["id"],
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.delete("/v1/proyectos/{id_proyecto}/bloc-notas/{id_nota}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_nota_bloc_endpoint(
    id_proyecto: int, id_nota: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> None:
    _, id_usuario = await _quien_panel(identidad)
    try:
        await bloc.eliminar_nota(get_db_config(proyecto["id"]), id_usuario, id_nota)
    except (LookupError, PermissionError) as e:
        raise _error_bloc(e) from e


# ---------- Seguimiento (ver docs/gestion-documental.md → "Seguimiento") ----------
# Estado de notas del bloc, documentos y notas de documentos. Verlo,
# cualquiera con acceso (de las notas del bloc, las que ve); cambiarlo,
# cualquiera salvo invitado.

TipoSeguimiento = Literal["nota_bloc", "documento", "nota_documento"]


class DatosSeguimiento(BaseModel):
    estado: Literal["pendiente", "en_curso", "realizado", "aplazado"] | None = None  # null = sin estado
    id_usuario_responsable: int | None = None  # null = nadie
    aplazado_hasta: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/seguimiento")
async def listar_seguimiento_endpoint(
    id_proyecto: int, estados: str | None = None, tipo: TipoSeguimiento | None = None,
    solo_mios: bool = False, sin_responsable: bool = False, incluir_archivados: bool = False,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> list[dict]:
    """`estados`: separados por comas (pendiente,en_curso...)."""
    _, id_usuario = await _quien_panel(identidad)
    if solo_mios and not id_usuario:
        return []
    try:
        return await seguimiento.listar_seguimiento(
            get_db_config(proyecto["id"]), proyecto["id"], id_usuario,
            [e for e in (estados or "").split(",") if e], tipo,
            id_usuario if solo_mios else None, sin_responsable, incluir_archivados,
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.get("/v1/proyectos/{id_proyecto}/seguimiento/{tipo}/{id_objeto}")
async def obtener_seguimiento_endpoint(
    id_proyecto: int, tipo: TipoSeguimiento, id_objeto: int,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    _, id_usuario = await _quien_panel(identidad)
    try:
        return await seguimiento.obtener_seguimiento(get_db_config(proyecto["id"]), proyecto["id"], id_usuario, tipo, id_objeto)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.put("/v1/proyectos/{id_proyecto}/seguimiento/{tipo}/{id_objeto}")
async def cambiar_seguimiento_endpoint(
    id_proyecto: int, tipo: TipoSeguimiento, id_objeto: int, datos: DatosSeguimiento,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Manda siempre el estado y el responsable (el formulario los tiene
    los dos); `aplazado_hasta` solo al aplazar."""
    quien, id_usuario = await _quien_panel(identidad)
    try:
        return await seguimiento.cambiar_seguimiento(
            get_db_config(proyecto["id"]), proyecto["id"], id_usuario, quien, tipo, id_objeto,
            estado=datos.estado, id_responsable=datos.id_usuario_responsable, aplazado_hasta=datos.aplazado_hasta,
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


# ---------- CRM: contactos, etapas y oportunidades ----------
# Ver docs → "CRM". Mismas reglas que las herramientas MCP (viven
# en _mod_crm.py). Leer: todo el proyecto; cambiar: cualquiera salvo invitado.


class DatosContacto(BaseModel):
    nombre: str | None = None
    cargo: str | None = None
    email: str | None = None
    telefono: str | None = None
    observaciones: str | None = None
    principal: bool | None = None


class DatosEtapas(BaseModel):
    etapas: list[dict]


class DatosOportunidad(BaseModel):
    titulo: str | None = None
    id_entidad: int | None = None
    id_contacto: int | None = None
    importe: float | None = None
    id_etapa: int | None = None
    fecha_prevista_cierre: str | None = None
    id_usuario_responsable: int | None = None
    origen: str | None = None
    descripcion: str | None = None
    proximo_paso: str | None = None
    fecha_proximo_paso: str | None = None
    motivo_perdida: str | None = None
    fecha_cierre: str | None = None


class DocumentoOportunidad(BaseModel):
    id_documento: int


@app.get("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/contactos")
async def listar_contactos_endpoint(
    id_proyecto: int, id_entidad: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    try:
        return await crm.listar_contactos(get_db_config(proyecto["id"]), id_entidad)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/contactos")
async def crear_contacto_endpoint(
    id_proyecto: int, id_entidad: int, datos: DatosContacto,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        return await crm.crear_contacto(get_db_config(proyecto["id"]), id_entidad, datos.model_dump(exclude_unset=True))
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.put("/v1/proyectos/{id_proyecto}/contactos/{id_contacto}")
async def actualizar_contacto_endpoint(
    id_proyecto: int, id_contacto: int, datos: DatosContacto,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        return await crm.actualizar_contacto(get_db_config(proyecto["id"]), id_contacto, datos.model_dump(exclude_unset=True))
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.delete("/v1/proyectos/{id_proyecto}/contactos/{id_contacto}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_contacto_endpoint(
    id_proyecto: int, id_contacto: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> None:
    try:
        await crm.eliminar_contacto(get_db_config(proyecto["id"]), id_contacto)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.get("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/historial")
async def historial_entidad_endpoint(
    id_proyecto: int, id_entidad: int, limite: int = 100,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> list[dict]:
    _, id_usuario = await _quien_panel(identidad)
    try:
        return await crm.historial_entidad(get_db_config(proyecto["id"]), proyecto["id"], id_usuario, id_entidad, limite)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.get("/v1/proyectos/{id_proyecto}/crm/etapas")
async def listar_etapas_endpoint(
    id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> list[dict]:
    return await crm.listar_etapas(get_db_config(proyecto["id"]))


@app.put("/v1/proyectos/{id_proyecto}/crm/etapas")
async def guardar_etapas_endpoint(
    id_proyecto: int, datos: DatosEtapas, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[dict]:
    try:
        return await crm.guardar_etapas(get_db_config(proyecto["id"]), datos.etapas)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.get("/v1/proyectos/{id_proyecto}/crm/oportunidades")
async def listar_oportunidades_endpoint(
    id_proyecto: int, estado: str = "abiertas", id_entidad: int | None = None,
    id_responsable: int | None = None, solo_mias: bool = False, sin_responsable: bool = False,
    texto: str | None = None,
    proyecto: dict = Depends(proyecto_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Las oportunidades y el resumen por etapa (para las cabeceras del tablero)."""
    _, id_usuario = await _quien_panel(identidad)
    if solo_mias:
        if not id_usuario:
            return {"oportunidades": [], "resumen": []}
        id_responsable = id_usuario
    config = get_db_config(proyecto["id"])
    try:
        oportunidades = await crm.listar_oportunidades(
            config, proyecto["id"], estado, id_entidad, None, id_responsable, sin_responsable, texto,
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e
    return {"oportunidades": oportunidades, "resumen": await crm.resumen_embudo(config, proyecto["id"], id_responsable)}


@app.get("/v1/proyectos/{id_proyecto}/crm/oportunidades/{id_oportunidad}")
async def obtener_oportunidad_endpoint(
    id_proyecto: int, id_oportunidad: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> dict:
    try:
        return await crm.obtener_oportunidad(get_db_config(proyecto["id"]), proyecto["id"], id_oportunidad)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/crm/oportunidades")
async def crear_oportunidad_endpoint(
    id_proyecto: int, datos: DatosOportunidad,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await crm.crear_oportunidad(
            get_db_config(proyecto["id"]), proyecto["id"], quien, datos.model_dump(exclude_unset=True),
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.put("/v1/proyectos/{id_proyecto}/crm/oportunidades/{id_oportunidad}")
async def actualizar_oportunidad_endpoint(
    id_proyecto: int, id_oportunidad: int, datos: DatosOportunidad,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Solo cambia lo que viene en el cuerpo (null vacía el campo)."""
    quien, _ = await _quien_panel(identidad)
    try:
        return await crm.actualizar_oportunidad(
            get_db_config(proyecto["id"]), proyecto["id"], quien, id_oportunidad, datos.model_dump(exclude_unset=True),
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.delete("/v1/proyectos/{id_proyecto}/crm/oportunidades/{id_oportunidad}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_oportunidad_endpoint(
    id_proyecto: int, id_oportunidad: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> None:
    try:
        await crm.eliminar_oportunidad(get_db_config(proyecto["id"]), proyecto["id"], id_oportunidad)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/crm/oportunidades/{id_oportunidad}/documentos")
async def relacionar_documento_oportunidad_endpoint(
    id_proyecto: int, id_oportunidad: int, datos: DocumentoOportunidad,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        await crm.relacionar_documento(get_db_config(proyecto["id"]), proyecto["id"], id_oportunidad, datos.id_documento)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e
    return {"id_oportunidad": id_oportunidad, "id_documento": datos.id_documento}


@app.delete(
    "/v1/proyectos/{id_proyecto}/crm/oportunidades/{id_oportunidad}/documentos/{id_documento}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def quitar_documento_oportunidad_endpoint(
    id_proyecto: int, id_oportunidad: int, id_documento: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> None:
    await crm.quitar_documento(get_db_config(proyecto["id"]), id_oportunidad, id_documento)


# ---------- Conexión con el ERP: Multiplika SIF e importación desde Excel ----------
# Ver docs → "CRM". Dar de alta o quitar la conexión con SIF: solo
# admin (lleva una credencial). Sincronizar e importar: cualquiera que pueda
# escribir. Leer: todo el proyecto.


class DatosConexionSIF(BaseModel):
    nombre_credencial: str
    url: str = sif.URL_POR_DEFECTO
    nombre: str = "Multiplika SIF"


class CambiosConexionSIF(BaseModel):
    activa: bool | None = None
    nombre: str | None = None


class DatosRevisionImportacion(BaseModel):
    mapeo: dict[str, int | None] | None = None
    formato_fecha: str | None = None


@app.get("/v1/proyectos/{id_proyecto}/crm/erp/conexiones")
async def listar_conexiones_erp(id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)) -> list[dict]:
    return await sif.listar_conexiones(get_db_config(proyecto["id"]))


@app.post("/v1/proyectos/{id_proyecto}/crm/erp/conexiones")
async def crear_conexion_erp(
    id_proyecto: int, datos: DatosConexionSIF, proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    try:
        return await sif.crear_conexion(get_db_config(proyecto["id"]), datos.nombre, datos.url, datos.nombre_credencial)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.put("/v1/proyectos/{id_proyecto}/crm/erp/conexiones/{id_conexion}")
async def actualizar_conexion_erp(
    id_proyecto: int, id_conexion: int, datos: CambiosConexionSIF, proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    try:
        return await sif.actualizar_conexion(get_db_config(proyecto["id"]), id_conexion, datos.model_dump(exclude_unset=True))
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.delete("/v1/proyectos/{id_proyecto}/crm/erp/conexiones/{id_conexion}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_conexion_erp(
    id_proyecto: int, id_conexion: int, proyecto: dict = Depends(admin_gestion_documental_actual),
) -> None:
    try:
        await sif.eliminar_conexion(get_db_config(proyecto["id"]), id_conexion)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/crm/erp/conexiones/{id_conexion}/sincronizar")
async def sincronizar_conexion_erp(
    id_proyecto: int, id_conexion: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        return await sif.sincronizar(get_db_config(proyecto["id"]), id_conexion)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.get("/v1/proyectos/{id_proyecto}/crm/erp/importaciones")
async def listar_importaciones_erp(id_proyecto: int, proyecto: dict = Depends(proyecto_gestion_documental_actual)) -> list[dict]:
    return await erp.listar_importaciones(get_db_config(proyecto["id"]))


@app.post("/v1/proyectos/{id_proyecto}/crm/erp/importaciones")
async def crear_importacion_erp(
    id_proyecto: int,
    archivo: UploadFile = File(...),
    objeto: str = Form(...),
    todos_los_clientes: bool = Form(default=False),
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    """Guarda el fichero para revisarlo; no aplica nada (ver aplicar)."""
    quien, _ = await _quien_panel(identidad)
    contenido = await archivo.read()
    if len(contenido) > 20 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El fichero pasa de 20 MB")
    try:
        return await erp.crear_importacion(
            get_db_config(proyecto["id"]), objeto, archivo.filename or "fichero.csv", contenido, quien, todos_los_clientes,
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/crm/erp/importaciones/{id_importacion}/revisar")
async def revisar_importacion_erp(
    id_proyecto: int, id_importacion: int, datos: DatosRevisionImportacion,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        return await erp.vista_importacion(get_db_config(proyecto["id"]), id_importacion, datos.mapeo, datos.formato_fecha)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/crm/erp/importaciones/{id_importacion}/aplicar")
async def aplicar_importacion_erp(
    id_proyecto: int, id_importacion: int, datos: DatosRevisionImportacion,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
    identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await erp.aplicar_importacion(
            get_db_config(proyecto["id"]), id_importacion, quien, datos.mapeo, datos.formato_fecha,
        )
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e


@app.post("/v1/proyectos/{id_proyecto}/crm/erp/importaciones/{id_importacion}/descartar")
async def descartar_importacion_erp(
    id_proyecto: int, id_importacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        await erp.descartar_importacion(get_db_config(proyecto["id"]), id_importacion)
    except (ValueError, LookupError) as e:
        raise _error_bloc(e) from e
    return {"id": id_importacion, "descartada": True}


@app.get("/v1/proyectos/{id_proyecto}/entidades/{id_entidad}/erp")
async def datos_erp_entidad(
    id_proyecto: int, id_entidad: int, proyecto: dict = Depends(proyecto_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    return {"resumen": await erp.resumen_economico(config, id_entidad), "facturas": await erp.facturas_entidad(config, id_entidad)}


# ---------- Webs y redes sociales (ver docs → "Webs y redes sociales") ----------
# Mismas reglas que las herramientas MCP (viven en los modelos). Nada para
# invitados, ni leer. Dar de alta, cambiar datos, nivel de permiso o ajustes:
# solo admin (lleva credenciales y decide cuánto puede hacer la IA); el
# contenido y las propuestas (proponer, aplicar, rechazar, deshacer):
# cualquiera que pueda escribir. Desde aquí la vía es siempre "panel": es la
# única que puede aprobar en activos con nivel «proponer».


class DatosActivo(BaseModel):
    nombre: str | None = None
    tipo: str | None = None
    plataforma: str | None = None
    url: str | None = None
    descripcion: str | None = None
    id_credencial: int | None = None
    id_entidad: int | None = None
    nivel_permiso: str | None = None
    estado: str | None = None
    archivado: bool | None = None
    # Para poder vaciar credencial o entidad (None ya significa "no tocar")
    quitar_credencial: bool = False
    quitar_entidad: bool = False


class NuevaPropuesta(BaseModel):
    operacion: str
    datos: dict = {}
    id_objeto: int | None = None
    motivo: str | None = None


class MotivoRechazo(BaseModel):
    motivo: str | None = None


def _error_webs(e: Exception) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@app.get("/v1/proyectos/{id_proyecto}/activos/catalogo")
async def catalogo_activos(id_proyecto: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    """Las opciones de los formularios, sacadas del mismo sitio que valida."""
    return {"tipos": TIPOS_ACTIVO, "plataformas": PLATAFORMAS, "plataformas_conectables": PLATAFORMAS_CONECTABLES,
            "capacidades": CAPACIDAD_POR_PLATAFORMA,
            "niveles": NIVELES_PERMISO, "ajustes": catalogo_ajustes(), "operaciones": list(OPERACIONES)}


@app.get("/v1/proyectos/{id_proyecto}/activos")
async def listar_activos(
    id_proyecto: int, q: str | None = None, tipo: str | None = None, incluir_archivados: bool = False,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    peor = await vigilancia.peor_estado_por_activo(config)
    return [{**a, "vigilancia": peor.get(a["id"])}
            for a in await ActivosDigitalesCRUD(config).buscar(q, tipo, None, incluir_archivados)]


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}")
async def obtener_activo(id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    activos = ActivosDigitalesCRUD(get_db_config(proyecto["id"]))
    try:
        return await activos.con_nombres(await activos.obtener_o_error(id_activo))
    except ValueError as e:
        raise HTTPException(404, str(e)) from e


@app.post("/v1/proyectos/{id_proyecto}/activos")
async def crear_activo_digital(
    id_proyecto: int, datos: DatosActivo, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    try:
        return await ActivosDigitalesCRUD(get_db_config(proyecto["id"])).crear(
            datos.model_dump(exclude={"quitar_credencial", "quitar_entidad"}))
    except ValueError as e:
        raise _error_webs(e) from e


@app.put("/v1/proyectos/{id_proyecto}/activos/{id_activo}")
async def actualizar_activo_digital(
    id_proyecto: int, id_activo: int, datos: DatosActivo, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    activos = ActivosDigitalesCRUD(get_db_config(proyecto["id"]))
    try:
        await activos.obtener_o_error(id_activo)
        vaciar = {k: None for k, quitar in (("id_credencial", datos.quitar_credencial),
                                             ("id_entidad", datos.quitar_entidad)) if quitar}
        if vaciar:
            await activos.update(id_activo, vaciar)
        return await activos.actualizar(id_activo, datos.model_dump(exclude={"quitar_credencial", "quitar_entidad"}),
                                        puede_subir_nivel=True)
    except ValueError as e:
        raise _error_webs(e) from e


@app.put("/v1/proyectos/{id_proyecto}/activos/{id_activo}/ajustes")
async def actualizar_ajustes_activo(
    id_proyecto: int, id_activo: int, ajustes: dict, proyecto: dict = Depends(admin_gestion_documental_actual)
) -> dict:
    try:
        return await ActivosDigitalesCRUD(get_db_config(proyecto["id"])).actualizar_ajustes(id_activo, ajustes)
    except ValueError as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/probar")
async def probar_conexion_activo(
    id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await ActivosDigitalesCRUD(get_db_config(proyecto["id"])).probar_conexion(id_activo)
    except ValueError as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/contenido")
async def listar_contenido_web(
    id_proyecto: int, id_activo: int, tipo: str, buscar: str | None = None, estado: str | None = None,
    pagina: int = 1, proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[dict]:
    activos = ActivosDigitalesCRUD(get_db_config(proyecto["id"]))
    try:
        cliente = await activos.cliente_wordpress(await activos.obtener_o_error(id_activo))
        return await cliente.listar(tipo, buscar, estado, pagina)
    except (ValueError, WordPressError) as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/contenido/{tipo}/{id_objeto}")
async def obtener_contenido_web(
    id_proyecto: int, id_activo: int, tipo: str, id_objeto: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    activos = ActivosDigitalesCRUD(get_db_config(proyecto["id"]))
    try:
        cliente = await activos.cliente_wordpress(await activos.obtener_o_error(id_activo))
        return await cliente.obtener(tipo, id_objeto)
    except (ValueError, WordPressError) as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/propuestas")
async def proponer_cambio_web(
    id_proyecto: int, id_activo: int, datos: NuevaPropuesta,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await CambiosExternosCRUD(get_db_config(proyecto["id"])).proponer(
            id_activo, datos.operacion, datos.datos, "panel", quien, id_objeto=datos.id_objeto, motivo=datos.motivo)
    except ValueError as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/cambios-web")
async def listar_cambios_web(
    id_proyecto: int, id_activo: int | None = None, estado: str | None = None, limite: int = 100,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[dict]:
    return await CambiosExternosCRUD(get_db_config(proyecto["id"])).buscar(id_activo, estado, limite)


@app.get("/v1/proyectos/{id_proyecto}/cambios-web/{id_cambio}")
async def obtener_cambio_web(
    id_proyecto: int, id_cambio: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await CambiosExternosCRUD(get_db_config(proyecto["id"])).obtener_salida(id_cambio)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e


@app.post("/v1/proyectos/{id_proyecto}/cambios-web/{id_cambio}/aplicar")
async def aplicar_cambio_web(
    id_proyecto: int, id_cambio: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await CambiosExternosCRUD(get_db_config(proyecto["id"])).aplicar(id_cambio, "panel", quien)
    except ValueError as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/cambios-web/{id_cambio}/rechazar")
async def rechazar_cambio_web(
    id_proyecto: int, id_cambio: int, datos: MotivoRechazo,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await CambiosExternosCRUD(get_db_config(proyecto["id"])).rechazar(id_cambio, "panel", quien, datos.motivo)
    except ValueError as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/cambios-web/{id_cambio}/deshacer")
async def deshacer_cambio_web(
    id_proyecto: int, id_cambio: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await CambiosExternosCRUD(get_db_config(proyecto["id"])).deshacer(id_cambio, "panel", quien)
    except ValueError as e:
        raise _error_webs(e) from e


class DatosVigilancia(BaseModel):
    activa: bool | None = None
    cada_minutos: int | None = None


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/vigilancia")
async def estado_vigilancia_web(
    id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> list[dict]:
    try:
        return await vigilancia.listar_estado(get_db_config(proyecto["id"]), id_activo)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/vigilancia/historial")
async def historial_vigilancia_web(
    id_proyecto: int, id_activo: int, tipo: str | None = None, dias: int = 30, solo_problemas: bool = False,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[dict]:
    return await vigilancia.historial(get_db_config(proyecto["id"]), id_activo, tipo, dias, solo_problemas)


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/vigilancia/comprobar")
async def comprobar_ahora_web(
    id_proyecto: int, id_activo: int, tipo: str | None = None,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[dict]:
    try:
        return await vigilancia.comprobar_ahora(get_db_config(proyecto["id"]), proyecto["id"], id_activo, tipo)
    except ValueError as e:
        raise _error_webs(e) from e


@app.put("/v1/proyectos/{id_proyecto}/activos/{id_activo}/vigilancia/{tipo}")
async def configurar_vigilancia_web(
    id_proyecto: int, id_activo: int, tipo: str, datos: DatosVigilancia,
    proyecto: dict = Depends(admin_gestion_documental_actual),
) -> dict:
    try:
        return await vigilancia.configurar(get_db_config(proyecto["id"]), id_activo, tipo, datos.activa, datos.cada_minutos)
    except ValueError as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/vigilancia/aceptar-administradores")
async def aceptar_administradores_web(
    id_proyecto: int, id_activo: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await vigilancia.aceptar_administradores(get_db_config(proyecto["id"]), id_activo, quien)
    except ValueError as e:
        raise _error_webs(e) from e


async def _conector_de(config: dict, id_activo: int) -> ClienteConector:
    activos = ActivosDigitalesCRUD(config)
    activo = await activos.obtener_o_error(id_activo)
    if not activo["conector_instalado"]:
        raise ValueError("Esta web no tiene el conector de Multiplika instalado (o falta probar la conexión)")
    return ClienteConector(await activos.cliente_wordpress(activo))


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/copias")
async def listar_copias_web(
    id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        locales = await (await _conector_de(config, id_activo)).listar_copias()
        ajustes = ajustes_efectivos(await ActivosDigitalesCRUD(config).obtener(id_activo))
        remotas, error_remoto = None, None
        if ajustes["copias_credencial_remota"]:
            try:
                remotas = await listar_remoto(config, ajustes["copias_credencial_remota"], ajustes["copias_carpeta_remota"])
            except Exception as e:  # servidor remoto caído: se enseña lo local igualmente
                error_remoto = str(e)
    except (ValueError, ConectorError) as e:
        raise _error_webs(e) from e
    return {**locales, "remotas": remotas, "error_remoto": error_remoto}


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/copias")
async def hacer_copia_web(
    id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await (await _conector_de(get_db_config(proyecto["id"]), id_activo)).crear_copia()
    except (ValueError, ConectorError) as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/errores")
async def leer_errores_web(
    id_proyecto: int, id_activo: int, lineas: int = 50, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await (await _conector_de(get_db_config(proyecto["id"]), id_activo)).errores(max(1, min(lineas, 300)))
    except (ValueError, ConectorError) as e:
        raise _error_webs(e) from e


# El plugin se sirve comprimido tal cual está en conector_wordpress/ del repo
# (hay que desplegar esa carpeta junto al panel: ver docs/despliegue).
_DIR_CONECTOR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "conector_wordpress")


@app.get("/v1/proyectos/{id_proyecto}/conector-wordpress.zip")
async def descargar_conector_wordpress(
    id_proyecto: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> Response:
    carpeta = os.path.join(_DIR_CONECTOR, "multiplika-conector")
    if not os.path.isdir(carpeta):
        raise HTTPException(404, "El conector no está disponible en este servidor")
    memoria = io.BytesIO()
    with zipfile.ZipFile(memoria, "w", zipfile.ZIP_DEFLATED) as z:
        for raiz, _, archivos in os.walk(carpeta):
            for nombre in archivos:
                ruta = os.path.join(raiz, nombre)
                z.write(ruta, os.path.join("multiplika-conector", os.path.relpath(ruta, carpeta)))
    return Response(content=memoria.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="multiplika-conector.zip"'})


# ---------- SEO (fase 3 de webs y redes) ----------

class EstadoHallazgo(BaseModel):
    estado: str


class MesInforme(BaseModel):
    anio: int | None = None
    mes: int | None = None


@app.get("/v1/proyectos/{id_proyecto}/seo/google")
async def cuenta_google_seo(id_proyecto: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    """Si hay Search Console y PageSpeed en este servidor, y el correo que el
    cliente tiene que añadir en su Search Console."""
    return {"correo": google_seo.correo_cuenta_servicio(), "pagespeed": bool(os.environ.get("GD_GOOGLE_API_KEY"))}


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/seo/rendimiento")
async def rendimiento_google_web(
    id_proyecto: int, id_activo: int, dias: int = 28, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await seo.rendimiento_google(get_db_config(proyecto["id"]), id_activo, max(7, min(dias, 480)))
    except (ValueError, google_seo.GoogleError) as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/seo/velocidad")
async def velocidad_web(
    id_proyecto: int, id_activo: int, estrategia: str = "mobile", url: str | None = None,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    try:
        activo = await ActivosDigitalesCRUD(get_db_config(proyecto["id"])).obtener_o_error(id_activo)
        return await google_seo.velocidad(url or activo["url"] + "/", "desktop" if estrategia == "desktop" else "mobile")
    except (ValueError, google_seo.GoogleError) as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/seo/auditar")
async def auditar_seo_web(
    id_proyecto: int, id_activo: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await seo.auditar(get_db_config(proyecto["id"]), id_activo, quien)
    except ValueError as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/seo/hallazgos")
async def hallazgos_seo_web(
    id_proyecto: int, id_activo: int, estado: str | None = None, gravedad: str | None = None,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> dict:
    config = get_db_config(proyecto["id"])
    return {"auditoria": await seo.ultima_auditoria(config, id_activo),
            "hallazgos": await seo.hallazgos(config, id_activo, estado, gravedad, 500)}


@app.put("/v1/proyectos/{id_proyecto}/seo/hallazgos/{id_hallazgo}")
async def marcar_hallazgo_seo(
    id_proyecto: int, id_hallazgo: int, datos: EstadoHallazgo, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await seo.marcar_hallazgo(get_db_config(proyecto["id"]), id_hallazgo, datos.estado)
    except ValueError as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/seo/hallazgos/{id_hallazgo}/tarea")
async def hallazgo_seo_a_tarea(
    id_proyecto: int, id_hallazgo: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, id_usuario = await _quien_panel(identidad)
    try:
        return await seo.hallazgo_a_tarea(get_db_config(proyecto["id"]), proyecto["id"], id_hallazgo, id_usuario, quien)
    except (ValueError, LookupError) as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/seo/pagina/{id_objeto}")
async def leer_seo_pagina(
    id_proyecto: int, id_activo: int, id_objeto: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await (await _conector_de(get_db_config(proyecto["id"]), id_activo)).leer_seo(id_objeto)
    except (ValueError, ConectorError) as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/seo/informe")
async def guardar_informe_seo(
    id_proyecto: int, id_activo: int, datos: MesInforme, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    anio, mes = seo.mes_anterior(seo.ahora_madrid())
    try:
        r = await seo.guardar_informe(get_db_config(proyecto["id"]), id_activo, datos.anio or anio, datos.mes or mes)
    except ValueError as e:
        raise _error_webs(e) from e
    return {"id_documento": r["id_documento"], "nombre": r["nombre"]}


# ---------- Bases de datos (fase 4 de webs y redes) ----------

class ConsultaBd(BaseModel):
    sql: str
    limite: int = 200


class ConsultaGuardada(BaseModel):
    nombre: str
    sql: str
    descripcion: str | None = None
    id_consulta: int | None = None


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/bd/esquema")
async def esquema_bd(id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> list[dict]:
    try:
        return await bd.esquema(get_db_config(proyecto["id"]), id_activo)
    except (ValueError, bd.BaseDatosError) as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/bd/consulta")
async def consultar_bd(
    id_proyecto: int, id_activo: int, datos: ConsultaBd, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    """Solo lectura (la base de datos lo garantiza con una transacción de
    solo lectura): POST porque el SQL puede ser largo, no porque cambie nada."""
    try:
        return await bd.consultar(get_db_config(proyecto["id"]), id_activo, datos.sql, datos.limite)
    except (ValueError, bd.BaseDatosError) as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/bd/consultas")
async def listar_consultas_bd(id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> list[dict]:
    return await bd.listar_consultas(get_db_config(proyecto["id"]), id_activo)


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/bd/consultas")
async def guardar_consulta_bd(
    id_proyecto: int, id_activo: int, datos: ConsultaGuardada,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await bd.guardar_consulta(get_db_config(proyecto["id"]), id_activo, datos.nombre, datos.sql, datos.descripcion,
                                         quien, datos.id_consulta)
    except (ValueError, bd.BaseDatosError) as e:
        raise _error_webs(e) from e


@app.post("/v1/proyectos/{id_proyecto}/bd/consultas/{id_consulta}/ejecutar")
async def ejecutar_consulta_bd(id_proyecto: int, id_consulta: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    try:
        return await bd.ejecutar_consulta_guardada(get_db_config(proyecto["id"]), id_consulta)
    except (ValueError, bd.BaseDatosError) as e:
        raise _error_webs(e) from e


@app.delete("/v1/proyectos/{id_proyecto}/bd/consultas/{id_consulta}", status_code=status.HTTP_204_NO_CONTENT)
async def borrar_consulta_bd(id_proyecto: int, id_consulta: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> None:
    await bd.borrar_consulta(get_db_config(proyecto["id"]), id_consulta)


# ---------- Redes sociales: calendario editorial (fase 5 de webs y redes) ----------

class DatosPublicacion(BaseModel):
    texto: str | None = None
    titulo: str | None = None
    ids_activos: list[int] | None = None
    ids_documentos: list[int] | None = None
    enlace: str | None = None
    fecha_prevista: str | None = None
    textos_por_red: dict | None = None
    pedir_aprobacion: bool = False


class AprobarPublicacion(BaseModel):
    publicar_ya: bool = False


def _error_publicacion(e: Exception) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@app.get("/v1/proyectos/{id_proyecto}/publicaciones")
async def listar_publicaciones(
    id_proyecto: int, desde: str | None = None, hasta: str | None = None, estado: str | None = None, id_activo: int | None = None,
    proyecto: dict = Depends(escritor_gestion_documental_actual),
) -> list[dict]:
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).listar(desde, hasta, estado, id_activo)
    except PublicacionError as e:
        raise _error_publicacion(e) from e


@app.get("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}")
async def obtener_publicacion(id_proyecto: int, id_publicacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).obtener_salida(id_publicacion)
    except PublicacionError as e:
        raise HTTPException(404, str(e)) from e


@app.post("/v1/proyectos/{id_proyecto}/publicaciones")
async def crear_publicacion(
    id_proyecto: int, datos: DatosPublicacion,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).crear(
            datos.model_dump(exclude={"pedir_aprobacion"}), "panel", quien, datos.pedir_aprobacion)
    except (ValueError, PublicacionError) as e:
        raise _error_publicacion(e) from e


@app.put("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}")
async def actualizar_publicacion(
    id_proyecto: int, id_publicacion: int, datos: DatosPublicacion, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).actualizar(
            id_publicacion, {k: v for k, v in datos.model_dump(exclude={"pedir_aprobacion"}).items() if v is not None})
    except (ValueError, PublicacionError) as e:
        raise _error_publicacion(e) from e


@app.post("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}/pedir-aprobacion")
async def pedir_aprobacion_publicacion(id_proyecto: int, id_publicacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).pedir_aprobacion(id_publicacion)
    except PublicacionError as e:
        raise _error_publicacion(e) from e


@app.post("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}/aprobar")
async def aprobar_publicacion(
    id_proyecto: int, id_publicacion: int, datos: AprobarPublicacion,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    crud = PublicacionesCRUD(get_db_config(proyecto["id"]))
    try:
        p = await crud.aprobar(id_publicacion, "panel", quien)
        return await crud.publicar(proyecto["id"], id_publicacion, "panel", quien) if datos.publicar_ya else p
    except PublicacionError as e:
        raise _error_publicacion(e) from e


@app.post("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}/cancelar")
async def cancelar_publicacion(id_proyecto: int, id_publicacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).cancelar(id_publicacion)
    except PublicacionError as e:
        raise _error_publicacion(e) from e


@app.post("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}/retirar")
async def retirar_publicacion(
    id_proyecto: int, id_publicacion: int,
    proyecto: dict = Depends(escritor_gestion_documental_actual), identidad: Identidad = Depends(identidad_actual),
) -> dict:
    quien, _ = await _quien_panel(identidad)
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).retirar(id_publicacion, "panel", quien)
    except PublicacionError as e:
        raise _error_publicacion(e) from e


@app.post("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}/metricas")
async def metricas_publicacion(id_proyecto: int, id_publicacion: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).actualizar_metricas(id_publicacion)
    except PublicacionError as e:
        raise _error_publicacion(e) from e


@app.get("/v1/proyectos/{id_proyecto}/publicaciones/{id_publicacion}/comentarios/{id_activo}")
async def comentarios_publicacion(
    id_proyecto: int, id_publicacion: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> list[dict]:
    try:
        return await PublicacionesCRUD(get_db_config(proyecto["id"])).comentarios(id_publicacion, id_activo)
    except PublicacionError as e:
        raise _error_publicacion(e) from e


@app.get("/v1/medio-publico/{id_proyecto}/{nombre}")
async def descargar_medio_publico(id_proyecto: int, nombre: str) -> Response:
    """Pública y sin sesión: la imagen de una publicación, para que la red
    social la descargue. Solo con un token vigente (caduca a los 7 días)."""
    try:
        config = get_db_config(id_proyecto)
        medio = await medio_publico(config, os.path.splitext(nombre)[0])
    except Exception:  # proyecto que no existe, tabla sin crear...
        medio = None
    if not medio:
        raise HTTPException(404, "No encontrado")
    contenido, tipo, _ = medio
    return Response(content=contenido, media_type=tipo, headers={"Cache-Control": "public, max-age=3600"})


# ---------- GEO y webs a medida (fase 6 de webs y redes) ----------

class PreguntasGeo(BaseModel):
    preguntas: list[str]


class CambioPreguntaGeo(BaseModel):
    activa: bool | None = None
    borrar: bool = False


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/geo")
async def estado_geo(id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    config = get_db_config(proyecto["id"])
    motores = await geo.motores_disponibles(config, proyecto["id"])
    return {"preguntas": await geo.preguntas(config, id_activo), "resultados": await geo.resultados(config, id_activo),
            "motores": list(motores)}


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/geo/preguntas")
async def anadir_preguntas_geo(
    id_proyecto: int, id_activo: int, datos: PreguntasGeo, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> list[dict]:
    try:
        return await geo.anadir_preguntas(get_db_config(proyecto["id"]), id_activo, datos.preguntas)
    except ValueError as e:
        raise _error_webs(e) from e


@app.put("/v1/proyectos/{id_proyecto}/geo/preguntas/{id_pregunta}")
async def cambiar_pregunta_geo(
    id_proyecto: int, id_pregunta: int, datos: CambioPreguntaGeo, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    await geo.cambiar_pregunta(get_db_config(proyecto["id"]), id_pregunta, datos.activa, datos.borrar)
    return {"id_pregunta": id_pregunta}


@app.post("/v1/proyectos/{id_proyecto}/activos/{id_activo}/geo/medir")
async def medir_geo(id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    try:
        return await geo.medir(get_db_config(proyecto["id"]), proyecto["id"], id_activo)
    except ValueError as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/geo/web")
async def leer_geo_web(id_proyecto: int, id_activo: int, proyecto: dict = Depends(escritor_gestion_documental_actual)) -> dict:
    try:
        return await (await _conector_de(get_db_config(proyecto["id"]), id_activo)).leer_geo()
    except (ValueError, ConectorError) as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/ficheros")
async def listar_ficheros_web(
    id_proyecto: int, id_activo: int, ruta: str = ".", proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> list[dict]:
    config = get_db_config(proyecto["id"])
    try:
        return await (await ficheros_de(config, await ActivosDigitalesCRUD(config).obtener_o_error(id_activo))).listar(ruta)
    except (ValueError, FicherosError) as e:
        raise _error_webs(e) from e


@app.get("/v1/proyectos/{id_proyecto}/activos/{id_activo}/ficheros/contenido")
async def leer_fichero_web(
    id_proyecto: int, id_activo: int, ruta: str, proyecto: dict = Depends(escritor_gestion_documental_actual)
) -> dict:
    config = get_db_config(proyecto["id"])
    try:
        contenido = await (await ficheros_de(config, await ActivosDigitalesCRUD(config).obtener_o_error(id_activo))).leer(ruta)
    except (ValueError, FicherosError) as e:
        raise _error_webs(e) from e
    return {"ruta": ruta, "contenido": contenido, "existe": contenido is not None}


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
