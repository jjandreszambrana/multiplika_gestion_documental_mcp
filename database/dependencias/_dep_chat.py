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
                       "sin FK real porque vive en otra base de datos/motor). Una conversación "
                       "por usuario: se sigue ampliando, no hay 'chat nuevo' en la v1"),
    Columna(nombre="mensajes_json", tipo="MEDIUMTEXT", not_null=True,
            comentario="Array de mensajes en el formato de la Messages API de Anthropic "
                       "(user/assistant, con bloques de tool_use/tool_result incluidos), "
                       "serializado — se reenvía tal cual en cada turno nuevo"),
    Columna(nombre="fecha_actualizacion", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), comentario="Último turno de esta conversación"),
]

INDICES_CHAT_CONVERSACIONES = [
    Index(columnas=["id_usuario"], unico=True),
]

TABLA_CHAT_CONVERSACIONES = Tabla(
    nombre=NOMBRE_TABLA_CHAT_CONVERSACIONES, columnas=CAMPOS_CHAT_CONVERSACIONES,
    indices=INDICES_CHAT_CONVERSACIONES,
    comentario="Historial del chat de IA de gestión documental, por usuario",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CHAT_CONVERSACIONES]
