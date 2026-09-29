"""Registro de actividad desde el lado MCP — ver docs/gestion-documental.md
→ "Registro de actividad".

`ActividadMiddleware` apunta en gd_actividad cada llamada a una
herramienta de ACCIONES_MCP que termine bien. Va por lista explícita (y
no "toda herramienta sin readOnlyHint") porque hay herramientas que solo
leen sin estar marcadas (las de correo, p.ej.) y no queremos llenar el
registro de consultas. Una herramienta nueva que cambie datos debe
añadirse aquí.

Quién: el nombre de la API key. Si la llamada viene del chat del panel
(su key interna, ver panel_cliente/chat_ia.py), el chat manda además el
id del usuario en CABECERA_USUARIO_CHAT y se apunta a esa persona — la
cabecera solo se cree con esa key interna, que nunca se enseña a nadie.

El middleware se engancha a la instancia del proyecto al importar este
módulo (igual que los @mcp_app.tool), sin tocar el core."""

from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_http_headers
from fastmcp.server.middleware.middleware import Middleware
from mtpk_mariadb import AsyncCrudBase

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from apps.mcp_server.core.dependencias.auth import clave_actual_es_solo_lectura
from database.config_db import get_db_config
from database.control.dependencias._dep_usuarios import TABLA_USUARIOS

from ._anotaciones import SOLO_LECTURA
from ..database.modelos._mod_actividad import (
    CABECERA_USUARIO_CHAT,
    PREFIJO_KEY_CHAT_INTERNO,
    ActividadCRUD,
    componer_descripcion,
    nombre_objeto,
    registrar_sin_fallar,
)

# herramienta -> (verbo, tipo_objeto, argumento con su id, argumento con su nombre)
ACCIONES_MCP = {
    "guardar_documento_gd": ("guardó el documento", "documento", "id_documento_existente", "nombre"),
    "confirmar_documento_gd": ("confirmó el documento", "documento", "id_documento", None),
    "corregir_documento_gd": ("corrigió el documento", "documento", "id_documento", None),
    "actualizar_incumplimientos_gd": ("actualizó los incumplimientos del documento", "documento", "id_documento", None),
    "adjuntar_archivo_original_gd": ("adjuntó el archivo original del documento", "documento", "id_documento", None),
    "archivar_documento_gd": ("archivó el documento", "documento", "id_documento", None),
    "eliminar_documento_gd": ("eliminó el documento", "documento", "id_documento", None),
    "desarchivar_documento_gd": ("desarchivó el documento", "documento", "id_documento", None),
    "marcar_reservado_gd": ("cambió si es reservado el documento", "documento", "id_documento", None),
    "asignar_estilo_documento_gd": ("asignó un estilo de informe al documento", "documento", "id_documento", None),
    "activar_busqueda_semantica_gd": ("activó la búsqueda semántica", None, None, None),
    "crear_entidad_gd": ("creó la entidad", "entidad", None, "nombre"),
    "actualizar_entidad_gd": ("modificó la entidad", "entidad", "id_entidad", None),
    "eliminar_entidad_gd": ("eliminó la entidad", "entidad", "id_entidad", None),
    "relacionar_documento_entidad_gd": ("relacionó con una entidad el documento", "documento", "id_documento", None),
    "quitar_relacion_documento_entidad_gd": ("quitó una entidad del documento", "documento", "id_documento", None),
    "crear_grupo_gd": ("creó el grupo", "grupo", None, "nombre"),
    "eliminar_grupo_gd": ("eliminó el grupo", "grupo", "id_grupo", None),
    "asignar_documento_grupo_gd": ("añadió a un grupo el documento", "documento", "id_documento", None),
    "quitar_documento_grupo_gd": ("quitó de un grupo el documento", "documento", "id_documento", None),
    "crear_nota_documento_gd": ("añadió una nota al documento", "documento", "id_documento", None),
    "resolver_incidencia_gd": ("resolvió la incidencia", "nota", "id_incidencia", None),
    "asignar_responsable_nota_gd": ("asignó responsable a la nota", "nota", "id_nota", None),
    "relacionar_notas_gd": ("relacionó dos notas", "nota", "id_origen", None),
    "crear_envios_gd": ("programó envíos del documento", "documento", "id_documento", None),
    "enviar_envio_gd": ("mandó el envío", "envio", "id_envio", None),
    "cancelar_envio_gd": ("canceló el envío", "envio", "id_envio", None),
    "reintentar_envio_gd": ("reintentó el envío", "envio", "id_envio", None),
    "compartir_documento_gd": ("compartió por enlace el documento", "documento", "id_documento", None),
    "anular_compartido_gd": ("anuló el enlace compartido", "compartido", "id_compartido", None),
    "crear_estilo_informe_gd": ("creó el estilo de informe", "estilo", None, "nombre_tipo"),
    "actualizar_estilo_informe_gd": ("modificó el estilo de informe", "estilo", None, "nombre_tipo"),
    "subir_imagen_estilo_gd": ("subió una imagen al estilo de informe", "estilo", None, "nombre_tipo"),
    "crear_regla_gd": ("creó la regla", "regla", None, "nombre"),
    "actualizar_regla_gd": ("modificó la regla", "regla", "id_regla", None),
    "eliminar_regla_gd": ("eliminó la regla", "regla", "id_regla", None),
    "crear_script_gd": ("guardó el script", "script", None, "titulo"),
    "actualizar_script_gd": ("modificó el script", "script", "id_script", None),
    "archivar_script_gd": ("archivó el script", "script", "id_script", None),
    "desarchivar_script_gd": ("desarchivó el script", "script", "id_script", None),
    "relacionar_documento_script_gd": ("relacionó un script con el documento", "documento", "id_documento", None),
    "quitar_relacion_documento_script_gd": ("quitó un script del documento", "documento", "id_documento", None),
    "crear_modelo_registro_gd": ("creó el modelo de registro", "modelo_registro", None, "titulo"),
    "corregir_modelo_registro_gd": ("corrigió el modelo de registro", "modelo_registro", "id_modelo", None),
    "nueva_version_modelo_registro_gd": ("sacó una versión nueva del modelo de registro", "modelo_registro", "id_modelo", None),
    "retirar_modelo_registro_gd": ("cambió si está activo el modelo de registro", "modelo_registro", "id_modelo", None),
    "crear_registro_gd": ("apuntó un registro de datos", "registro", None, None),
    "corregir_registro_gd": ("corrigió el registro de datos", "registro", "id_registro", None),
    "eliminar_registro_gd": ("eliminó el registro de datos", "registro", "id_registro", None),
    "vincular_documento_registro_gd": ("vinculó a un registro de datos el documento", "documento", "id_documento", None),
    "desvincular_documento_registro_gd": ("desvinculó de un registro de datos el documento", "documento", "id_documento", None),
    "crear_credencial_gd": ("dio de alta la credencial", "credencial", None, "nombre"),
    "guardar_adjunto_correo_gd": ("guardó como pendiente el adjunto de correo", "documento_pendiente", None, "nombre_adjunto"),
    "marcar_correo_leido_gd": ("cambió el estado de leído de correos", None, None, None),
    "mover_correo_gd": ("movió correos de carpeta", None, None, None),
    "registrar_enlace_gd": ("enlazó con una gestión documental central", "enlace", None, None),
    "eliminar_enlace_gd": ("quitó el enlace con la gestión documental central", "enlace", None, None),
    "anotar_pregunta_pendiente_gd": ("anotó una pregunta pendiente", "pregunta_pendiente", None, "pregunta"),
    "anotar_pregunta_pendiente_enlazada_gd": ("anotó una pregunta pendiente a la central", None, None, "pregunta"),
    "resolver_pregunta_pendiente_gd": ("resolvió la pregunta pendiente", "pregunta_pendiente", "id_pregunta", None),
    "actualizar_contexto_proyecto": ("actualizó el contexto de negocio", None, None, None),
    "actualizar_preferencias_proyecto": ("actualizó las preferencias de la IA", None, None, None),
}

_usuarios = AsyncCrudBase(TABLA_USUARIOS, get_db_config("control"))


def _id_de_resultado(resultado, tipo: str | None) -> int | None:
    """Id del elemento recién creado, si la herramienta lo devuelve."""
    datos = getattr(resultado, "structured_content", None)
    if isinstance(datos, dict) and set(datos) == {"result"}:
        datos = datos["result"]
    if not isinstance(datos, dict):
        return None
    for clave in (f"id_{tipo}", "id"):
        if isinstance(datos.get(clave), int):
            return datos[clave]
    return None


async def _quien(proyecto: dict) -> dict:
    nombre_key = proyecto.get("nombre_api_key") or f"API key n.º {proyecto.get('id_api_key')}"
    id_usuario = get_http_headers().get(CABECERA_USUARIO_CHAT, "")
    if nombre_key.startswith(PREFIJO_KEY_CHAT_INTERNO) and id_usuario.isdigit():
        usuario = await _usuarios.obtener(int(id_usuario))
        return {
            "origen": "chat", "id_usuario": int(id_usuario),
            "quien": usuario["nombre"] if usuario else f"Usuario n.º {id_usuario}",
        }
    return {"origen": "ia", "id_api_key": proyecto.get("id_api_key"), "quien": nombre_key}


class ActividadMiddleware(Middleware):
    async def on_call_tool(self, context, call_next):
        accion = context.message.name
        if accion not in ACCIONES_MCP:
            return await call_next(context)

        verbo, tipo, arg_id, arg_nombre = ACCIONES_MCP[accion]
        argumentos = context.message.arguments or {}
        proyecto = await resolver_proyecto_actual()
        config = get_db_config(proyecto["id"])
        id_objeto = argumentos.get(arg_id) if arg_id else None
        # Antes de ejecutar: si la acción borra, después ya no habría nombre.
        nombre_antes = await nombre_objeto(config, tipo, id_objeto)

        resultado = await call_next(context)
        if getattr(resultado, "is_error", False):
            return resultado

        id_objeto = id_objeto or _id_de_resultado(resultado, tipo)
        nombre = (
            await nombre_objeto(config, tipo, id_objeto) or nombre_antes
            or (arg_nombre and argumentos.get(arg_nombre)) or None
        )
        await registrar_sin_fallar(
            config, **await _quien(proyecto), accion=accion,
            descripcion=componer_descripcion(verbo, nombre, id_objeto),
            tipo_objeto=tipo, id_objeto=id_objeto, nombre_objeto=nombre, detalle=argumentos,
        )
        return resultado


mcp_app.add_middleware(ActividadMiddleware())


@mcp_app.tool(annotations=SOLO_LECTURA)
async def consultar_actividad_gd(
    quien: str | None = None,
    tipo_objeto: str | None = None,
    id_objeto: int | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    texto: str | None = None,
    limite: int = 30,
) -> dict:
    """Registro de actividad: quién cambió qué y cuándo en esta gestión
    documental (guardar, corregir, archivar, borrar, enviar, crear reglas o
    scripts...), tanto desde la IA como desde el panel. Las consultas no
    se apuntan. Úsala cuando pregunten "¿quién archivó/cambió/borró X?",
    "¿qué se hizo ayer?" o "¿qué ha hecho Ana esta semana?".

    Filtros, todos opcionales y combinables:
    - `quien`: nombre exacto de la persona o de la API key.
    - `tipo_objeto` + `id_objeto`: historial de un elemento concreto,
      p.ej. tipo_objeto="documento", id_objeto=12. Tipos: documento,
      documento_pendiente, entidad, grupo, script, regla, modelo_registro,
      registro, estilo, credencial, tipo_documento, envio, compartido, nota, enlace,
      pregunta_pendiente.
    - `desde` / `hasta`: fechas AAAA-MM-DD (hasta incluye el día entero).
    - `texto`: busca en la frase y en el nombre del elemento.
    - `limite`: máximo 100; vienen los más recientes primero.

    No lo deduzcas de las fechas de los documentos: usa esta tool.
    Responde con quién, cuándo y desde dónde. Si quien aparece es el
    nombre de una API key, dilo así ("se hizo con la clave «X»"), sin
    inventar qué persona fue. Si no sale nada, dilo tal cual: puede ser
    anterior al registro, tener más de un año o ser una consulta.

    Solo se guarda un año: lo más antiguo se borra solo. Si la API key
    la comparten varias personas, `quien` no las distingue. No
    disponible para claves de invitado."""
    if clave_actual_es_solo_lectura():
        raise ToolError("El registro de actividad no está disponible para claves de invitado.")
    proyecto = await resolver_proyecto_actual()
    filas, total = await ActividadCRUD(get_db_config(proyecto["id"])).buscar(
        quien=quien, tipo_objeto=tipo_objeto, id_objeto=id_objeto,
        desde=desde, hasta=hasta, q=texto, limite=max(1, min(limite, 100)),
    )
    return {
        "total": total,
        "apuntes": [
            {
                "fecha": str(f["fecha"]), "quien": f["quien"], "origen": f["origen"],
                "descripcion": f["descripcion"], "tipo_objeto": f["tipo_objeto"],
                "id_objeto": f["id_objeto"], "detalle": f["detalle"],
            }
            for f in filas
        ],
    }
