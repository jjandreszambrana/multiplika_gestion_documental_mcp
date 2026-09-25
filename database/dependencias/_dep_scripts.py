"""Scripts reutilizables — ver docs/gestion-documental.md → "Scripts
reutilizables". La IA construye muchos scripts para tareas puntuales
(un backup, un informe ad-hoc, una migración de datos...); esta tabla
los guarda para poder reaprovecharlos en vez de escribirlos de cero
cada vez. Nada que ver con scripts/ del repo (esos son de
mantenimiento de la plataforma, no del cliente)."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS

NOMBRE_TABLA_SCRIPTS = "gd_scripts"
NOMBRE_TABLA_DOCUMENTOS_SCRIPTS = "gd_documentos_scripts"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_SCRIPTS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del script"),
    Columna(nombre="titulo", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre corto para encontrarlo rápido"),
    Columna(nombre="descripcion", tipo="MEDIUMTEXT", not_null=True,
            comentario="Qué hace y cuándo usarlo — lo primero que se lee al buscar si ya existe "
                       "uno para reaprovechar, antes de escribir uno nuevo"),
    Columna(nombre="lenguaje", tipo="VARCHAR", longitud=50, not_null=True,
            comentario='"python", "bash", "sql"... — texto libre, catálogo abierto igual que '
                       "gd_entidades.tipo, no una lista cerrada"),
    Columna(nombre="codigo", tipo="MEDIUMTEXT", not_null=True,
            comentario="El script completo"),
    Columna(nombre="etiquetas", tipo="VARCHAR", longitud=500,
            comentario='Palabras clave sueltas para buscar por tema (p.ej. "backup, postgres, '
                       'envio") — texto libre, opcional'),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Quién o qué lo generó (nombre de la IA/asistente, o de la persona si lo "
                       "sube a mano) — texto libre, igual que gd_registros.creado_por"),
    Columna(nombre="veces_usado", tipo="INT", not_null=True, default=0,
            comentario="Cuántas veces se ha reaprovechado — sirve para ver cuáles compensan tener "
                       "guardados. Se incrementa con marcar_uso_script_gd, no a mano"),
    Columna(nombre="fecha_ultimo_uso", tipo="TIMESTAMP",
            comentario="Última vez que se reaprovechó — NULL si nunca se ha vuelto a usar desde "
                       "que se creó"),
    Columna(nombre="archivado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Igual que gd_documentos.archivado — para retirar un script obsoleto sin "
                       "borrarlo (por si algo del histórico todavía lo referencia)"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_SCRIPTS = [
    Index(columnas=["titulo"]),
    Index(columnas=["lenguaje"]),
]

TABLA_SCRIPTS = Tabla(
    nombre=NOMBRE_TABLA_SCRIPTS, columnas=CAMPOS_SCRIPTS, indices=INDICES_SCRIPTS,
    comentario="Scripts generados por la IA que se pueden reaprovechar en vez de reescribirlos",
    db_name=__DB_NAME__,
)


# Relación muchos-a-muchos con documentos (un script puede haberse usado en
# varios documentos, y un documento puede tener varios scripts asociados)
# — mismo patrón que gd_documentos_entidades.
CAMPOS_DOCUMENTOS_SCRIPTS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la relación"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento relacionado (→ gd_documentos.id)"),
    Columna(nombre="id_script", tipo="INT", not_null=True,
            comentario="Script relacionado (→ gd_scripts.id)"),
    Columna(nombre="fecha_asignacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_DOCUMENTOS_SCRIPTS = [
    Index(columnas=["id_documento", "id_script"], unico=True),
    Index(columnas=["id_script"]),
]

FKS_DOCUMENTOS_SCRIPTS = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_script", referencia_tabla=NOMBRE_TABLA_SCRIPTS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_DOCUMENTOS_SCRIPTS = Tabla(
    nombre=NOMBRE_TABLA_DOCUMENTOS_SCRIPTS, columnas=CAMPOS_DOCUMENTOS_SCRIPTS,
    indices=INDICES_DOCUMENTOS_SCRIPTS, foreign_keys=FKS_DOCUMENTOS_SCRIPTS,
    comentario="Relación muchos-a-muchos entre documentos y scripts",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_SCRIPTS, TABLA_DOCUMENTOS_SCRIPTS]
