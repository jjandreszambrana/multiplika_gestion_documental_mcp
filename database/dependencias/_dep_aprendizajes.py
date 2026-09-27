"""Aprendizajes: documentos de una GD enlazada que esta central aspira,
anonimiza y, tras revisión de una persona, incorpora como documentos
propios — ver docs/gestion-documental.md → "Aprendizaje de la central".
Sin FKs (igual que gd_enlaces): el enlace o el documento creado se
referencian por id sin atadura, para poder aplicar la tabla suelta."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_APRENDIZAJES = "gd_aprendizajes"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADO_CANDIDATO = "candidato"
ESTADO_PENDIENTE_REVISION = "pendiente_revision"
ESTADO_APROBADO = "aprobado"
ESTADO_RECHAZADO = "rechazado"
ESTADOS_APRENDIZAJE = [ESTADO_CANDIDATO, ESTADO_PENDIENTE_REVISION, ESTADO_APROBADO, ESTADO_RECHAZADO]

CAMPOS_APRENDIZAJES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_enlace", tipo="INT", not_null=True,
            comentario="De qué GD enlazada viene (→ gd_enlaces.id, sentido enlazada)"),
    Columna(nombre="origen", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Nombre de esa GD en el momento de aspirar — solo lo ve el admin de esta central"),
    Columna(nombre="id_documento_origen", tipo="INT", not_null=True,
            comentario="Id del documento EN LA GD DE ORIGEN (no en esta base)"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=255, not_null=True),
    Columna(nombre="tipo_documento", tipo="VARCHAR", longitud=50, not_null=True),
    Columna(nombre="fecha_documento", tipo="DATE"),
    Columna(nombre="resumen", tipo="MEDIUMTEXT", not_null=True,
            comentario="Resumen corto hecho por la IA de esta central, para decidir si merece la pena"),
    Columna(nombre="markdown_anonimizado", tipo="MEDIUMTEXT",
            comentario="Copia completa con los datos sensibles ya sustituidos por genéricos. El texto "
                       "original NUNCA se guarda aquí: solo pasa por memoria para anonimizarlo"),
    Columna(nombre="sustituciones", tipo="MEDIUMTEXT",
            comentario="Qué se sustituyó, descrito por tipo (JSON, lista de textos) — sin los valores "
                       "originales, que sería guardar justo lo que se quiere evitar"),
    Columna(nombre="estado", tipo="ENUM", enum_opciones=ESTADOS_APRENDIZAJE, not_null=True,
            default=ESTADO_CANDIDATO),
    Columna(nombre="motivo_rechazo", tipo="MEDIUMTEXT"),
    Columna(nombre="id_documento_creado", tipo="INT",
            comentario="Documento de ESTA central creado al aprobar (→ gd_documentos.id)"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
    Columna(nombre="fecha_actualizacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP")),
]

TABLA_APRENDIZAJES = Tabla(
    nombre=NOMBRE_TABLA_APRENDIZAJES, columnas=CAMPOS_APRENDIZAJES,
    indices=[Index(columnas=["estado"]), Index(columnas=["id_enlace", "id_documento_origen"], unico=True)],
    comentario="Documentos aspirados de GDs enlazadas, anonimizados y pendientes de aprobar",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_APRENDIZAJES]
