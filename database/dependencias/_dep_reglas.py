"""Reglas de comportamiento — ver docs/gestion-documental.md → "Reglas de
comportamiento". Cómo tiene que actuar la IA en esta GD (datos fijos de la
empresa, estilo, criterios de trabajo), separado de los documentos, que son
el contenido. Una sola tabla sin FKs: se puede aplicar en un servidor real
sin registrar ninguna otra tabla.

`ambito` del modelo de la planificación NO es una columna: una regla de esta
tabla es siempre `propia`; las `heredada` se piden en vivo a las GDs
centrales enlazadas (igual que los documentos, que tampoco se copian — ver
"GDs enlazadas"), así no hay nada que sincronizar ni que quede obsoleto."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_REGLAS = "gd_reglas"
__DB_NAME__ = get_db_name("gestion_documental")

AMBITO_PROPIA = "propia"
AMBITO_HEREDADA = "heredada"

#: Se añade siempre al bloque de reglas globales, tenga el cliente reglas o
#: no: es lo que le dice a la IA que existe el nivel 2 (reglas por categoría
#: bajo demanda) y cómo se resuelven los conflictos.
REGLA_META = (
    "Las reglas globales de esta gestión documental ya están en tu contexto, cada una con su nombre "
    "delante. Antes de empezar cualquier tarea especializada (redactar un tipo de informe, preparar "
    "un envío, facturar...), carga las reglas que hagan falta con obtener_reglas_gd: por categoría "
    "si vas por el tipo de tarea, o por nombre (nombres=[...]) cuando una regla global te remita a "
    "otras por su nombre. listar_reglas_gd() te dice qué reglas y categorías hay. Si una regla de "
    "esta gestión documental contradice a una heredada de una GD central, manda la de esta gestión "
    "documental."
)

CAMPOS_REGLAS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la regla"),
    # `unique=True` en la columna, no un Index(unico=True): el ORM nombra los
    # índices solo por sus columnas ("nombre_idx"), y ese nombre ya lo tiene
    # gd_documentos en el mismo esquema — el índice no llegaba a crearse (los
    # nombres de índice son únicos por esquema en Postgres). Como restricción
    # de columna, Postgres la llama gd_reglas_nombre_key y no choca con nada.
    Columna(nombre="nombre", tipo="VARCHAR", longitud=100, not_null=True, unique=True,
            comentario='Cómo se llama esta regla, p.ej. "boletines_replicas": obligatorio, sin '
                       "repetir y renombrable (igual que el nombre de una API key). Sirve para que "
                       "una regla global remita a otra por su nombre en su propio texto y la IA "
                       "pueda cargarla con obtener_reglas_gd(nombres=[...]) — el nombre va delante "
                       "de cada regla en el bloque que recibe la IA"),
    Columna(nombre="texto", tipo="MEDIUMTEXT", not_null=True,
            comentario="La instrucción, redactada para la IA y en una sola idea por regla "
                       "(cuanto más corta, menos cuesta inyectarla en cada sesión)"),
    Columna(nombre="categoria", tipo="VARCHAR", longitud=100, not_null=True,
            comentario='Agrupa reglas por tipo de tarea, p.ej. "datos_empresa", "boletines", '
                       '"correo", "estilo", "facturacion" — texto libre, catálogo abierto igual '
                       "que gd_scripts.lenguaje, no una lista cerrada"),
    Columna(nombre="es_global", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True = se inyecta en el contexto al abrir sesión, sin que la IA tenga que "
                       "pedirla (nivel 1). Solo para lo que hace falta en casi cualquier tarea; el "
                       'resto se carga por categoría con obtener_reglas_gd. "global" a secas no vale '
                       "de nombre: es palabra reservada en Python y no puede ser parámetro de una tool"),
    Columna(nombre="prioridad", tipo="INT", not_null=True, default=0,
            comentario="Orden en que se le presentan a la IA dentro de su categoría: primero las de "
                       "número más alto. Para poner delante lo que no debe pasarse por alto"),
    Columna(nombre="activa", tipo="BOOLEAN", not_null=True, default=True,
            comentario="Permite desactivar una regla sin borrarla (deja de inyectarse y de salir en "
                       "obtener_reglas_gd, pero se puede recuperar)"),
    Columna(nombre="reservada", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Igual que gd_documentos.reservado: no se comparte con las GDs enlazadas que "
                       "nos consultan. Una regla suele llevar datos de la empresa (correos, "
                       "criterios internos), así que esto es lo que evita que salgan hacia otra"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_REGLAS = [
    Index(columnas=["categoria"]),
    Index(columnas=["es_global"]),
]

TABLA_REGLAS = Tabla(
    nombre=NOMBRE_TABLA_REGLAS, columnas=CAMPOS_REGLAS, indices=INDICES_REGLAS,
    comentario="Instrucciones de comportamiento para la IA en esta gestión documental",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_REGLAS]
