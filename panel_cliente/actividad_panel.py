"""Registro de actividad desde el panel — ver docs/gestion-documental.md
→ "Registro de actividad". Mismo registro (gd_actividad) que el lado
MCP (mcp_server/herramientas/_herr_actividad.py).

Middleware ASGI en vez de una llamada en cada endpoint: empareja la
petición con su ruta, y si su nombre (el de la función del endpoint)
está en ACCIONES_PANEL y la respuesta sale bien (< 400), la apunta.
Un endpoint nuevo que cambie datos debe añadirse aquí.

Fuera a propósito: el borrador que se guarda solo mientras se escribe
(ruido), las conversaciones del chat (son de cada uno; lo que la IA
hace desde el chat ya lo apunta el lado MCP) y "probar enlace" (no
cambia nada)."""

import json

from mtpk_mariadb import AsyncCrudBase
from starlette.routing import Match

from database.config_db import get_db_config
from database.control.dependencias._dep_api_keys import TABLA_API_KEYS
from database.control.dependencias._dep_usuarios import TABLA_USUARIOS
from lib.jwt_tokens import decodificar_token

from ..database.modelos._mod_actividad import TIPOS_PRIVADOS, componer_descripcion, nombre_objeto, registrar_sin_fallar

# nombre del endpoint -> (verbo, tipo_objeto, parámetro de ruta con su id)
ACCIONES_PANEL = {
    "crear_copia_bd": ("hizo una copia de seguridad de la base", None, None),
    "borrar_copia_bd": ("borró una copia de seguridad de la base", None, None),
    "restaurar_copia_bd": ("restauró una copia de seguridad de la base", None, None),
    "actualizar_ajustes_copias_bd": ("cambió la programación de las copias de la base", None, None),
    "crear_documento_manual": ("creó a mano el documento", "documento", None),
    "actualizar_contexto_negocio": ("actualizó el contexto de negocio", None, None),
    "actualizar_preferencias_negocio": ("actualizó las preferencias de la IA", None, None),
    "subir_documentos_pendientes": ("subió documentos a pendientes", None, None),
    "eliminar_documento_pendiente": ("eliminó el documento pendiente", "documento_pendiente", "id_pendiente"),
    "estructurar_documento_pendiente": ("estructuró con IA el documento pendiente", "documento_pendiente", "id_pendiente"),
    "crear_tipo_documento": ("creó el tipo de documento", "tipo_documento", None),
    "actualizar_tipo_documento": ("modificó el tipo de documento", "tipo_documento", "id_tipo"),
    "eliminar_tipo_documento": ("eliminó el tipo de documento", "tipo_documento", "id_tipo"),
    "actualizar_metadatos_documento": ("modificó los datos del documento", "documento", "id_documento"),
    "asignar_estilo_documento": ("asignó un estilo de informe al documento", "documento", "id_documento"),
    "confirmar_edicion_documento": ("editó el texto del documento", "documento", "id_documento"),
    "revertir_documento": ("deshizo una edición del documento", "documento", "id_documento"),
    "archivar_documento": ("archivó el documento", "documento", "id_documento"),
    "eliminar_documento": ("eliminó el documento", "documento", "id_documento"),
    "desarchivar_documento": ("desarchivó el documento", "documento", "id_documento"),
    "cambiar_reservado_documento": ("cambió si es reservado el documento", "documento", "id_documento"),
    "crear_nota_endpoint": ("añadió una nota al documento", "documento", "id_documento"),
    "resolver_incidencia_endpoint": ("resolvió una incidencia del documento", "documento", "id_documento"),
    "actualizar_responsable_nota": ("cambió el responsable de una nota del documento", "documento", "id_documento"),
    "crear_relacion_nota": ("relacionó notas del documento", "documento", "id_documento"),
    "crear_grupo": ("creó el grupo", "grupo", None),
    "actualizar_grupo": ("modificó el grupo", "grupo", "id_grupo"),
    "eliminar_grupo": ("eliminó el grupo", "grupo", "id_grupo"),
    "asignar_documento_grupo": ("añadió un documento al grupo", "grupo", "id_grupo"),
    "quitar_documento_grupo": ("quitó de un grupo el documento", "documento", "id_documento"),
    "crear_entidad": ("creó la entidad", "entidad", None),
    "crear_conexion_erp": ("conectó con Multiplika SIF", None, None),
    "actualizar_conexion_erp": ("cambió la conexión con Multiplika SIF", None, None),
    "eliminar_conexion_erp": ("quitó la conexión con Multiplika SIF", None, None),
    "sincronizar_conexion_erp": ("sincronizó con Multiplika SIF", None, None),
    "crear_importacion_erp": ("subió un Excel del ERP para importar", None, None),
    "aplicar_importacion_erp": ("importó un Excel del ERP", None, None),
    "descartar_importacion_erp": ("descartó una importación del ERP", None, None),
    "crear_contacto_endpoint": ("añadió un contacto a la entidad", "entidad", "id_entidad"),
    "actualizar_contacto_endpoint": ("modificó el contacto", "contacto", "id_contacto"),
    "eliminar_contacto_endpoint": ("eliminó el contacto", "contacto", "id_contacto"),
    "guardar_etapas_endpoint": ("cambió las etapas del embudo de ventas", None, None),
    "crear_oportunidad_endpoint": ("creó la oportunidad", "oportunidad", None),
    "actualizar_oportunidad_endpoint": ("modificó la oportunidad", "oportunidad", "id_oportunidad"),
    "eliminar_oportunidad_endpoint": ("eliminó la oportunidad", "oportunidad", "id_oportunidad"),
    "relacionar_documento_oportunidad_endpoint": ("enlazó un documento con la oportunidad", "oportunidad", "id_oportunidad"),
    "quitar_documento_oportunidad_endpoint": ("quitó un documento de la oportunidad", "oportunidad", "id_oportunidad"),
    "actualizar_entidad": ("modificó la entidad", "entidad", "id_entidad"),
    "eliminar_entidad": ("eliminó la entidad", "entidad", "id_entidad"),
    "relacionar_documento_entidad": ("relacionó un documento con la entidad", "entidad", "id_entidad"),
    "quitar_relacion_documento_entidad": ("quitó una entidad del documento", "documento", "id_documento"),
    "crear_envios_endpoint": ("programó envíos del documento", "documento", "id_documento"),
    "cancelar_envio_endpoint": ("canceló el envío", "envio", "id_envio"),
    "reintentar_envio_endpoint": ("reintentó el envío", "envio", "id_envio"),
    "crear_compartido_endpoint": ("compartió por enlace el documento", "documento", "id_documento"),
    "anular_compartido_endpoint": ("anuló el enlace compartido", "compartido", "id_compartido"),
    "actualizar_configuracion_avisos": ("cambió la configuración de avisos de caducidad", None, None),
    "actualizar_modulo_contable": ("activó o desactivó el asesor contable", None, None),
    "anadir_acceso_sif": ("añadió un acceso suyo a la contabilidad del SIF", None, None),
    "actualizar_acceso_sif": ("actualizó las empresas de un acceso suyo al SIF", None, None),
    "revision_acceso_sif": ("cambió la revisión nocturna de un acceso suyo al SIF", None, None),
    "borrar_acceso_sif": ("quitó un acceso suyo a la contabilidad del SIF", None, None),
    "pausa_acceso_sif": ("pausó o reanudó un acceso suyo al SIF", None, None),
    "usuarios_acceso_sif": ("gestionó usuarios del SIF desde un acceso suyo", None, None),
    "resolver_propuesta_contable": ("resolvió una propuesta contable", None, "id_propuesta"),
    "crear_memoria": ("creó la memoria anual de una empresa en el SIF", None, None),
    "guardar_apartado_memoria": ("guardó un apartado de la memoria anual en el SIF", None, None),
    "accion_memoria": ("formuló o versionó la memoria anual en el SIF", None, None),
    "revisar_apartado_memoria": ("dio por revisado un apartado de la memoria anual", None, None),
    "actualizar_cuenta_email": ("cambió la cuenta de correo de envío", None, None),
    "crear_credencial": ("dio de alta la credencial", "credencial", None),
    "actualizar_credencial": ("modificó la credencial", "credencial", "id_credencial"),
    "eliminar_credencial": ("eliminó la credencial", "credencial", "id_credencial"),
    "rellenar_formulario_credencial": ("rellenó por enlace una credencial", None, None),
    "crear_certificado": ("subió el certificado", "certificado", None),
    "actualizar_certificado": ("modificó el certificado", "certificado", "id_certificado"),
    "eliminar_certificado": ("eliminó el certificado", "certificado", "id_certificado"),
    "enlazar_con_central": ("enlazó con una gestión documental central", "enlace", None),
    "cambiar_activo_enlace": ("activó o pausó el enlace", "enlace", "id_enlace"),
    "desenlazar": ("quitó el enlace", "enlace", "id_enlace"),
    "cambiar_estado_pregunta_pendiente": ("cambió el estado de la pregunta pendiente", "pregunta_pendiente", "id_pregunta"),
    "crear_estilo": ("creó el estilo de informe", "estilo", None),
    "actualizar_estilo": ("modificó el estilo de informe", "estilo", "id_estilo"),
    "eliminar_estilo": ("eliminó el estilo de informe", "estilo", "id_estilo"),
    "subir_imagen_estilo": ("subió una imagen al estilo de informe", "estilo", "id_estilo"),
    "eliminar_imagen_estilo": ("quitó una imagen del estilo de informe", "estilo", "id_estilo"),
    "emitir_api_key": ("emitió la API key", "api_key", None),
    "renombrar_api_key": ("renombró la API key", "api_key", "id_api_key"),
    "revocar_api_key": ("revocó la API key", "api_key", "id_api_key"),
    "eliminar_api_key": ("eliminó la API key", "api_key", "id_api_key"),
    "actualizar_script": ("modificó el script", "script", "id_script"),
    "archivar_script": ("archivó el script", "script", "id_script"),
    "desarchivar_script": ("desarchivó el script", "script", "id_script"),
    "relacionar_documento_script": ("relacionó un documento con el script", "script", "id_script"),
    "quitar_relacion_documento_script": ("quitó un script del documento", "documento", "id_documento"),
    "aspirar_aprendizaje": ("propuso un aprendizaje para la central", "aprendizaje", None),
    "dar_via_libre_aprendizaje": ("dio vía libre al aprendizaje", "aprendizaje", "id_aprendizaje"),
    "editar_aprendizaje": ("editó el aprendizaje", "aprendizaje", "id_aprendizaje"),
    "aprobar_aprendizaje": ("aprobó el aprendizaje", "aprendizaje", "id_aprendizaje"),
    "rechazar_aprendizaje": ("rechazó el aprendizaje", "aprendizaje", "id_aprendizaje"),
    "reabrir_aprendizaje": ("reabrió el aprendizaje", "aprendizaje", "id_aprendizaje"),
    "crear_regla": ("creó la regla", "regla", None),
    "actualizar_regla": ("modificó la regla", "regla", "id_regla"),
    "eliminar_regla": ("eliminó la regla", "regla", "id_regla"),
    "crear_modelo_registro": ("creó el modelo de registro", "modelo_registro", None),
    "corregir_modelo_registro": ("corrigió el modelo de registro", "modelo_registro", "id_modelo"),
    "nueva_version_modelo_registro": ("sacó una versión nueva del modelo de registro", "modelo_registro", "id_modelo"),
    "asignar_estilo_modelo_registro": ("cambió el estilo de informe del modelo de registro", "modelo_registro", "id_modelo"),
    "cambiar_activo_modelo_registro": ("cambió si está activo el modelo de registro", "modelo_registro", "id_modelo"),
    "crear_registro": ("apuntó un registro de datos", "registro", None),
    "corregir_registro": ("corrigió el registro de datos", "registro", "id_registro"),
    "subir_archivo_original_registro": ("adjuntó un archivo al registro de datos", "registro", "id_registro"),
    "vincular_documento_registro": ("vinculó un documento al registro de datos", "registro", "id_registro"),
    "desvincular_documento_registro": ("desvinculó de un registro de datos el documento", "documento", "id_documento"),
    "eliminar_registro": ("eliminó el registro de datos", "registro", "id_registro"),
    "crear_programacion_endpoint": ("programó el aviso", "programacion", None),
    "actualizar_programacion_endpoint": ("modificó el aviso programado", "programacion", "id_programacion"),
    "pausar_programacion_endpoint": ("pausó el aviso programado", "programacion", "id_programacion"),
    "reanudar_programacion_endpoint": ("reanudó el aviso programado", "programacion", "id_programacion"),
    "eliminar_programacion_endpoint": ("eliminó el aviso programado", "programacion", "id_programacion"),
    "marcar_hecho_endpoint": ("marcó como hecho un aviso", None, None),
    "crear_nota_bloc_endpoint": ("escribió la nota del bloc", "nota_bloc", None),
    "actualizar_nota_bloc_endpoint": ("modificó la nota del bloc", "nota_bloc", "id_nota"),
    "enlazar_nota_bloc_endpoint": ("enlazó la nota del bloc", "nota_bloc", "id_nota"),
    "desenlazar_nota_bloc_endpoint": ("quitó un enlace de la nota del bloc", "nota_bloc", "id_nota"),
    "cambiar_seguimiento_endpoint": ("cambió el estado de seguimiento", None, None),
    "eliminar_nota_bloc_endpoint": ("eliminó la nota del bloc", "nota_bloc", "id_nota"),
    "crear_activo_digital": ("dio de alta la web o cuenta", "activo_digital", None),
    "actualizar_activo_digital": ("modificó la web o cuenta", "activo_digital", "id_activo"),
    "actualizar_ajustes_activo": ("cambió los ajustes de la web o cuenta", "activo_digital", "id_activo"),
    "proponer_cambio_web": ("propuso el cambio", "cambio_externo", None),
    "aplicar_cambio_web": ("aplicó el cambio", "cambio_externo", "id_cambio"),
    "rechazar_cambio_web": ("rechazó el cambio", "cambio_externo", "id_cambio"),
    "deshacer_cambio_web": ("deshizo el cambio", "cambio_externo", "id_cambio"),
    "configurar_vigilancia_web": ("cambió la vigilancia de la web o cuenta", "activo_digital", "id_activo"),
    "aceptar_administradores_web": ("dio por buenos los administradores de la web", "activo_digital", "id_activo"),
    "hacer_copia_web": ("hizo una copia de seguridad de la web", "activo_digital", "id_activo"),
    "marcar_hallazgo_seo": ("cambió el estado de un problema SEO", None, None),
    "hallazgo_seo_a_tarea": ("convirtió en tarea un problema SEO", None, None),
    "guardar_informe_seo": ("guardó el informe SEO de la web", "activo_digital", "id_activo"),
    "guardar_consulta_bd": ("guardó una consulta de la base de datos", "activo_digital", "id_activo"),
    "borrar_consulta_bd": ("borró una consulta guardada de la base de datos", None, None),
    "crear_publicacion": ("preparó la publicación", "publicacion", None),
    "actualizar_publicacion": ("cambió la publicación", "publicacion", "id_publicacion"),
    "pedir_aprobacion_publicacion": ("pidió aprobar la publicación", "publicacion", "id_publicacion"),
    "aprobar_publicacion": ("aprobó la publicación", "publicacion", "id_publicacion"),
    "cancelar_publicacion": ("canceló la publicación", "publicacion", "id_publicacion"),
    "retirar_publicacion": ("retiró de las redes la publicación", "publicacion", "id_publicacion"),
    "anadir_preguntas_geo": ("añadió preguntas de GEO a la web", "activo_digital", "id_activo"),
    "cambiar_pregunta_geo": ("cambió una pregunta de GEO", None, None),
    "medir_geo": ("midió la presencia en las IAs de la web", "activo_digital", "id_activo"),
}

# Su cuerpo no se guarda nunca en el detalle, ni recortado: son secretos.
_SIN_DETALLE = {
    "crear_credencial", "actualizar_credencial", "rellenar_formulario_credencial",
    "crear_certificado", "actualizar_certificado", "actualizar_cuenta_email",
    "enlazar_con_central", "emitir_api_key",
    "crear_copia_bd", "restaurar_copia_bd", "actualizar_ajustes_copias_bd",  # llevan contraseña
}
_MAX_CUERPO = 64 * 1024
_METODOS_QUE_ESCRIBEN = {"POST", "PUT", "PATCH", "DELETE"}

_usuarios = AsyncCrudBase(TABLA_USUARIOS, get_db_config("control"))
_api_keys = AsyncCrudBase(TABLA_API_KEYS, get_db_config("control"))


def _json_o_none(cuerpo: bytes):
    try:
        return json.loads(cuerpo) if cuerpo else None
    except ValueError:
        return None


async def _quien(scope: dict, accion: str) -> dict:
    if accion == "rellenar_formulario_credencial":
        return {"quien": "Formulario de credencial (enlace)"}
    cabeceras = dict(scope["headers"])
    autorizacion = cabeceras.get(b"authorization", b"").decode()
    payload = decodificar_token(autorizacion.removeprefix("Bearer ").strip()) or {}
    if payload.get("tipo") == "superadmin":
        return {"quien": "Soporte Multiplika"}
    id_usuario = payload.get("id_usuario")
    usuario = await _usuarios.obtener(id_usuario) if id_usuario else None
    return {"id_usuario": id_usuario, "quien": usuario["nombre"] if usuario else f"Usuario n.º {id_usuario}"}


def _id_creado(respuesta, tipo: str | None) -> int | None:
    if not isinstance(respuesta, dict):
        return None
    for clave in (f"id_{tipo}", "id"):
        if isinstance(respuesta.get(clave), int):
            return respuesta[clave]
    return None


def _nombre_en(datos) -> str | None:
    if isinstance(datos, dict):
        for clave in ("nombre", "titulo", "nombre_tipo", "nombre_original"):
            if isinstance(datos.get(clave), str) and datos[clave].strip():
                return datos[clave].strip()
    return None


class ActividadPanelMiddleware:
    def __init__(self, app, rutas):
        self.app = app
        self.rutas = rutas

    def _ruta(self, scope):
        for ruta in self.rutas:
            coincide, hijo = ruta.matches(scope)
            if coincide == Match.FULL:
                # Starlette los deja como texto; FastAPI los convierte más tarde.
                parametros = {k: int(v) if isinstance(v, str) and v.isdigit() else v
                              for k, v in hijo.get("path_params", {}).items()}
                return getattr(ruta, "name", None), parametros
        return None, {}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in _METODOS_QUE_ESCRIBEN:
            return await self.app(scope, receive, send)
        accion, parametros = self._ruta(scope)
        if accion not in ACCIONES_PANEL:
            return await self.app(scope, receive, send)

        verbo, tipo, param_id = ACCIONES_PANEL[accion]
        id_objeto = parametros.get(param_id) if param_id else None
        if tipo == "api_key":
            # Las keys viven en la base de control, no en la del proyecto.
            fila = await _api_keys.obtener(id_objeto) if id_objeto else None
            id_proyecto = fila["id_proyecto"] if fila else parametros.get("id_proyecto")
            nombre_antes = fila["nombre"] if fila else None
        else:
            id_proyecto = parametros.get("id_proyecto")
            nombre_antes = None
        if id_proyecto is None:
            return await self.app(scope, receive, send)
        try:
            config = get_db_config(id_proyecto)
        except Exception:  # proyecto inexistente: el endpoint ya responderá 404
            return await self.app(scope, receive, send)
        # Antes de ejecutar: si la acción borra, después ya no habría nombre.
        nombre_antes = nombre_antes or await nombre_objeto(config, tipo, id_objeto)

        cuerpo_peticion, cuerpo_respuesta, estado = bytearray(), bytearray(), {}

        async def recibir():
            mensaje = await receive()
            if mensaje["type"] == "http.request" and len(cuerpo_peticion) < _MAX_CUERPO:
                cuerpo_peticion.extend(mensaje.get("body", b""))
            return mensaje

        async def enviar(mensaje):
            if mensaje["type"] == "http.response.start":
                estado["codigo"] = mensaje["status"]
            elif mensaje["type"] == "http.response.body" and len(cuerpo_respuesta) < _MAX_CUERPO:
                cuerpo_respuesta.extend(mensaje.get("body", b""))
            await send(mensaje)

        await self.app(scope, recibir, enviar)
        if estado.get("codigo", 500) >= 400:
            return

        es_json = dict(scope["headers"]).get(b"content-type", b"").startswith(b"application/json")
        peticion = _json_o_none(bytes(cuerpo_peticion)) if es_json else None
        respuesta = _json_o_none(bytes(cuerpo_respuesta))
        id_objeto = id_objeto or _id_creado(respuesta, tipo)
        nombre = await nombre_objeto(config, tipo, id_objeto) or nombre_antes
        if tipo not in TIPOS_PRIVADOS:  # de una nota privada no se dice ni el título
            nombre = nombre or _nombre_en(respuesta) or _nombre_en(peticion)
        detalle = {k: v for k, v in parametros.items() if k != "id_proyecto"}
        if accion not in _SIN_DETALLE and isinstance(peticion, dict):
            detalle.update(peticion)
        await registrar_sin_fallar(
            config, **await _quien(scope, accion), origen="panel", accion=accion,
            descripcion=componer_descripcion(verbo, nombre, id_objeto),
            tipo_objeto=tipo, id_objeto=id_objeto, nombre_objeto=nombre, detalle=detalle or None,
        )
