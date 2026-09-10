from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_TIPOS_DOCUMENTO = "gd_tipos_documento"
__DB_NAME__ = get_db_name("gestion_documental")

# Con estos arranca cualquier cliente nuevo (ver database/update_db.py,
# que los inserta solo si la tabla está vacía — no en cada migración,
# para no pisar lo que el cliente haya quitado/añadido después).
TIPOS_POR_DEFECTO = ["factura", "certificado", "contrato", "informe", "otro"]

CAMPOS_TIPOS_DOCUMENTO = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del tipo"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=50, not_null=True,
            comentario="p.ej. \"factura\" — catálogo de sugerencias para el filtro del panel y "
                       "para que la IA reutilice tipos ya existentes, no una lista cerrada: "
                       "gd_documentos.tipo_documento no tiene FK a esta tabla"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP")),
]

INDICES_TIPOS_DOCUMENTO = [
    Index(columnas=["nombre"], unico=True),
]

TABLA_TIPOS_DOCUMENTO = Tabla(
    nombre=NOMBRE_TABLA_TIPOS_DOCUMENTO, columnas=CAMPOS_TIPOS_DOCUMENTO,
    indices=INDICES_TIPOS_DOCUMENTO,
    comentario="Catálogo (abierto, no cerrado) de tipos de documento de este cliente",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_TIPOS_DOCUMENTO]
