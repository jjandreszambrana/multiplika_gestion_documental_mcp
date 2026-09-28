"""Comentarios, anotaciones, observaciones, incidencias y resoluciones
sobre un documento — ver docs/gestion-documental.md → "Notas de
seguimiento". Una nota cuelga siempre de gd_documentos (nunca de una
versión concreta): así sigue disponible entera cuando el documento tiene
una versión nueva, sin copiarla ni migrarla. id_version_origen es solo
informativo (en qué versión se creó), nunca restringe en qué versiones
se ve.

Se llamaban "registros" (gd_registros) hasta el 2026-09-28: el nombre se
cambió para dejarlo libre para los registros de datos, que son otra cosa
— ver docs/gestion-documental.md → "Notas de seguimiento"."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_NOTAS = "gd_notas"
NOMBRE_TABLA_NOTAS_RELACIONES = "gd_notas_relaciones"
__DB_NAME__ = get_db_name("gestion_documental")

# "resolucion" solo se crea desde resolver_incidencia() (ver
# _mod_notas.py) — nunca directamente, para que una incidencia
# resuelta siempre tenga su relación "resuelve" y su estado en el mismo
# paso. Las otras cuatro se crean libremente sobre cualquier documento.
TIPOS_NOTA_CREABLES = ["comentario", "anotacion", "observacion", "incidencia"]
TIPOS_NOTA = TIPOS_NOTA_CREABLES + ["resolucion"]

ESTADOS_INCIDENCIA = ["abierta", "resuelta"]

CAMPOS_NOTAS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la nota"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento al que pertenece (→ gd_documentos.id) — no una versión concreta, "
                       "a propósito: así la nota sigue apareciendo con cualquier versión nueva"),
    Columna(nombre="id_version_origen", tipo="INT",
            comentario="En qué versión estaba el documento cuando se creó esta nota (→ "
                       "gd_versiones.id) — solo informativo, NULL si no se sabe; no limita en qué "
                       "versiones se ve, eso lo decide siempre id_documento"),
    Columna(nombre="tipo", tipo="VARCHAR", longitud=20, not_null=True, enum_opciones=TIPOS_NOTA,
            comentario="comentario / anotacion / observacion / incidencia / resolucion"),
    Columna(nombre="texto", tipo="MEDIUMTEXT", not_null=True,
            comentario="Contenido de la nota"),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre de quien abrió la nota — texto libre (el usuario real del panel "
                       "cuando se crea desde ahí, o lo que diga el cliente por chat si se crea vía "
                       "MCP: no hay una identidad de persona fiable en una llamada de herramienta, "
                       "solo la del proyecto)"),
    Columna(nombre="responsable", tipo="VARCHAR", longitud=255,
            comentario="A quién se le asigna — texto libre en cualquier tipo de nota, no solo "
                       "incidencias (decisión de producto: no hace falta que sea un usuario real del "
                       "sistema), NULL si no se ha asignado"),
    Columna(nombre="responsable_email", tipo="VARCHAR", longitud=255,
            comentario="Email del responsable, opcional — si está, avisar_incidencias.py le escribe "
                       "directo a él en vez de (además de) al email_avisos general. NULL si no se "
                       "conoce; no se valida el formato, es un campo de contacto, no una cuenta del "
                       "sistema"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, enum_opciones=ESTADOS_INCIDENCIA,
            comentario="Solo tiene sentido para tipo='incidencia' (abierta/resuelta); NULL en el "
                       "resto de tipos"),
    Columna(nombre="aviso_responsable_enviado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Si ya se avisó por email al asignar el responsable actual de esta "
                       "incidencia (ver scripts/avisar_incidencias.py) — un aviso por asignación, "
                       "no uno diario mientras siga abierta; se reinicia a false cada vez que "
                       "actualizar_responsable() cambia el responsable"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True, comentario="Cuándo se abrió la nota"),
]

INDICES_NOTAS = [
    Index(columnas=["id_documento", "tipo"]),
]

FKS_NOTAS = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_version_origen", referencia_tabla=NOMBRE_TABLA_VERSIONES,
               referencia_columna="id", on_delete="SET NULL"),
]

TABLA_NOTAS = Tabla(
    nombre=NOMBRE_TABLA_NOTAS, columnas=CAMPOS_NOTAS,
    indices=INDICES_NOTAS, foreign_keys=FKS_NOTAS,
    comentario="Comentarios, anotaciones, observaciones, incidencias y resoluciones sobre un "
               "documento — cuelgan del documento, no de una versión concreta",
    db_name=__DB_NAME__,
)


# Relaciones libres entre notas (p.ej. una resolución "resuelve" su
# incidencia, un comentario "relacionado" con una incidencia...) — tabla
# aparte en vez de una columna id_nota_padre en gd_notas porque una
# misma nota puede relacionarse con más de una, y en ambos sentidos.
CAMPOS_NOTAS_RELACIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la relación"),
    Columna(nombre="id_nota_origen", tipo="INT", not_null=True,
            comentario="Nota que enlaza (→ gd_notas.id)"),
    Columna(nombre="id_nota_destino", tipo="INT", not_null=True,
            comentario="Nota enlazada (→ gd_notas.id)"),
    Columna(nombre="tipo_relacion", tipo="VARCHAR", longitud=50,
            comentario='Etiqueta libre (p.ej. "resuelve", "relacionado", "duplica") — NULL vale '
                       'como "relacionado" genérico. "resuelve" solo lo pone resolver_incidencia(), '
                       "nunca a mano"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_NOTAS_RELACIONES = [
    Index(columnas=["id_nota_origen"]),
    Index(columnas=["id_nota_destino"]),
]

FKS_NOTAS_RELACIONES = [
    ForeignKey(columna="id_nota_origen", referencia_tabla=NOMBRE_TABLA_NOTAS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_nota_destino", referencia_tabla=NOMBRE_TABLA_NOTAS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_NOTAS_RELACIONES = Tabla(
    nombre=NOMBRE_TABLA_NOTAS_RELACIONES, columnas=CAMPOS_NOTAS_RELACIONES,
    indices=INDICES_NOTAS_RELACIONES, foreign_keys=FKS_NOTAS_RELACIONES,
    comentario="Relaciones libres entre notas de seguimiento (resuelve, relacionado, duplica...)",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_NOTAS, TABLA_NOTAS_RELACIONES]
