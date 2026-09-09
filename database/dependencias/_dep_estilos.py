from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_ESTILOS = "gd_estilos"
NOMBRE_TABLA_ESTILOS_IMAGENES = "gd_estilos_imagenes"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_ESTILOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del estilo"),
    Columna(nombre="nombre_tipo", tipo="VARCHAR", longitud=100, not_null=True,
            comentario='Tipo de informe, p.ej. "informe_mensual" o "memoria_anual"'),
    Columna(nombre="instrucciones", tipo="MEDIUMTEXT", not_null=True,
            comentario="Cómo debe construir la IA un informe de este tipo: estructura, tono, "
                       "qué apartados lleva"),
    Columna(nombre="fecha_actualizacion", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP")),
]

INDICES_ESTILOS = [
    Index(columnas=["nombre_tipo"], unico=True),
]

TABLA_ESTILOS = Tabla(
    nombre=NOMBRE_TABLA_ESTILOS, columnas=CAMPOS_ESTILOS, indices=INDICES_ESTILOS,
    comentario="Tipos de informe que la IA puede construir, con sus instrucciones de estilo",
    db_name=__DB_NAME__,
)


CAMPOS_ESTILOS_IMAGENES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la imagen"),
    Columna(nombre="id_estilo", tipo="INT", not_null=True,
            comentario="Estilo al que pertenece esta imagen (→ gd_estilos.id)"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=150, not_null=True,
            comentario='Identifica la imagen dentro del estilo, p.ej. "logo_cabecera"'),
    Columna(nombre="descripcion_uso", tipo="MEDIUMTEXT", not_null=True,
            comentario="Cuándo y cómo debe usar la IA esta imagen concreta en el informe"),
    Columna(nombre="imagen", tipo="BLOB", not_null=True,
            comentario="Contenido binario de la imagen (BYTEA en Postgres) — sin almacén de "
                       "ficheros aparte, no hace falta para unos pocos logos/plantillas"),
    Columna(nombre="tipo_mime", tipo="VARCHAR", longitud=50, not_null=True,
            comentario='p.ej. "image/png"'),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP")),
]

INDICES_ESTILOS_IMAGENES = [
    Index(columnas=["id_estilo"]),
]

FKS_ESTILOS_IMAGENES = [
    ForeignKey(columna="id_estilo", referencia_tabla=NOMBRE_TABLA_ESTILOS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_ESTILOS_IMAGENES = Tabla(
    nombre=NOMBRE_TABLA_ESTILOS_IMAGENES, columnas=CAMPOS_ESTILOS_IMAGENES,
    indices=INDICES_ESTILOS_IMAGENES, foreign_keys=FKS_ESTILOS_IMAGENES,
    comentario="Imágenes fijas de un estilo (logo, plantilla...) — un estilo puede tener varias",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_ESTILOS, TABLA_ESTILOS_IMAGENES]
