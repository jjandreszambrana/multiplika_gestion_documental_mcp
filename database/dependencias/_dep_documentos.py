from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_DOCUMENTOS = "gd_documentos"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_DOCUMENTOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del documento"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre/referencia corta para identificar el documento"),
    Columna(nombre="tipo_documento", tipo="VARCHAR", longitud=50, not_null=True,
            comentario="Tipo de documento, elegido por el usuario al guardarlo — texto libre, "
                       "no una lista cerrada (ver gd_tipos_documento: catálogo de sugerencias, "
                       "no una restricción)"),
    Columna(nombre="todas_versiones_buscables", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Si es False (por defecto), solo la versión vigente entra en las búsquedas"),
    Columna(nombre="archivado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True si el documento ya no aplica (anulado, subido por error...): sigue "
                       "guardado pero desaparece de las búsquedas hasta desarchivarlo"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True,
            comentario="Fecha de alta del documento en el sistema"),
]

INDICES_DOCUMENTOS = [
    Index(columnas=["nombre"]),
]

TABLA_DOCUMENTOS = Tabla(
    nombre=NOMBRE_TABLA_DOCUMENTOS, columnas=CAMPOS_DOCUMENTOS, indices=INDICES_DOCUMENTOS,
    comentario="Documentos del cliente (cada uno con 1+ versiones en gd_versiones)", db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_DOCUMENTOS]
