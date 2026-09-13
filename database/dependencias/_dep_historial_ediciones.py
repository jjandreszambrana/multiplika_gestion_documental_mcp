from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_HISTORIAL_EDICIONES = "gd_historial_ediciones"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_HISTORIAL_EDICIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del registro de historial"),
    Columna(nombre="id_version", tipo="INT", not_null=True,
            comentario="Versión del documento editada (→ gd_versiones.id)"),
    Columna(nombre="id_usuario", tipo="INT", not_null=True,
            comentario="Usuario que confirmó el cambio (→ mcpc_usuarios.id del repo core — sin "
                       "FK real porque vive en otra base de datos/motor)"),
    Columna(nombre="markdown_anterior", tipo="MEDIUMTEXT", not_null=True,
            comentario="Cómo estaba markdown_actual justo antes de esta confirmación — el "
                       "estado siguiente (el que dejó vigente esta edición) es el "
                       "markdown_anterior del próximo registro, o markdown_actual si este es "
                       "el más reciente"),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True, comentario="Cuándo se confirmó el cambio"),
]

INDICES_HISTORIAL_EDICIONES = [
    Index(columnas=["id_version", "fecha"]),
]

FKS_HISTORIAL_EDICIONES = [
    ForeignKey(columna="id_version", referencia_tabla=NOMBRE_TABLA_VERSIONES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_HISTORIAL_EDICIONES = Tabla(
    nombre=NOMBRE_TABLA_HISTORIAL_EDICIONES, columnas=CAMPOS_HISTORIAL_EDICIONES,
    indices=INDICES_HISTORIAL_EDICIONES, foreign_keys=FKS_HISTORIAL_EDICIONES,
    comentario="Historial de ediciones confirmadas desde el panel cliente — quién y cuándo, y "
               "el texto de antes de cada cambio para poder ver el diff o revertir",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_HISTORIAL_EDICIONES]
