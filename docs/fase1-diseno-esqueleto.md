# Fase 1 — Diseño del esqueleto + esquema

Código de referencia para la Fase 1 del [plan](gestion-documental.md), siguiendo
`guia_nuevo_proyecto.md` del core. Recordatorio de la nota de proceso: esto es
diseño/código de referencia — la implementación real en el repo la hace el
usuario desde VS Code.

## Estructura

```
multiplika_gestion_documental_mcp/
├── database/
│   ├── dependencias/
│   │   ├── _dep_configuracion.py
│   │   ├── _dep_documentos.py
│   │   ├── _dep_versiones.py
│   │   └── _dep_chunks.py
│   └── update_db.py
└── mcp_server/
    └── herramientas/        # Fase 2+
```

## `mtpk-postgres` v0.1.2 — soporte nativo confirmado

La v0.1.1 tenía tres huecos frente a lo que pide este esquema (columna
`VECTOR(n)`, índices `GIN`/`HNSW`, e introspección de columnas `vector`). La
v0.1.2 ya los resuelve de forma nativa — verificado en el código:

- `Columna(tipo="VECTOR", longitud=n)` genera `VECTOR(n)` directamente, sin
  truco de string.
- `Index(columnas=[...], metodo="gin"|"hnsw"|"ivfflat", opclass=..., with_opciones=...)`
  genera `CREATE INDEX ... USING <metodo> (...)`, con clase de operador y
  `WITH (...)` opcionales.
- `obtener_columnas_postgres` ahora reconoce las columnas `vector` por su
  `udt_name` y reconstruye la dimensión leyendo el catálogo (`pg_attribute`),
  así que `update_db.py` no las confunde con una columna cambiada en cada
  ejecución.

Las `_dep_*.py` de abajo ya usan esta sintaxis nativa — no hace falta ningún
SQL suelto para los índices especiales.

Una precisión que sigue aplicando sobre el propio plan: `gd_configuracion.
dimension_embedding` documenta qué dimensión usa el cliente, pero la columna
`gd_chunks.embedding` tiene su dimensión fija de fábrica en el `CREATE TABLE`
(pgvector no admite dimensión dinámica por fila). Cambiar de proveedor de
embedding a otro con distinta dimensión no es un cambio de configuración en
caliente: exige migrar la columna (`ALTER ... TYPE vector(n)`) o recrear
`gd_chunks` y regenerar los embeddings — coherente con el backfill ya
previsto en el plan para cambiar de modo `fulltext` a `semantico`, pero es un
paso más si además cambia la dimensión.

## `database/dependencias/_dep_configuracion.py`

```python
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
```

## `database/dependencias/_dep_documentos.py`

```python
from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_DOCUMENTOS = "gd_documentos"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_DOCUMENTOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del documento"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre/referencia corta para identificar el documento"),
    Columna(nombre="tipo_documento", tipo="ENUM",
            enum_opciones=["factura", "certificado", "contrato", "informe", "otro"],
            not_null=True, comentario="Tipo de documento, elegido por el usuario al guardarlo"),
    Columna(nombre="todas_versiones_buscables", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Si es False (por defecto), solo la versión vigente entra en las búsquedas"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True,
            comentario="Fecha de alta del documento en el sistema"),
]

INDICES_DOCUMENTOS = [
    Index(columnas=["nombre"]),
]

TABLA_DOCUMENTOS = Tabla(
    nombre=NOMBRE_TABLA_DOCUMENTOS, columnas=CAMPOS_DOCUMENTOS, indices=INDICES_DOCUMENTOS,
    comentario="Documentos del cliente (cada uno con 1+ versiones en gd_versiones)", db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_DOCUMENTOS]
```

## `database/dependencias/_dep_versiones.py`

```python
from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from database.dependencias._dep_documentos import NOMBRE_TABLA_DOCUMENTOS

NOMBRE_TABLA_VERSIONES = "gd_versiones"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_VERSIONES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la versión"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento al que pertenece esta versión"),
    Columna(nombre="vigente", tipo="BOOLEAN", not_null=True, default=True,
            comentario="True solo en la última versión de cada documento"),
    Columna(nombre="markdown_original", tipo="MEDIUMTEXT", not_null=True,
            comentario="Markdown tal como lo generó la IA la primera vez, nunca se sobrescribe"),
    Columna(nombre="markdown_actual", tipo="MEDIUMTEXT", not_null=True,
            comentario="Markdown vigente: igual al original o corregido a mano"),
    Columna(nombre="revisado_manualmente", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True si markdown_actual fue corregido a mano tras la generación"),
    Columna(nombre="tsvector_actual", tipo="TSVECTOR",
            generado="to_tsvector('spanish', markdown_actual)",
            comentario="Índice fulltext generado a partir de markdown_actual"),
    Columna(nombre="fecha_documento", tipo="DATE", not_null=True,
            comentario="Fecha del propio documento (no la de subida)"),
    Columna(nombre="fecha_subida", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True,
            comentario="Fecha en que se subió/generó esta versión"),
]

INDICES_VERSIONES = [
    Index(columnas=["id_documento", "vigente"]),
    Index(columnas=["tsvector_actual"], metodo="gin"),
]

FKS_VERSIONES = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_VERSIONES = Tabla(
    nombre=NOMBRE_TABLA_VERSIONES, columnas=CAMPOS_VERSIONES, indices=INDICES_VERSIONES,
    foreign_keys=FKS_VERSIONES,
    comentario="Historial completo de versiones de cada documento, sin purga", db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_VERSIONES]
```


## `database/dependencias/_dep_chunks.py`

```python
from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla

from database.dependencias._dep_versiones import NOMBRE_TABLA_VERSIONES

NOMBRE_TABLA_CHUNKS = "gd_chunks"
__DB_NAME__ = get_db_name("gestion_documental")

# Dimensión de fábrica de la plataforma (openai:text-embedding-3-small).
# Fija en la columna por limitación de pgvector: ver nota en fase1-diseno-esqueleto.md
# sobre qué implica cambiarla para un cliente concreto.
DIMENSION_EMBEDDING_DEFAULT = 1536

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
```

## `database/update_db.py`

```python
#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Aplica el esquema de gestión documental sobre la base física de un cliente.

Uso:
    python update_db.py <alias_cliente>                  # aplicar
    python update_db.py <alias_cliente> --permitir-drop   # + eliminar índices/FKs huérfanos

<alias_cliente> es el slug del proyecto en mcpc_proyectos (1 BD por cliente:
hay que ejecutar esto una vez por cada cliente dado de alta, no una sola vez
para toda la plataforma).
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mtpk_postgres.core_sync import ManagerDB

from database.config_db import get_db_config
from database.dependencias._dep_configuracion import TABLA_CONFIGURACION
from database.dependencias._dep_documentos import TABLA_DOCUMENTOS
from database.dependencias._dep_versiones import TABLA_VERSIONES
from database.dependencias._dep_chunks import TABLA_CHUNKS

TABLAS = [
    TABLA_CONFIGURACION,
    TABLA_DOCUMENTOS,
    TABLA_VERSIONES,
    TABLA_CHUNKS,
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("alias", help="Slug del proyecto de cliente (mcpc_proyectos)")
    parser.add_argument("--permitir-drop", action="store_true")
    args = parser.parse_args()

    manager = ManagerDB(**get_db_config(args.alias))

    manager.query("CREATE EXTENSION IF NOT EXISTS vector")

    for tabla in TABLAS:
        manager.add_tabla(tabla)
    resultado = manager.crear_todo(permitir_drop=args.permitir_drop)
    manager.cerrar()

    if "error" in resultado:
        print("\nError aplicando el esquema:")
        print(resultado["error"])
        sys.exit(1)


if __name__ == "__main__":
    main()
```

## Estado de la prueba end-to-end (2026-09-06)

Código ya creado en el repo real (`database/dependencias/*.py`, `database/config_db.py`
de desarrollo local, `database/update_db.py`) y probado contra una Postgres real:
se instaló Postgres 16 + `pgvector` en `facturae.multiplika.net` (mismo servidor
que `mcp-d.multiplika.net`, vía el repo oficial PGDG — Debian 11 no trae pgvector
en sus repos), con una base `gd_test` de pruebas, accedida por túnel SSH.

**Bug bloqueante encontrado en `mtpk-postgres` 0.1.2** (no es un problema del
esquema): `ManagerDB.aplicar_cambios()` crea las tablas y, en la misma llamada,
sin haber salido aún de la transacción, también ejecuta
`comparar_generar_alter()` sobre esas mismas tablas recién creadas — como si ya
existieran de antes. La comparación da un falso positivo (probablemente por
cómo se leen/comparan `default`/tipo tras el `CREATE`) y genera un `ALTER
COLUMN` de más. En `gd_versiones` ese `ALTER` intenta cambiar el tipo de
`markdown_actual`, y Postgres lo rechaza porque `tsvector_actual` es una
columna generada que depende de ella:

```
psycopg.errors.FeatureNotSupported: no se puede alterar el tipo de una columna
usada por una columna generada
DETAIL: La columna «markdown_actual» es usada por la columna generada «tsvector_actual».
```

Al ir todo en una única transacción, el error deshace también la creación de
las tablas que sí estaban bien. Con esto, hoy `update_db.py` no puede aplicar
el esquema completo sobre una base nueva mientras alguna tabla tenga una
columna generada (nuestro caso: `gd_versiones.tsvector_actual`).

Pendiente de tu parte antes de reintentar la prueba: que `aplicar_cambios()`
no vuelva a comparar/alterar una tabla que acaba de crear en la misma
ejecución (o que aplique cada tabla en su propia sub-transacción para que un
falso positivo en una no arrastre a las demás).

## Pendiente al pasar esto a código real

- Re-lanzar `update_db.py` contra `gd_test` en cuanto el bug de arriba esté
  arreglado (túnel SSH y base de pruebas ya quedaron montados en
  `facturae.multiplika.net`).
- `get_db_name("gestion_documental")` usa un alias de ejemplo — en real es el
  slug de cada proyecto de cliente dado de alta en `mcpc_proyectos` (ver
  `guia_nuevo_proyecto.md`, paso 1).
