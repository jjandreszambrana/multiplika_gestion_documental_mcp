from database.config_db import get_db_name
from mtpk_postgres import Columna, Tabla

NOMBRE_TABLA_CONFIGURACION = "gd_configuracion"
__DB_NAME__ = get_db_name("gestion_documental")  # alias real: el slug del cliente

# Proveedores de embedding soportados y su dimensión de vector — la
# dimensión hay que fijarla al crear la base del cliente (update_db.py
# --proveedor-embedding), no se puede cambiar después sin migrar
# gd_chunks.embedding a mano (columna VECTOR de tamaño fijo en Postgres).
PROVEEDORES_EMBEDDING_SOPORTADOS = {
    "mistral:mistral-embed": 1024,
    "openai:text-embedding-3-small": 1536,
    "openai:text-embedding-3-large": 3072,
}
PROVEEDOR_EMBEDDING_POR_DEFECTO = "mistral:mistral-embed"


def construir_tabla_configuracion(proveedor_embedding: str = PROVEEDOR_EMBEDDING_POR_DEFECTO) -> Tabla:
    dimension = PROVEEDORES_EMBEDDING_SOPORTADOS[proveedor_embedding]
    campos = [
        Columna(nombre="id", tipo="INT", primary_key=True, default=1,
                comentario="Fijo a 1: la tabla tiene siempre una única fila"),
        Columna(nombre="modo_busqueda", tipo="ENUM", enum_opciones=["fulltext", "semantico"],
                not_null=True, default="fulltext",
                comentario="Modo de búsqueda activo del cliente, cambiable en cualquier momento"),
        Columna(nombre="proveedor_embedding", tipo="VARCHAR", longitud=100, not_null=True,
                default=proveedor_embedding,
                comentario="Proveedor:modelo de embedding usado si el modo es semántico"),
        Columna(nombre="dimension_embedding", tipo="INT", not_null=True, default=dimension,
                comentario="Dimensión del vector de embedding — debe coincidir con gd_chunks.embedding"),
    ]
    return Tabla(
        nombre=NOMBRE_TABLA_CONFIGURACION, columnas=campos,
        comentario="Configuración de búsqueda del cliente (fila única)", db_name=__DB_NAME__,
        registros_iniciales=[{"id": 1}],
    )


# Tabla con el proveedor por defecto (mistral) — válida para cualquier
# código que solo necesite las columnas (CRUD vía _mod_configuracion.py);
# para dar de alta un cliente con otro proveedor, usar
# construir_tabla_configuracion(proveedor_embedding) desde update_db.py.
TABLA_CONFIGURACION = construir_tabla_configuracion()

__TABLAS__ = [TABLA_CONFIGURACION]
