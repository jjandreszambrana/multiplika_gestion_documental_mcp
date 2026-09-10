"""Cola de documentos que llegaron sin nadie delante (subida masiva por
panel o ingesta por email) — ver docs/gestion-documental.md → "Documentos
pendientes"."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_DOCUMENTOS_PENDIENTES = "gd_documentos_pendientes"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_DOCUMENTOS_PENDIENTES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del documento pendiente"),
    Columna(nombre="archivo", tipo="BLOB", not_null=True,
            comentario="Contenido binario del fichero tal cual llegó (BYTEA en Postgres)"),
    Columna(nombre="tipo_mime", tipo="VARCHAR", longitud=50, not_null=True,
            comentario='p.ej. "application/pdf"'),
    Columna(nombre="nombre_original", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre de fichero (subida por panel) o asunto del correo (ingesta por email)"),
    Columna(nombre="origen", tipo="ENUM", enum_opciones=["panel", "email"], not_null=True,
            comentario="De dónde llegó este documento pendiente"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP")),
]

INDICES_DOCUMENTOS_PENDIENTES = [
    Index(columnas=["fecha_alta"]),
]

TABLA_DOCUMENTOS_PENDIENTES = Tabla(
    nombre=NOMBRE_TABLA_DOCUMENTOS_PENDIENTES, columnas=CAMPOS_DOCUMENTOS_PENDIENTES,
    indices=INDICES_DOCUMENTOS_PENDIENTES,
    comentario="Documentos llegados sin nadie delante (subida masiva o email), a la espera de que "
               "el cliente hable con su IA para procesarlos con las preguntas de siempre",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_DOCUMENTOS_PENDIENTES]
