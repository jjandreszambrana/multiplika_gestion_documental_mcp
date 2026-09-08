from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla

from ._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_CHUNKS = "gd_chunks"
__DB_NAME__ = get_db_name("gestion_documental")

# Dimensión de fábrica de la plataforma (mistral:mistral-embed, confirmada
# de verdad con una llamada real a la API — no es un dato de catálogo).
# Fija en la columna por limitación de pgvector: ver nota en
# docs/fase1-diseno-esqueleto.md sobre qué implica cambiarla para un cliente concreto.
DIMENSION_EMBEDDING_DEFAULT = 1024

CAMPOS_CHUNKS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del chunk"),
    Columna(nombre="id_version", tipo="INT", not_null=True,
            comentario="Versión de documento a la que pertenece este chunk"),
    Columna(nombre="orden", tipo="INT", not_null=True,
            comentario="Posición del chunk dentro del documento (0-indexado)"),
    Columna(nombre="texto", tipo="MEDIUMTEXT", not_null=True,
            comentario="Texto del chunk (una sección del markdown, por encabezado)"),
    Columna(nombre="embedding", tipo="VECTOR", longitud=DIMENSION_EMBEDDING_DEFAULT, not_null=True,
            comentario="Embedding del texto del chunk"),
]

INDICES_CHUNKS = [
    Index(columnas=["id_version"]),
    Index(columnas=["embedding"], metodo="hnsw", opclass="vector_cosine_ops",
          with_opciones="m = 16, ef_construction = 64"),
]

FKS_CHUNKS = [
    ForeignKey(columna="id_version", referencia_tabla=NOMBRE_TABLA_VERSIONES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_CHUNKS = Tabla(
    nombre=NOMBRE_TABLA_CHUNKS, columnas=CAMPOS_CHUNKS, indices=INDICES_CHUNKS,
    foreign_keys=FKS_CHUNKS,
    comentario="Chunks embebidos de las versiones buscables (solo si el modo es/fue semántico)",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CHUNKS]
