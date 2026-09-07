from database.config_db import get_db_name
from mtpk_postgres import Columna, Tabla

NOMBRE_TABLA_CONFIGURACION = "gd_configuracion"
__DB_NAME__ = get_db_name("gestion_documental")  # alias real: el slug del cliente

CAMPOS_CONFIGURACION = [
    Columna(nombre="id", tipo="INT", primary_key=True, default=1,
            comentario="Fijo a 1: la tabla tiene siempre una única fila"),
    Columna(nombre="modo_busqueda", tipo="ENUM", enum_opciones=["fulltext", "semantico"],
            not_null=True, default="fulltext",
            comentario="Modo de búsqueda activo del cliente, cambiable en cualquier momento"),
    Columna(nombre="proveedor_embedding", tipo="VARCHAR", longitud=100, not_null=True,
            default="openai:text-embedding-3-small",
            comentario="Proveedor:modelo de embedding usado si el modo es semántico"),
    Columna(nombre="dimension_embedding", tipo="INT", not_null=True, default=1536,
            comentario="Dimensión del vector de embedding (informativa; ver nota sobre gd_chunks.embedding)"),
]

TABLA_CONFIGURACION = Tabla(
    nombre=NOMBRE_TABLA_CONFIGURACION, columnas=CAMPOS_CONFIGURACION,
    comentario="Configuración de búsqueda del cliente (fila única)", db_name=__DB_NAME__,
    registros_iniciales=[{"id": 1}],  # crea la fila única con los defaults
)

__TABLAS__ = [TABLA_CONFIGURACION]
