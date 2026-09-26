from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_CHAT_CONVERSACIONES = "gd_chat_conversaciones"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_CHAT_CONVERSACIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la conversación"),
    Columna(nombre="id_usuario", tipo="INT", not_null=True,
            comentario="Usuario dueño de esta conversación (→ mcpc_usuarios.id del repo core — "
                       "sin FK real porque vive en otra base de datos/motor). Un usuario puede "
                       "tener varias conversaciones — ya no una sola que se amplía para siempre"),
    Columna(nombre="titulo", tipo="VARCHAR", longitud=200,
            comentario="Título de la conversación, puesto a mano por el cliente o, si no, "
                       "derivado del primer mensaje al guardar la primera respuesta. NULL en "
                       "conversaciones sin ningún turno todavía, o en las de antes de que "
                       "existiera esta columna (se les calcula un título de muestra al listar)"),
    Columna(nombre="mensajes_json", tipo="MEDIUMTEXT", not_null=True,
            comentario="Array de mensajes en el formato de la Messages API de Anthropic "
                       "(user/assistant, con bloques de tool_use/tool_result incluidos), "
                       "serializado — se reenvía tal cual en cada turno nuevo"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True,
            comentario="Cuándo se creó esta conversación"),
    Columna(nombre="fecha_actualizacion", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), comentario="Último turno de esta conversación"),
]

INDICES_CHAT_CONVERSACIONES = [
    Index(columnas=["id_usuario"]),
]

TABLA_CHAT_CONVERSACIONES = Tabla(
    nombre=NOMBRE_TABLA_CHAT_CONVERSACIONES, columnas=CAMPOS_CHAT_CONVERSACIONES,
    indices=INDICES_CHAT_CONVERSACIONES,
    comentario="Historial de conversaciones del chat de IA de gestión documental, varias por usuario",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CHAT_CONVERSACIONES]
