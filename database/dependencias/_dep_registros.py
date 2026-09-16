"""Comentarios, anotaciones, observaciones, incidencias y resoluciones
sobre un documento — ver docs/gestion-documental.md → "Registros de
seguimiento". Un registro cuelga siempre de gd_documentos (nunca de una
versión concreta): así sigue disponible entero cuando el documento tiene
una versión nueva, sin copiarlo ni migrarlo. id_version_origen es solo
informativo (en qué versión se creó), nunca restringe en qué versiones
se ve."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_REGISTROS = "gd_registros"
NOMBRE_TABLA_REGISTROS_RELACIONES = "gd_registros_relaciones"
__DB_NAME__ = get_db_name("gestion_documental")

# "resolucion" solo se crea desde resolver_incidencia() (ver
# _mod_registros.py) — nunca directamente, para que una incidencia
# resuelta siempre tenga su relación "resuelve" y su estado en el mismo
# paso. Las otras cuatro se crean libremente sobre cualquier documento.
TIPOS_REGISTRO_CREABLES = ["comentario", "anotacion", "observacion", "incidencia"]
TIPOS_REGISTRO = TIPOS_REGISTRO_CREABLES + ["resolucion"]

ESTADOS_INCIDENCIA = ["abierta", "resuelta"]

CAMPOS_REGISTROS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del registro"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento al que pertenece (→ gd_documentos.id) — no una versión concreta, "
                       "a propósito: así el registro sigue apareciendo con cualquier versión nueva"),
    Columna(nombre="id_version_origen", tipo="INT",
            comentario="En qué versión estaba el documento cuando se creó este registro (→ "
                       "gd_versiones.id) — solo informativo, NULL si no se sabe; no limita en qué "
                       "versiones se ve, eso lo decide siempre id_documento"),
    Columna(nombre="tipo", tipo="VARCHAR", longitud=20, not_null=True, enum_opciones=TIPOS_REGISTRO,
            comentario="comentario / anotacion / observacion / incidencia / resolucion"),
    Columna(nombre="texto", tipo="MEDIUMTEXT", not_null=True,
            comentario="Contenido del registro"),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre de quien abrió el registro — texto libre (el usuario real del panel "
                       "cuando se crea desde ahí, o lo que diga el cliente por chat si se crea vía "
                       "MCP: no hay una identidad de persona fiable en una llamada de herramienta, "
                       "solo la del proyecto)"),
    Columna(nombre="responsable", tipo="VARCHAR", longitud=255,
            comentario="A quién se le asigna — texto libre en cualquier tipo de registro, no solo "
                       "incidencias (decisión de producto: no hace falta que sea un usuario real del "
                       "sistema), NULL si no se ha asignado"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, enum_opciones=ESTADOS_INCIDENCIA,
            comentario="Solo tiene sentido para tipo='incidencia' (abierta/resuelta); NULL en el "
                       "resto de tipos"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True, comentario="Cuándo se abrió el registro"),
]

INDICES_REGISTROS = [
    Index(columnas=["id_documento", "tipo"]),
]

FKS_REGISTROS = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_version_origen", referencia_tabla=NOMBRE_TABLA_VERSIONES,
               referencia_columna="id", on_delete="SET NULL"),
]

TABLA_REGISTROS = Tabla(
    nombre=NOMBRE_TABLA_REGISTROS, columnas=CAMPOS_REGISTROS,
    indices=INDICES_REGISTROS, foreign_keys=FKS_REGISTROS,
    comentario="Comentarios, anotaciones, observaciones, incidencias y resoluciones sobre un "
               "documento — cuelgan del documento, no de una versión concreta",
    db_name=__DB_NAME__,
)


# Relaciones libres entre registros (p.ej. una resolución "resuelve" su
# incidencia, un comentario "relacionado" con una incidencia...) — tabla
# aparte en vez de una columna id_registro_padre en gd_registros porque un
# mismo registro puede relacionarse con más de uno, y en ambos sentidos.
CAMPOS_REGISTROS_RELACIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la relación"),
    Columna(nombre="id_registro_origen", tipo="INT", not_null=True,
            comentario="Registro que enlaza (→ gd_registros.id)"),
    Columna(nombre="id_registro_destino", tipo="INT", not_null=True,
            comentario="Registro enlazado (→ gd_registros.id)"),
    Columna(nombre="tipo_relacion", tipo="VARCHAR", longitud=50,
            comentario='Etiqueta libre (p.ej. "resuelve", "relacionado", "duplica") — NULL vale '
                       'como "relacionado" genérico. "resuelve" solo lo pone resolver_incidencia(), '
                       "nunca a mano"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_REGISTROS_RELACIONES = [
    Index(columnas=["id_registro_origen"]),
    Index(columnas=["id_registro_destino"]),
]

FKS_REGISTROS_RELACIONES = [
    ForeignKey(columna="id_registro_origen", referencia_tabla=NOMBRE_TABLA_REGISTROS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_registro_destino", referencia_tabla=NOMBRE_TABLA_REGISTROS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_REGISTROS_RELACIONES = Tabla(
    nombre=NOMBRE_TABLA_REGISTROS_RELACIONES, columnas=CAMPOS_REGISTROS_RELACIONES,
    indices=INDICES_REGISTROS_RELACIONES, foreign_keys=FKS_REGISTROS_RELACIONES,
    comentario="Relaciones libres entre registros de seguimiento (resuelve, relacionado, duplica...)",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_REGISTROS, TABLA_REGISTROS_RELACIONES]
