"""Bloc de notas: notas sueltas de los usuarios (una reunión, una llamada,
una idea) que se enlazan entre sí, con documentos, con registros de
datos y con entidades — ver docs/gestion-documental.md → "Bloc de notas" y
docs/planificacion/bloc-de-notas.md.

Nada que ver con gd_notas (comentarios, observaciones e incidencias que
cuelgan siempre de un documento): una nota del bloc existe por sí misma.

Quién ve cada nota lo decide su autor (`visibilidad`): solo él, personas
concretas (gd_bloc_notas_personas) o todos los del proyecto. Los usuarios
viven en la base de control, así que `id_usuario_autor` y
gd_bloc_notas_personas.id_usuario van sin FK — mismo criterio que
gd_actividad y gd_programaciones.

Horas en hora de Madrid sin zona (TIMESTAMP), como gd_programaciones:
se rellenan con `ahora_madrid()` (database/modelos/_repeticiones.py)."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ._dep_entidades import NOMBRE_TABLA_ENTIDADES
from ._dep_registros import NOMBRE_TABLA_REGISTROS

NOMBRE_TABLA_BLOC_NOTAS = "gd_bloc_notas"
NOMBRE_TABLA_BLOC_NOTAS_PERSONAS = "gd_bloc_notas_personas"
NOMBRE_TABLA_BLOC_NOTAS_ETIQUETAS = "gd_bloc_notas_etiquetas"
NOMBRE_TABLA_BLOC_NOTAS_RELACIONES = "gd_bloc_notas_relaciones"
NOMBRE_TABLA_BLOC_NOTAS_DOCUMENTOS = "gd_bloc_notas_documentos"
NOMBRE_TABLA_BLOC_NOTAS_REGISTROS = "gd_bloc_notas_registros"
NOMBRE_TABLA_BLOC_NOTAS_ENTIDADES = "gd_bloc_notas_entidades"
__DB_NAME__ = get_db_name("gestion_documental")

VISIBILIDADES = ["privada", "personas", "todos"]

#: Distintivo de color de una nota: nombres de color de Mantine (el panel
#: los pinta tal cual). Para la IA, en español: ver COLORES_ES.
COLORES = ["red", "orange", "yellow", "green", "blue", "grape", "pink", "gray"]
COLORES_ES = {
    "rojo": "red", "naranja": "orange", "amarillo": "yellow", "verde": "green",
    "azul": "blue", "morado": "grape", "rosa": "pink", "gris": "gray",
}

CAMPOS_BLOC_NOTAS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la nota"),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True,
            comentario="Fecha y hora a la que se refiere la nota (la reunión, la llamada) — "
                       "editable; por defecto, cuando se crea. Hora de Madrid"),
    Columna(nombre="titulo", tipo="VARCHAR", longitud=255, not_null=True),
    Columna(nombre="descripcion", tipo="VARCHAR", longitud=500,
            comentario="Resumen de una línea, opcional — lo que se lee en los listados"),
    Columna(nombre="contenido", tipo="MEDIUMTEXT", comentario="Texto de la nota, en markdown"),
    Columna(nombre="visibilidad", tipo="VARCHAR", longitud=20, not_null=True, default="todos",
            enum_opciones=VISIBILIDADES,
            comentario="privada = solo el autor; personas = el autor y las de "
                       "gd_bloc_notas_personas; todos = cualquiera del proyecto"),
    Columna(nombre="color", tipo="VARCHAR", longitud=20, enum_opciones=COLORES,
            comentario="Distintivo de color en el panel, opcional — NULL = sin color"),
    Columna(nombre="fijada", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Sale arriba en los listados, para todos los que la ven"),
    Columna(nombre="archivada", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Fuera de los listados normales sin borrarla"),
    Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre de la persona o de la API key — copia, como en gd_actividad"),
    Columna(nombre="id_usuario_autor", tipo="INT",
            comentario="→ mcpc_usuarios.id, sin FK entre bases. NULL si la creó una API key de "
                       "todos o soporte: entonces la nota es de todos y nadie es su dueño"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, protegido_actualizar=True,
            comentario="Hora de Madrid"),
    Columna(nombre="fecha_modificacion", tipo="TIMESTAMP", not_null=True, comentario="Hora de Madrid"),
    Columna(nombre="modificado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Quién la cambió por última vez — copia del nombre"),
]

# Nombres propios en todos los índices: los automáticos chocan con los de
# otras tablas (en Postgres son únicos por esquema).
INDICES_BLOC_NOTAS = [
    Index(columnas=["archivada", "fijada", "fecha"], nombre="gd_bloc_notas_listado_idx"),
    Index(columnas=["id_usuario_autor"], nombre="gd_bloc_notas_autor_idx"),
]

TABLA_BLOC_NOTAS = Tabla(
    nombre=NOMBRE_TABLA_BLOC_NOTAS, columnas=CAMPOS_BLOC_NOTAS, indices=INDICES_BLOC_NOTAS,
    comentario="Bloc de notas: notas sueltas de los usuarios, enlazables entre sí y con "
               "documentos, registros y entidades",
    db_name=__DB_NAME__,
)


def _fk_nota(columna: str = "id_nota") -> ForeignKey:
    return ForeignKey(columna=columna, referencia_tabla=NOMBRE_TABLA_BLOC_NOTAS,
                      referencia_columna="id", on_delete="CASCADE")


TABLA_BLOC_NOTAS_PERSONAS = Tabla(
    nombre=NOMBRE_TABLA_BLOC_NOTAS_PERSONAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_nota", tipo="INT", not_null=True, comentario="→ gd_bloc_notas.id"),
        Columna(nombre="id_usuario", tipo="INT", not_null=True,
                comentario="→ mcpc_usuarios.id, sin FK entre bases"),
    ],
    indices=[
        Index(columnas=["id_nota", "id_usuario"], unico=True, nombre="gd_bloc_notas_personas_uk"),
        Index(columnas=["id_usuario"], nombre="gd_bloc_notas_personas_usuario_idx"),
    ],
    foreign_keys=[_fk_nota()],
    comentario="Con quién se comparte una nota de visibilidad 'personas'",
    db_name=__DB_NAME__,
)

TABLA_BLOC_NOTAS_ETIQUETAS = Tabla(
    nombre=NOMBRE_TABLA_BLOC_NOTAS_ETIQUETAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_nota", tipo="INT", not_null=True, comentario="→ gd_bloc_notas.id"),
        Columna(nombre="etiqueta", tipo="VARCHAR", longitud=100, not_null=True,
                comentario="Texto libre. Sin repetir en la misma nota (sin distinguir mayúsculas, "
                           "se comprueba en el CRUD), y si ya existe en otra nota se reutiliza "
                           "como está escrita allí"),
    ],
    indices=[
        Index(columnas=["id_nota", "etiqueta"], unico=True, nombre="gd_bloc_notas_etiquetas_uk"),
        Index(columnas=["etiqueta"], nombre="gd_bloc_notas_etiquetas_etiqueta_idx"),
    ],
    foreign_keys=[_fk_nota()],
    comentario="Etiquetas de cada nota del bloc",
    db_name=__DB_NAME__,
)

# Enlace entre dos notas, sin dirección: se guarda una sola fila con el id
# menor en id_nota_a, así "A con B" y "B con A" son la misma.
TABLA_BLOC_NOTAS_RELACIONES = Tabla(
    nombre=NOMBRE_TABLA_BLOC_NOTAS_RELACIONES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_nota_a", tipo="INT", not_null=True, comentario="→ gd_bloc_notas.id, el menor"),
        Columna(nombre="id_nota_b", tipo="INT", not_null=True, comentario="→ gd_bloc_notas.id, el mayor"),
    ],
    indices=[
        Index(columnas=["id_nota_a", "id_nota_b"], unico=True, nombre="gd_bloc_notas_relaciones_uk"),
        Index(columnas=["id_nota_b"], nombre="gd_bloc_notas_relaciones_b_idx"),
    ],
    foreign_keys=[_fk_nota("id_nota_a"), _fk_nota("id_nota_b")],
    comentario="Notas del bloc enlazadas entre sí",
    db_name=__DB_NAME__,
)

TABLA_BLOC_NOTAS_DOCUMENTOS = Tabla(
    nombre=NOMBRE_TABLA_BLOC_NOTAS_DOCUMENTOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_nota", tipo="INT", not_null=True, comentario="→ gd_bloc_notas.id"),
        Columna(nombre="id_documento", tipo="INT", not_null=True, comentario="→ gd_documentos.id"),
    ],
    indices=[
        Index(columnas=["id_nota", "id_documento"], unico=True, nombre="gd_bloc_notas_documentos_uk"),
        Index(columnas=["id_documento"], nombre="gd_bloc_notas_documentos_doc_idx"),
    ],
    foreign_keys=[
        _fk_nota(),
        ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
                   referencia_columna="id", on_delete="CASCADE"),
    ],
    comentario="Documentos enlazados a cada nota del bloc",
    db_name=__DB_NAME__,
)

TABLA_BLOC_NOTAS_REGISTROS = Tabla(
    nombre=NOMBRE_TABLA_BLOC_NOTAS_REGISTROS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_nota", tipo="INT", not_null=True, comentario="→ gd_bloc_notas.id"),
        Columna(nombre="id_registro", tipo="INT", not_null=True, comentario="→ gd_registros.id"),
    ],
    indices=[
        Index(columnas=["id_nota", "id_registro"], unico=True, nombre="gd_bloc_notas_registros_uk"),
        Index(columnas=["id_registro"], nombre="gd_bloc_notas_registros_reg_idx"),
    ],
    foreign_keys=[
        _fk_nota(),
        ForeignKey(columna="id_registro", referencia_tabla=NOMBRE_TABLA_REGISTROS,
                   referencia_columna="id", on_delete="CASCADE"),
    ],
    comentario="Registros de datos enlazados a cada nota del bloc",
    db_name=__DB_NAME__,
)

TABLA_BLOC_NOTAS_ENTIDADES = Tabla(
    nombre=NOMBRE_TABLA_BLOC_NOTAS_ENTIDADES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_nota", tipo="INT", not_null=True, comentario="→ gd_bloc_notas.id"),
        Columna(nombre="id_entidad", tipo="INT", not_null=True, comentario="→ gd_entidades.id"),
    ],
    indices=[
        Index(columnas=["id_nota", "id_entidad"], unico=True, nombre="gd_bloc_notas_entidades_uk"),
        Index(columnas=["id_entidad"], nombre="gd_bloc_notas_entidades_ent_idx"),
    ],
    foreign_keys=[
        _fk_nota(),
        ForeignKey(columna="id_entidad", referencia_tabla=NOMBRE_TABLA_ENTIDADES,
                   referencia_columna="id", on_delete="CASCADE"),
    ],
    comentario="Entidades (clientes, proveedores...) enlazadas a cada nota del bloc",
    db_name=__DB_NAME__,
)

__TABLAS__ = [
    TABLA_BLOC_NOTAS,
    TABLA_BLOC_NOTAS_PERSONAS,
    TABLA_BLOC_NOTAS_ETIQUETAS,
    TABLA_BLOC_NOTAS_RELACIONES,
    TABLA_BLOC_NOTAS_DOCUMENTOS,
    TABLA_BLOC_NOTAS_REGISTROS,
    TABLA_BLOC_NOTAS_ENTIDADES,
]
