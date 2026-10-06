"""Consultas guardadas de las bases de datos (fase 4 de webs y redes) — ver
docs/gestion-documental.md → "Webs y redes sociales". Las escribe la IA (o
alguien que sepa SQL) y luego cualquiera las ejecuta desde el panel con un
botón. Siempre de lectura. Sin FKs, como el resto de webs y redes."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_CONSULTAS = "gd_consultas_bd"
__DB_NAME__ = get_db_name("gestion_documental")

TABLA_CONSULTAS = Tabla(
    nombre=NOMBRE_TABLA_CONSULTAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_activo", tipo="INT", not_null=True, comentario="→ gd_activos_digitales.id, sin FK"),
        Columna(nombre="nombre", tipo="VARCHAR", longitud=200, not_null=True, comentario='p.ej. "Pedidos del mes por provincia"'),
        Columna(nombre="descripcion", tipo="MEDIUMTEXT", comentario="Qué responde, en palabras normales"),
        Columna(nombre="sql", tipo="MEDIUMTEXT", not_null=True, comentario="Una sola sentencia de lectura"),
        Columna(nombre="creado_por", tipo="VARCHAR", longitud=150, not_null=True),
        Columna(nombre="veces_usada", tipo="INT", not_null=True, default=0),
        Columna(nombre="fecha_ultimo_uso", tipo="TIMESTAMP"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True),
    ],
    indices=[Index(columnas=["id_activo", "nombre"], nombre="gd_consultas_bd_activo_nombre_idx")],
    comentario="Consultas de lectura guardadas para ejecutar con un botón",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CONSULTAS]
