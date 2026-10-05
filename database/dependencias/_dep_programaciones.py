"""Programaciones: avisos puntuales o repetidos, enlazables a varios
documentos, que llegan a usuarios concretos por email y a la campanita
del panel — ver docs/gestion-documental.md → "Programaciones y
notificaciones" y docs/planificacion/programaciones-avisos-y-notificaciones.md.

Horas en hora de Madrid, sin zona (TIMESTAMP): "a las 9:00" es a las 9:00
de reloj todo el año, también tras el cambio de hora. Todo lo que compara
con "ahora" usa `ahora_madrid()` (database/modelos/_repeticiones.py), no
CURRENT_TIMESTAMP, que depende de la zona de la sesión.

Los destinatarios y las notificaciones guardan `id_usuario` sin FK: los
usuarios viven en la base de control (mcpc_usuarios), no en la del
proyecto — mismo criterio que gd_actividad."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_bloc_notas import NOMBRE_TABLA_BLOC_NOTAS
from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS

NOMBRE_TABLA_PROGRAMACIONES = "gd_programaciones"
NOMBRE_TABLA_PROGRAMACIONES_DOCUMENTOS = "gd_programaciones_documentos"
NOMBRE_TABLA_PROGRAMACIONES_DESTINATARIOS = "gd_programaciones_destinatarios"
NOMBRE_TABLA_EJECUCIONES = "gd_ejecuciones"
NOMBRE_TABLA_NOTIFICACIONES = "gd_notificaciones"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_PROGRAMACION = ["activa", "pausada", "terminada"]
ESTADOS_EMAIL_NOTIFICACION = ["enviado", "fallido", "no_aplica"]

CAMPOS_PROGRAMACIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la programación"),
    Columna(nombre="titulo", tipo="VARCHAR", longitud=255, not_null=True,
            comentario='Lo que se lee en el aviso: "Renovar el seguro de la furgoneta"'),
    Columna(nombre="descripcion", tipo="MEDIUMTEXT",
            comentario="Texto del aviso, opcional"),
    Columna(nombre="regla_repeticion", tipo="MEDIUMTEXT", not_null=True,
            comentario="Cuándo salta, en JSON — ver database/modelos/_repeticiones.py"),
    Columna(nombre="proxima_ejecucion", tipo="TIMESTAMP",
            comentario="Siguiente vez que salta (hora de Madrid) — NULL si está terminada"),
    Columna(nombre="ultima_ejecucion", tipo="TIMESTAMP",
            comentario="Última vez que saltó (hora de Madrid)"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="activa",
            enum_opciones=ESTADOS_PROGRAMACION,
            comentario="terminada = ya no hay más fechas (una sola vez, o pasado el 'hasta')"),
    Columna(nombre="avisar_por_email", tipo="BOOLEAN", not_null=True, default=True,
            comentario="Además de la notificación del panel, que sale siempre"),
    Columna(nombre="requiere_hecho", tipo="BOOLEAN", not_null=True, default=False,
            comentario='Si el aviso lleva botón "Hecho" y se recuerda mientras nadie lo pulse'),
    Columna(nombre="max_recordatorios", tipo="INT",
            comentario="Cuántas veces se recuerda como máximo tras el primer aviso — lo elige el "
                       "usuario; NULL = hasta que alguien pulse Hecho. Solo con requiere_hecho"),
    Columna(nombre="cada_dias_recordatorio", tipo="INT", not_null=True, default=1,
            comentario="Cada cuántos días se recuerda. Solo con requiere_hecho"),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre de la persona o de la API key — copia, como en gd_actividad"),
    Columna(nombre="id_usuario_creador", tipo="INT",
            comentario="→ mcpc_usuarios.id, sin FK entre bases — NULL si vino de una API key"),
    Columna(nombre="id_nota_bloc", tipo="INT",
            comentario="→ gd_bloc_notas.id: el recordatorio de una nota del bloc de notas. Si se "
                       "borra la nota, se borra con ella"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

# Nombres propios en todos los índices: los automáticos ("estado_idx"...)
# chocan con los de otras tablas (en Postgres son únicos por esquema).
INDICES_PROGRAMACIONES = [
    Index(columnas=["estado", "proxima_ejecucion"], nombre="gd_programaciones_proxima_idx"),
    Index(columnas=["id_nota_bloc"], nombre="gd_programaciones_nota_bloc_idx"),
]

FKS_PROGRAMACIONES = [
    ForeignKey(columna="id_nota_bloc", referencia_tabla=NOMBRE_TABLA_BLOC_NOTAS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_PROGRAMACIONES = Tabla(
    nombre=NOMBRE_TABLA_PROGRAMACIONES, columnas=CAMPOS_PROGRAMACIONES, indices=INDICES_PROGRAMACIONES,
    foreign_keys=FKS_PROGRAMACIONES,
    comentario="Avisos puntuales o repetidos para usuarios concretos",
    db_name=__DB_NAME__,
)


CAMPOS_PROGRAMACIONES_DOCUMENTOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_programacion", tipo="INT", not_null=True, comentario="→ gd_programaciones.id"),
    Columna(nombre="id_documento", tipo="INT", not_null=True, comentario="→ gd_documentos.id"),
]

INDICES_PROGRAMACIONES_DOCUMENTOS = [
    Index(columnas=["id_programacion", "id_documento"], unico=True, nombre="gd_programaciones_documentos_uk"),
    Index(columnas=["id_documento"], nombre="gd_programaciones_documentos_doc_idx"),
]

FKS_PROGRAMACIONES_DOCUMENTOS = [
    ForeignKey(columna="id_programacion", referencia_tabla=NOMBRE_TABLA_PROGRAMACIONES,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_PROGRAMACIONES_DOCUMENTOS = Tabla(
    nombre=NOMBRE_TABLA_PROGRAMACIONES_DOCUMENTOS, columnas=CAMPOS_PROGRAMACIONES_DOCUMENTOS,
    indices=INDICES_PROGRAMACIONES_DOCUMENTOS, foreign_keys=FKS_PROGRAMACIONES_DOCUMENTOS,
    comentario="Documentos enlazados a cada programación (muchos a muchos)",
    db_name=__DB_NAME__,
)


CAMPOS_PROGRAMACIONES_DESTINATARIOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_programacion", tipo="INT", not_null=True, comentario="→ gd_programaciones.id"),
    Columna(nombre="id_usuario", tipo="INT", not_null=True,
            comentario="→ mcpc_usuarios.id, sin FK entre bases"),
]

INDICES_PROGRAMACIONES_DESTINATARIOS = [
    Index(columnas=["id_programacion", "id_usuario"], unico=True, nombre="gd_programaciones_destinatarios_uk"),
]

FKS_PROGRAMACIONES_DESTINATARIOS = [
    ForeignKey(columna="id_programacion", referencia_tabla=NOMBRE_TABLA_PROGRAMACIONES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_PROGRAMACIONES_DESTINATARIOS = Tabla(
    nombre=NOMBRE_TABLA_PROGRAMACIONES_DESTINATARIOS, columnas=CAMPOS_PROGRAMACIONES_DESTINATARIOS,
    indices=INDICES_PROGRAMACIONES_DESTINATARIOS, foreign_keys=FKS_PROGRAMACIONES_DESTINATARIOS,
    comentario="A quién avisa cada programación",
    db_name=__DB_NAME__,
)


# Una fila cada vez que salta una programación. Si requiere "Hecho", aquí
# se lleva la cuenta de los recordatorios y quién lo cerró: cada vez que
# salta es independiente (marcar hecho el aviso de este lunes no cierra
# el del lunes siguiente).
CAMPOS_EJECUCIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_programacion", tipo="INT", not_null=True, comentario="→ gd_programaciones.id"),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, comentario="Cuándo saltó (hora de Madrid)"),
    Columna(nombre="resumen", tipo="MEDIUMTEXT",
            comentario='Qué pasó, legible: "Avisado a Ana (panel y email), Luis (panel; email falló: ...)"'),
    Columna(nombre="pendiente_hecho", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Espera a que alguien pulse Hecho"),
    Columna(nombre="recordatorios_enviados", tipo="INT", not_null=True, default=0),
    Columna(nombre="proximo_recordatorio", tipo="TIMESTAMP",
            comentario="NULL si no quedan recordatorios por mandar"),
    Columna(nombre="hecho_por", tipo="VARCHAR", longitud=255,
            comentario="Quién pulsó Hecho — copia del nombre"),
    Columna(nombre="fecha_hecho", tipo="TIMESTAMP"),
]

INDICES_EJECUCIONES = [
    Index(columnas=["id_programacion", "fecha"], nombre="gd_ejecuciones_programacion_idx"),
    Index(columnas=["pendiente_hecho", "proximo_recordatorio"], nombre="gd_ejecuciones_recordatorio_idx"),
]

FKS_EJECUCIONES = [
    ForeignKey(columna="id_programacion", referencia_tabla=NOMBRE_TABLA_PROGRAMACIONES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_EJECUCIONES = Tabla(
    nombre=NOMBRE_TABLA_EJECUCIONES, columnas=CAMPOS_EJECUCIONES,
    indices=INDICES_EJECUCIONES, foreign_keys=FKS_EJECUCIONES,
    comentario="Historial de cada vez que saltó una programación",
    db_name=__DB_NAME__,
)


# Lo que ve cada usuario en su campanita. Pensada para que más adelante
# entren también las caducidades y las incidencias (campo `origen`).
# Si se borra la programación, sus notificaciones se van con ella.
CAMPOS_NOTIFICACIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_usuario", tipo="INT", not_null=True,
            comentario="A quién le llega (→ mcpc_usuarios.id, sin FK entre bases)"),
    Columna(nombre="origen", tipo="VARCHAR", longitud=30, not_null=True, default="programacion",
            comentario="De dónde viene: programacion (más adelante caducidad, incidencia...)"),
    Columna(nombre="id_programacion", tipo="INT", comentario="→ gd_programaciones.id"),
    Columna(nombre="id_ejecucion", tipo="INT", comentario="→ gd_ejecuciones.id (para el botón Hecho)"),
    Columna(nombre="titulo", tipo="VARCHAR", longitud=255, not_null=True),
    Columna(nombre="texto", tipo="MEDIUMTEXT"),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, comentario="Hora de Madrid"),
    Columna(nombre="leida", tipo="BOOLEAN", not_null=True, default=False),
    Columna(nombre="fecha_leida", tipo="TIMESTAMP"),
    Columna(nombre="archivada", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Fuera de la lista normal; solo las archivadas se pueden purgar"),
    Columna(nombre="estado_email", tipo="VARCHAR", longitud=20, not_null=True, default="no_aplica",
            enum_opciones=ESTADOS_EMAIL_NOTIFICACION),
    Columna(nombre="error_email", tipo="MEDIUMTEXT"),
]

INDICES_NOTIFICACIONES = [
    Index(columnas=["id_usuario", "leida", "fecha"], nombre="gd_notificaciones_usuario_idx"),
    Index(columnas=["id_ejecucion"], nombre="gd_notificaciones_ejecucion_idx"),
]

FKS_NOTIFICACIONES = [
    ForeignKey(columna="id_programacion", referencia_tabla=NOMBRE_TABLA_PROGRAMACIONES,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_ejecucion", referencia_tabla=NOMBRE_TABLA_EJECUCIONES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_NOTIFICACIONES = Tabla(
    nombre=NOMBRE_TABLA_NOTIFICACIONES, columnas=CAMPOS_NOTIFICACIONES,
    indices=INDICES_NOTIFICACIONES, foreign_keys=FKS_NOTIFICACIONES,
    comentario="Notificaciones de cada usuario (la campanita del panel)",
    db_name=__DB_NAME__,
)

__TABLAS__ = [
    TABLA_PROGRAMACIONES,
    TABLA_PROGRAMACIONES_DOCUMENTOS,
    TABLA_PROGRAMACIONES_DESTINATARIOS,
    TABLA_EJECUCIONES,
    TABLA_NOTIFICACIONES,
]
