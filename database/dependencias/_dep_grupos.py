"""Grupos de documentos — ver docs/gestion-documental.md → "Grupos de
documentos". Un grupo agrupa documentos para un fin concreto (p.ej. "una
auditoría", "un expediente"); no todos los documentos tienen por qué estar
en ninguno, y uno mismo puede estar en varios a la vez — de ahí la tabla
de relación aparte (gd_documentos_grupos), en vez de un id_grupo en
gd_documentos."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS

NOMBRE_TABLA_GRUPOS = "gd_grupos"
NOMBRE_TABLA_DOCUMENTOS_GRUPOS = "gd_documentos_grupos"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_GRUPOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del grupo"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Nombre corto del grupo"),
    Columna(nombre="proposito", tipo="MEDIUMTEXT", not_null=True,
            comentario='Para qué sirve este grupo, en texto libre (p.ej. "Documentación de la '
                       'auditoría 2026")'),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_GRUPOS = [
    Index(columnas=["nombre"], unico=True),
]

TABLA_GRUPOS = Tabla(
    nombre=NOMBRE_TABLA_GRUPOS, columnas=CAMPOS_GRUPOS, indices=INDICES_GRUPOS,
    comentario="Grupos de documentos para un fin concreto — un documento puede estar en varios, o "
               "en ninguno",
    db_name=__DB_NAME__,
)


CAMPOS_DOCUMENTOS_GRUPOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la asignación"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento asignado (→ gd_documentos.id)"),
    Columna(nombre="id_grupo", tipo="INT", not_null=True,
            comentario="Grupo al que se asigna (→ gd_grupos.id)"),
    Columna(nombre="fecha_asignacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_DOCUMENTOS_GRUPOS = [
    Index(columnas=["id_documento", "id_grupo"], unico=True),
    Index(columnas=["id_grupo"]),
]

FKS_DOCUMENTOS_GRUPOS = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_grupo", referencia_tabla=NOMBRE_TABLA_GRUPOS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_DOCUMENTOS_GRUPOS = Tabla(
    nombre=NOMBRE_TABLA_DOCUMENTOS_GRUPOS, columnas=CAMPOS_DOCUMENTOS_GRUPOS,
    indices=INDICES_DOCUMENTOS_GRUPOS, foreign_keys=FKS_DOCUMENTOS_GRUPOS,
    comentario="Relación muchos-a-muchos entre documentos y grupos",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_GRUPOS, TABLA_DOCUMENTOS_GRUPOS]
