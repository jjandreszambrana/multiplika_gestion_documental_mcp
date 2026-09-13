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
    Columna(nombre="borrador", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True mientras el documento está incompleto/sin confirmar por el cliente: "
                       "cada guardar_documento_gd sobre esta misma versión la sobrescribe en vez "
                       "de crear una versión nueva (única excepción a 'markdown_original nunca se "
                       "sobrescribe', ver docs/gestion-documental.md → 'Borrador'). Pasa a False "
                       "con confirmar_documento_gd, o directamente al guardar con borrador=false"),
    Columna(nombre="markdown_original", tipo="MEDIUMTEXT", not_null=True,
            comentario="Markdown tal como lo generó la IA la primera vez, nunca se sobrescribe "
                       "salvo mientras la versión es un borrador (ver columna 'borrador')"),
    Columna(nombre="markdown_actual", tipo="MEDIUMTEXT", not_null=True,
            comentario="Markdown vigente: igual al original o corregido a mano"),
    Columna(nombre="tmp", tipo="MEDIUMTEXT",
            comentario="Borrador de edición desde el panel cliente, ver "
                       "docs/gestion-documental.md → 'Edición desde el panel'. Se sobrescribe en "
                       "cada guardado intermedio sin tocar markdown_actual ni el historial; al "
                       "confirmar, este valor pasa a markdown_actual y vuelve a NULL. Si sigue con "
                       "contenido al reabrir el editor, es que quedó sin confirmar la vez anterior"),
    Columna(nombre="tmp_id_usuario", tipo="INT",
            comentario="Quién dejó el borrador en 'tmp' — para avisar de quién es al reabrir. "
                       "NULL si 'tmp' está vacío"),
    Columna(nombre="tmp_fecha", tipo="TIMESTAMP",
            comentario="Cuándo se escribió por última vez 'tmp'. NULL si 'tmp' está vacío"),
    Columna(nombre="revisado_manualmente", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True si markdown_actual fue corregido a mano tras la generación"),
    Columna(nombre="incumplimientos", tipo="MEDIUMTEXT",
            comentario="Qué no cumple este documento del formato_requerido/normativa_aplicable "
                       "de su tipo (ver gd_tipos_documento), redactado por la IA al guardarlo. "
                       "NULL si cumple o su tipo no tiene requisitos definidos. Se actualiza con "
                       "actualizar_incumplimientos_gd — al resolverse, vuelve a NULL"),
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
    Columna(nombre="url_origen", tipo="VARCHAR(1000)",
            comentario="Opcional — URL pública de donde se descargó/leyó esta versión (p.ej. "
                       "una normativa publicada en el BOE). Solo referencia para poder volver "
                       "a consultar la fuente; el markdown guardado sigue siendo lo que manda, "
                       "no se depende de que la URL siga viva"),
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
