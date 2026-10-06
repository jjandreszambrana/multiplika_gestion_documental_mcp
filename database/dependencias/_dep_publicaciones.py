"""Calendario editorial de redes sociales (fase 5 de webs y redes) — ver
docs/gestion-documental.md → "Webs y redes sociales".

Una publicación puede ir a varias redes (cada una es un activo de tipo
red_social). Circuito: borrador → pendiente de aprobar → aprobada → se
publica sola a su hora → publicada / parcial / error; se puede retirar
(deshacer: se borra de las redes). Sin FKs, como el resto de webs y redes.

gd_publicaciones_medios: enlaces públicos temporales a las imágenes de la GD
que usan las redes para descargarlas (Instagram y compañía no admiten subir
el archivo, piden una dirección). Caducan a los pocos días."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_PUBLICACIONES = "gd_publicaciones"
NOMBRE_TABLA_MEDIOS = "gd_publicaciones_medios"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_PUBLICACION = ["borrador", "pendiente", "aprobada", "publicando", "publicada", "parcial", "error", "cancelada",
                       "retirada"]

TABLA_PUBLICACIONES = Tabla(
    nombre=NOMBRE_TABLA_PUBLICACIONES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="titulo", tipo="VARCHAR", longitud=200, not_null=True, comentario="Nombre interno, para el calendario"),
        Columna(nombre="texto", tipo="MEDIUMTEXT", not_null=True, comentario="Lo que se publica"),
        Columna(nombre="textos_por_red", tipo="MEDIUMTEXT", comentario="JSON {id_activo: texto} si en alguna red va distinto"),
        Columna(nombre="ids_documentos", tipo="MEDIUMTEXT", comentario="JSON: documentos de la GD con las imágenes"),
        Columna(nombre="enlace", tipo="VARCHAR", longitud=1000, comentario="Enlace que acompaña, opcional"),
        Columna(nombre="ids_activos", tipo="MEDIUMTEXT", not_null=True, comentario="JSON: redes (activos) donde se publica"),
        Columna(nombre="fecha_prevista", tipo="TIMESTAMP", comentario="Cuándo se publica (hora de Madrid); NULL = en cuanto se apruebe"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, comentario="Ver ESTADOS_PUBLICACION"),
        Columna(nombre="resultados", tipo="MEDIUMTEXT", comentario="JSON {id_activo: {ok, id_red, url, error}}"),
        Columna(nombre="metricas", tipo="MEDIUMTEXT", comentario="JSON {id_activo: {...}}: alcance, me gusta, comentarios..."),
        Columna(nombre="fecha_metricas", tipo="TIMESTAMP"),
        Columna(nombre="creado_por", tipo="VARCHAR", longitud=150, not_null=True),
        Columna(nombre="via", tipo="VARCHAR", longitud=10, not_null=True, comentario="ia, chat o panel"),
        Columna(nombre="aprobado_por", tipo="VARCHAR", longitud=150),
        Columna(nombre="fecha_aprobacion", tipo="TIMESTAMP"),
        Columna(nombre="fecha_publicada", tipo="TIMESTAMP"),
        Columna(nombre="retirado_por", tipo="VARCHAR", longitud=150),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True),
    ],
    indices=[Index(columnas=["estado", "fecha_prevista"], nombre="gd_publicaciones_estado_fecha_idx")],
    comentario="Calendario editorial: publicaciones en redes sociales",
    db_name=__DB_NAME__,
)

TABLA_MEDIOS = Tabla(
    nombre=NOMBRE_TABLA_MEDIOS,
    columnas=[
        Columna(nombre="token", tipo="VARCHAR", longitud=64, primary_key=True),
        Columna(nombre="id_publicacion", tipo="INT", not_null=True),
        Columna(nombre="id_documento", tipo="INT", not_null=True),
        Columna(nombre="id_version", tipo="INT", not_null=True),
        Columna(nombre="caduca", tipo="TIMESTAMP", not_null=True),
    ],
    indices=[Index(columnas=["id_publicacion"], nombre="gd_publicaciones_medios_publicacion_idx")],
    comentario="Enlaces públicos temporales a las imágenes de una publicación",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_PUBLICACIONES, TABLA_MEDIOS]
