"""Vigilancia de webs (fase 2 de webs y redes) — ver docs/gestion-documental.md
→ "Webs y redes sociales" y docs/planificacion/webs-y-redes-sociales.md.

gd_comprobaciones: qué se vigila de cada activo y cada cuánto, con su último
resultado. gd_resultados_comprobacion: el histórico, para ver la evolución.
Sin FKs, como el resto de webs y redes: el histórico no debe desaparecer
por archivar o borrar un activo, y se limpia por antigüedad."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_COMPROBACIONES = "gd_comprobaciones"
NOMBRE_TABLA_RESULTADOS = "gd_resultados_comprobacion"
NOMBRE_TABLA_RESUMENES_VIGILANCIA = "gd_vigilancia_resumenes"
NOMBRE_TABLA_CACHE_VULNERABILIDADES = "gd_cache_vulnerabilidades"
__DB_NAME__ = get_db_name("gestion_documental")

# ok: todo bien. aviso: conviene mirarlo (va al resumen semanal). grave: avisa
# en el momento. sin_datos: no se puede saber (p.ej. el registro del dominio
# no da la fecha). error: la propia comprobación falló (credencial, red...).
ESTADOS_COMPROBACION = ["ok", "aviso", "grave", "sin_datos", "error"]

CAMPOS_COMPROBACIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_activo", tipo="INT", not_null=True, comentario="→ gd_activos_digitales.id, sin FK"),
    Columna(nombre="tipo", tipo="VARCHAR", longitud=40, not_null=True,
            comentario="disponibilidad, certificado, dominio... (ver TIPOS en _mod_vigilancia.py)"),
    Columna(nombre="activa", tipo="BOOLEAN", not_null=True, default=True),
    Columna(nombre="cada_minutos", tipo="INT", not_null=True, comentario="Frecuencia"),
    Columna(nombre="proxima", tipo="TIMESTAMP", comentario="Cuándo toca la siguiente (hora de Madrid)"),
    Columna(nombre="ultima", tipo="TIMESTAMP", comentario="Última vez que se comprobó"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, comentario="Último resultado (ver ESTADOS_COMPROBACION)"),
    Columna(nombre="resumen", tipo="VARCHAR", longitud=500, comentario="Último resultado en palabras normales"),
    Columna(nombre="detalle", tipo="MEDIUMTEXT",
            comentario="JSON del último resultado; también sirve de memoria entre pasadas (p.ej. los "
                       "administradores conocidos, para detectar uno nuevo)"),
    Columna(nombre="estado_avisado", tipo="VARCHAR", longitud=20,
            comentario="Último estado del que se avisó al momento — para avisar solo al cambiar, no en cada pasada"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

TABLA_COMPROBACIONES = Tabla(
    nombre=NOMBRE_TABLA_COMPROBACIONES, columnas=CAMPOS_COMPROBACIONES,
    indices=[
        Index(columnas=["id_activo", "tipo"], unico=True, nombre="gd_comprobaciones_activo_tipo_idx"),
        Index(columnas=["proxima"], nombre="gd_comprobaciones_proxima_idx"),
    ],
    comentario="Qué se vigila de cada web o cuenta, cada cuánto, y su último resultado",
    db_name=__DB_NAME__,
)

CAMPOS_RESULTADOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_comprobacion", tipo="INT", not_null=True),
    Columna(nombre="id_activo", tipo="INT", not_null=True),
    Columna(nombre="tipo", tipo="VARCHAR", longitud=40, not_null=True),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True),
    Columna(nombre="resumen", tipo="VARCHAR", longitud=500, not_null=True),
    Columna(nombre="detalle", tipo="MEDIUMTEXT"),
    Columna(nombre="duracion_ms", tipo="INT"),
]

TABLA_RESULTADOS = Tabla(
    nombre=NOMBRE_TABLA_RESULTADOS, columnas=CAMPOS_RESULTADOS,
    indices=[
        Index(columnas=["id_activo", "fecha"], nombre="gd_resultados_comprobacion_activo_fecha_idx"),
        Index(columnas=["id_comprobacion", "fecha"], nombre="gd_resultados_comprobacion_comp_fecha_idx"),
    ],
    comentario="Histórico de las comprobaciones de vigilancia; se borra pasado el plazo de cada activo",
    db_name=__DB_NAME__,
)

# Una fila por semana con resumen mandado: la pasada que la inserta es la que
# lo manda (mismo truco que gd_seguimiento_resumenes).
TABLA_RESUMENES_VIGILANCIA = Tabla(
    nombre=NOMBRE_TABLA_RESUMENES_VIGILANCIA,
    columnas=[
        Columna(nombre="semana", tipo="DATE", primary_key=True, comentario="Lunes de la semana"),
        Columna(nombre="fecha_envio", tipo="TIMESTAMP", not_null=True),
    ],
    comentario="Semanas en las que ya se mandó el resumen de vigilancia",
    db_name=__DB_NAME__,
)

# Respuestas del servicio de fallos de seguridad conocidos, para no gastar
# consultas (los planes gratuitos dan pocas al día): una por elemento y día.
TABLA_CACHE_VULNERABILIDADES = Tabla(
    nombre=NOMBRE_TABLA_CACHE_VULNERABILIDADES,
    columnas=[
        Columna(nombre="clave", tipo="VARCHAR", longitud=200, primary_key=True,
                comentario='"plugin:akismet", "tema:astra", "wordpress:6.6.2"'),
        Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True),
        Columna(nombre="datos", tipo="MEDIUMTEXT", comentario="JSON tal cual lo devolvió el servicio"),
    ],
    comentario="Caché diaria de consultas de vulnerabilidades",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_COMPROBACIONES, TABLA_RESULTADOS, TABLA_RESUMENES_VIGILANCIA, TABLA_CACHE_VULNERABILIDADES]
