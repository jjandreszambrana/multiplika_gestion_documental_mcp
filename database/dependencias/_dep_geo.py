"""GEO: si la empresa sale en las respuestas de las IAs (fase 6 de webs y
redes) — ver docs/gestion-documental.md → "Webs y redes sociales".

gd_preguntas_geo: las preguntas que haría un cliente real ("mejor
laboratorio de análisis de alimentos en Sevilla"), por web. Cada medición
pregunta a cada IA disponible y apunta si sale la marca, si enlaza la web,
en qué puesto y qué competidores salen (gd_mediciones_geo). Sin FKs."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_PREGUNTAS = "gd_preguntas_geo"
NOMBRE_TABLA_MEDICIONES = "gd_mediciones_geo"
__DB_NAME__ = get_db_name("gestion_documental")

TABLA_PREGUNTAS = Tabla(
    nombre=NOMBRE_TABLA_PREGUNTAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_activo", tipo="INT", not_null=True, comentario="→ gd_activos_digitales.id (la web), sin FK"),
        Columna(nombre="pregunta", tipo="VARCHAR", longitud=500, not_null=True),
        Columna(nombre="activa", tipo="BOOLEAN", not_null=True, default=True),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True),
    ],
    indices=[Index(columnas=["id_activo"], nombre="gd_preguntas_geo_activo_idx")],
    comentario="Preguntas de seguimiento del GEO (presencia en respuestas de IAs)",
    db_name=__DB_NAME__,
)

TABLA_MEDICIONES = Tabla(
    nombre=NOMBRE_TABLA_MEDICIONES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_pregunta", tipo="INT", not_null=True),
        Columna(nombre="id_activo", tipo="INT", not_null=True),
        Columna(nombre="tanda", tipo="VARCHAR", longitud=40, not_null=True, comentario="Las mediciones hechas a la vez comparten tanda"),
        Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True),
        Columna(nombre="motor", tipo="VARCHAR", longitud=20, not_null=True, comentario="claude, chatgpt, gemini, perplexity"),
        Columna(nombre="modelo", tipo="VARCHAR", longitud=60),
        Columna(nombre="aparece", tipo="BOOLEAN", comentario="Si la respuesta nombra la marca"),
        Columna(nombre="enlaza", tipo="BOOLEAN", comentario="Si cita la web de la empresa"),
        Columna(nombre="posicion", tipo="INT", comentario="Puesto de la web entre los sitios citados (1 = el primero)"),
        Columna(nombre="competidores", tipo="MEDIUMTEXT", comentario="JSON: otros sitios citados"),
        Columna(nombre="respuesta", tipo="MEDIUMTEXT", comentario="La respuesta (recortada)"),
        Columna(nombre="error", tipo="MEDIUMTEXT"),
    ],
    indices=[Index(columnas=["id_activo", "fecha"], nombre="gd_mediciones_geo_activo_fecha_idx")],
    comentario="Resultados de preguntar a las IAs por la empresa",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_PREGUNTAS, TABLA_MEDICIONES]
