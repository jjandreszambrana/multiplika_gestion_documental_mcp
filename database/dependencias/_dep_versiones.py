from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS

NOMBRE_TABLA_VERSIONES = "gd_versiones"
__DB_NAME__ = get_db_name("gestion_documental")

# Sigla como "S.L.", "S.A.U." o "C.I.F.": Postgres las tokeniza tal cual,
# con los puntos, así que una búsqueda con "SL" (sin puntos, la forma
# más habitual de escribirlo) no encontraba nada — buscar_fulltext()
# aplica el mismo patrón a la pregunta para que ambas formas casen (ver
# docs/gestion-documental.md → "Búsqueda"). Solo quita el punto cuando
# le sigue otra letra-punto pegada (sin espacio) — no toca abreviaturas
# sueltas como "p.ej." ni el punto final de una frase normal.
PATRON_SIGLAS = r"\.(?=[A-Za-z]\.)"

CAMPOS_VERSIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la versión"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento al que pertenece esta versión"),
    Columna(nombre="vigente", tipo="BOOLEAN", not_null=True, default=True,
            comentario="True solo en la última versión de cada documento"),
    Columna(nombre="markdown_original", tipo="MEDIUMTEXT", not_null=True,
            comentario="Markdown tal como lo generó la IA la primera vez, nunca se sobrescribe"),
    Columna(nombre="markdown_actual", tipo="MEDIUMTEXT", not_null=True,
            comentario="Markdown vigente: igual al original o corregido a mano"),
    Columna(nombre="revisado_manualmente", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True si markdown_actual fue corregido a mano tras la generación"),
    Columna(nombre="tsvector_actual", tipo="TSVECTOR",
            generado=f"to_tsvector('spanish_unaccent', regexp_replace(markdown_actual, "
                     f"'{PATRON_SIGLAS}', '', 'g'))",
            comentario="Índice fulltext generado a partir de markdown_actual. Usa la "
                       "configuración 'spanish_unaccent' (creada al aprovisionar la base, "
                       "ver scripts/aprovisionar_proyecto.py del repo core) para que una "
                       "búsqueda sin tildes encuentre texto con tildes y viceversa. Antes de "
                       "tokenizar, quita los puntos internos de siglas (ver PATRON_SIGLAS) "
                       "para que 'SL' y 'S.L.' indexen igual"),
    Columna(nombre="fecha_documento", tipo="DATE", not_null=True,
            comentario="Fecha del propio documento (no la de subida)"),
    Columna(nombre="fecha_subida", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True,
            comentario="Fecha en que se subió/generó esta versión"),
    Columna(nombre="fecha_caducidad", tipo="DATE",
            comentario="Opcional — de esta versión concreta, no del documento: un contrato "
                       "renovado es, en la práctica, otra fecha (ver gd_versiones, no "
                       "gd_documentos). NULL si no aplica"),
    Columna(nombre="aviso_caducidad_enviado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Un solo aviso por email al entrar en la ventana de aviso, no uno "
                       "diario (decisión de producto, 2026-09-10) — este flag evita repetirlo"),
]

INDICES_VERSIONES = [
    Index(columnas=["id_documento", "vigente"]),
    Index(columnas=["tsvector_actual"], metodo="gin"),
    Index(columnas=["fecha_caducidad"]),
]

FKS_VERSIONES = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_VERSIONES = Tabla(
    nombre=NOMBRE_TABLA_VERSIONES, columnas=CAMPOS_VERSIONES, indices=INDICES_VERSIONES,
    foreign_keys=FKS_VERSIONES,
    comentario="Historial completo de versiones de cada documento, sin purga", db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_VERSIONES]
