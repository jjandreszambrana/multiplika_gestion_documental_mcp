from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla

from ._dep_configuracion import PROVEEDORES_EMBEDDING_SOPORTADOS
from ._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_CHUNKS = "gd_chunks"
__DB_NAME__ = get_db_name("gestion_documental")

# Dimensión de fábrica de la plataforma (mistral:mistral-embed, confirmada
# de verdad con una llamada real a la API — no es un dato de catálogo).
# Fija en la columna por limitación de pgvector: para un cliente con otro
# proveedor (ver _dep_configuracion.py), usar construir_tabla_chunks(dimension)
# desde update_db.py al crear su base.
DIMENSION_EMBEDDING_DEFAULT = PROVEEDORES_EMBEDDING_SOPORTADOS["mistral:mistral-embed"]


def construir_tabla_chunks(dimension_embedding: int = DIMENSION_EMBEDDING_DEFAULT) -> Tabla:
    campos = [
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
                comentario="Identificador interno del chunk"),
        Columna(nombre="id_version", tipo="INT", not_null=True,
                comentario="Versión de documento a la que pertenece este chunk"),
        Columna(nombre="orden", tipo="INT", not_null=True,
                comentario="Posición del chunk dentro del documento (0-indexado)"),
        Columna(nombre="texto", tipo="MEDIUMTEXT", not_null=True,
                comentario="Texto del chunk (una sección del markdown, por encabezado)"),
        Columna(nombre="embedding", tipo="VECTOR", longitud=dimension_embedding, not_null=True,
                comentario="Embedding del texto del chunk"),
    ]
    indices = [
        Index(columnas=["id_version"]),
        Index(columnas=["embedding"], metodo="hnsw", opclass="vector_cosine_ops",
              with_opciones="m = 16, ef_construction = 64"),
    ]
    fks = [
        ForeignKey(columna="id_version", referencia_tabla=NOMBRE_TABLA_VERSIONES,
                   referencia_columna="id", on_delete="CASCADE"),
    ]
    return Tabla(
        nombre=NOMBRE_TABLA_CHUNKS, columnas=campos, indices=indices, foreign_keys=fks,
        comentario="Chunks embebidos de las versiones buscables (solo si el modo es/fue semántico)",
        db_name=__DB_NAME__,
    )


# Tabla con la dimensión por defecto (mistral) — válida para cualquier
# código que solo necesite las columnas (CRUD vía _mod_chunks.py); para
# dar de alta un cliente con otro proveedor, usar construir_tabla_chunks()
# desde update_db.py.
TABLA_CHUNKS = construir_tabla_chunks()

__TABLAS__ = [TABLA_CHUNKS]
