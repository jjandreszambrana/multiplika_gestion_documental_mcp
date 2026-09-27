"""GDs enlazadas — ver docs/gestion-documental.md → "GDs enlazadas".
Una gestión documental puede consultar a otra que actúe de central
(solo lectura, sin lo que la central marque reservado) y la central
apunta lo que no supo responder. Tres tablas sin FKs entre sí ni hacia
el resto del esquema — se pueden aplicar en un servidor real sin
registrar ninguna otra tabla."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_ENLACES = "gd_enlaces"
NOMBRE_TABLA_PREGUNTAS_PENDIENTES = "gd_preguntas_pendientes"
NOMBRE_TABLA_USO_ENLACES = "gd_uso_enlaces"
ID_ROL_GD_ENLAZADA = 5  # mcpc_roles.id del núcleo (lib/roles_proyecto.py) — copia local a propósito
__DB_NAME__ = get_db_name("gestion_documental")

# Sentido de cada enlace, visto desde ESTA gestión documental:
#   central  — otra GD a la que yo consulto (guardo la key que ella me emitió)
#   enlazada — otra GD que me consulta a mí (guardo la key que ella me emitió
#              para que yo pueda leer sus documentos y aspirar aprendizajes)
SENTIDO_CENTRAL = "central"
SENTIDO_ENLAZADA = "enlazada"

MOTIVO_SIN_RESULTADOS = "sin_resultados"
MOTIVO_NO_RESUELTA = "no_resuelta"

TIPOS_USO = ["consulta", "documento_completo", "resumen", "anonimizacion"]

CAMPOS_ENLACES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Cómo se llama la otra GD para nosotros (p.ej. 'Central de la asesoría')"),
    Columna(nombre="url_mcp", tipo="VARCHAR", longitud=500, not_null=True,
            comentario="URL pública /mcp de la otra GD"),
    Columna(nombre="api_key_cifrada", tipo="VARCHAR", longitud=500, not_null=True,
            comentario="Key de rol gd_enlazada que la otra GD nos emitió — Fernet, lib.cifrado del núcleo"),
    Columna(nombre="sentido", tipo="ENUM", enum_opciones=[SENTIDO_CENTRAL, SENTIDO_ENLAZADA], not_null=True),
    Columna(nombre="id_api_key_emitida", tipo="INT", not_null=True,
            comentario="Key de rol gd_enlazada que NOSOTROS le emitimos a la otra GD (→ mcpc_api_keys.id "
                       "de la base de control) — se revoca al desenlazar"),
    Columna(nombre="activo", tipo="BOOLEAN", not_null=True, default=True),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

TABLA_ENLACES = Tabla(
    nombre=NOMBRE_TABLA_ENLACES, columnas=CAMPOS_ENLACES,
    indices=[Index(columnas=["sentido"]), Index(columnas=["id_api_key_emitida"], unico=True)],
    comentario="Otras gestiones documentales enlazadas con esta, en cualquiera de los dos sentidos",
    db_name=__DB_NAME__,
)

CAMPOS_PREGUNTAS_PENDIENTES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="pregunta", tipo="MEDIUMTEXT", not_null=True),
    Columna(nombre="origen", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Qué GD enlazada preguntó (nombre de la key gd_enlazada con la que llamó)"),
    Columna(nombre="motivo", tipo="ENUM", enum_opciones=[MOTIVO_SIN_RESULTADOS, MOTIVO_NO_RESUELTA],
            not_null=True,
            comentario="sin_resultados: la búsqueda no devolvió nada (anotado automáticamente); "
                       "no_resuelta: hubo resultados pero la IA de la enlazada dijo que no respondían"),
    Columna(nombre="detalle", tipo="MEDIUMTEXT",
            comentario="Qué faltaba, en palabras de la IA que preguntó (solo en no_resuelta)"),
    Columna(nombre="veces", tipo="INT", not_null=True, default=1,
            comentario="Misma pregunta (sin mayúsculas ni espacios de más) y mismo origen → +1, no fila nueva"),
    Columna(nombre="estado", tipo="ENUM", enum_opciones=["pendiente", "resuelta"], not_null=True,
            default="pendiente"),
    Columna(nombre="fecha_primera", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
    Columna(nombre="fecha_ultima", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP")),
]

TABLA_PREGUNTAS_PENDIENTES = Tabla(
    nombre=NOMBRE_TABLA_PREGUNTAS_PENDIENTES, columnas=CAMPOS_PREGUNTAS_PENDIENTES,
    indices=[Index(columnas=["estado"]), Index(columnas=["origen"])],
    comentario="Preguntas de GDs enlazadas que esta central no supo responder, para cubrirlas después",
    db_name=__DB_NAME__,
)

CAMPOS_USO_ENLACES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="origen", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Para qué GD enlazada se hizo el trabajo (nombre de su key gd_enlazada)"),
    Columna(nombre="tipo", tipo="ENUM", enum_opciones=TIPOS_USO, not_null=True),
    Columna(nombre="tokens_entrada", tipo="INT", not_null=True, default=0),
    Columna(nombre="tokens_salida", tipo="INT", not_null=True, default=0),
    Columna(nombre="modelo", tipo="VARCHAR", longitud=100),
    Columna(nombre="coste_estimado", tipo="NUMERIC", precision=12, escala=6, not_null=True, default=0,
            comentario="En USD, calculado en el momento con la tarifa vigente del modelo — se guarda "
                       "el importe porque las tarifas cambian"),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

TABLA_USO_ENLACES = Tabla(
    nombre=NOMBRE_TABLA_USO_ENLACES, columnas=CAMPOS_USO_ENLACES,
    indices=[Index(columnas=["origen"]), Index(columnas=["fecha"])],
    comentario="Uso que cada GD enlazada hace de esta central, para repercutirle el coste",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_ENLACES, TABLA_PREGUNTAS_PENDIENTES, TABLA_USO_ENLACES]
