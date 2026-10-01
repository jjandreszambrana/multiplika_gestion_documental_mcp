"""Seguimiento: en qué punto está una nota del bloc, un documento o una
nota de un documento (pendiente, en curso, realizado, aplazado), quién se
encarga y, si está aplazado, hasta cuándo — ver docs/gestion-documental.md
→ "Seguimiento" y docs/planificacion/seguimiento.md.

Una sola tabla para las tres cosas, con una columna (y su FK con CASCADE)
por cada una: exactamente una de las tres va rellena (lo comprueba
_mod_seguimiento.py). "Sin estado" es no tener fila: lo que nunca se ha
marcado no entra en el seguimiento.

El aplazado crea un aviso programado normal (gd_programaciones) que salta
el día elegido; cuando salta, el elemento vuelve a "pendiente" (ver
_saltar en _mod_programaciones.py). `id_programacion` es ese aviso.

`id_usuario_responsable` sin FK: los usuarios viven en la base de control
— mismo criterio que gd_programaciones y gd_bloc_notas."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla

from ._dep_bloc_notas import NOMBRE_TABLA_BLOC_NOTAS
from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ._dep_notas import NOMBRE_TABLA_NOTAS
from ._dep_programaciones import NOMBRE_TABLA_PROGRAMACIONES

NOMBRE_TABLA_SEGUIMIENTO = "gd_seguimiento"
NOMBRE_TABLA_SEGUIMIENTO_RESUMENES = "gd_seguimiento_resumenes"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_SEGUIMIENTO = ["pendiente", "en_curso", "realizado", "aplazado"]

#: tipo de elemento -> columna de gd_seguimiento que lo apunta
COLUMNA_POR_TIPO = {"nota_bloc": "id_nota_bloc", "documento": "id_documento", "nota_documento": "id_nota"}

CAMPOS_SEGUIMIENTO = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
    Columna(nombre="id_nota_bloc", tipo="INT", comentario="→ gd_bloc_notas.id"),
    Columna(nombre="id_documento", tipo="INT", comentario="→ gd_documentos.id"),
    Columna(nombre="id_nota", tipo="INT", comentario="→ gd_notas.id (nota de seguimiento de un documento)"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, enum_opciones=ESTADOS_SEGUIMIENTO),
    Columna(nombre="id_usuario_responsable", tipo="INT",
            comentario="Quién se encarga (→ mcpc_usuarios.id, sin FK entre bases). NULL = nadie en "
                       "concreto: entra en el resumen diario de todos los que lo ven"),
    Columna(nombre="aplazado_hasta", tipo="TIMESTAMP",
            comentario="Solo si estado = aplazado: cuándo vuelve a pendiente. Hora de Madrid"),
    Columna(nombre="id_programacion", tipo="INT",
            comentario="Aviso programado que se creó al aplazarlo (→ gd_programaciones.id)"),
    Columna(nombre="fecha_cambio", tipo="TIMESTAMP", not_null=True, comentario="Último cambio. Hora de Madrid"),
    Columna(nombre="cambiado_por", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Quién lo cambió por última vez — copia del nombre"),
]

TABLA_SEGUIMIENTO = Tabla(
    nombre=NOMBRE_TABLA_SEGUIMIENTO, columnas=CAMPOS_SEGUIMIENTO,
    # Nombres propios: los automáticos chocan con los de otras tablas
    indices=[
        Index(columnas=["id_nota_bloc"], unico=True, nombre="gd_seguimiento_nota_bloc_uk"),
        Index(columnas=["id_documento"], unico=True, nombre="gd_seguimiento_documento_uk"),
        Index(columnas=["id_nota"], unico=True, nombre="gd_seguimiento_nota_uk"),
        Index(columnas=["estado", "id_usuario_responsable"], nombre="gd_seguimiento_estado_idx"),
        Index(columnas=["id_programacion"], nombre="gd_seguimiento_programacion_idx"),
    ],
    foreign_keys=[
        ForeignKey(columna="id_nota_bloc", referencia_tabla=NOMBRE_TABLA_BLOC_NOTAS,
                   referencia_columna="id", on_delete="CASCADE"),
        ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
                   referencia_columna="id", on_delete="CASCADE"),
        ForeignKey(columna="id_nota", referencia_tabla=NOMBRE_TABLA_NOTAS,
                   referencia_columna="id", on_delete="CASCADE"),
        ForeignKey(columna="id_programacion", referencia_tabla=NOMBRE_TABLA_PROGRAMACIONES,
                   referencia_columna="id", on_delete="SET NULL"),
    ],
    comentario="Estado de seguimiento de notas del bloc, documentos y notas de documentos",
    db_name=__DB_NAME__,
)

# Una fila por día con resumen mandado: la pasada que la inserta es la que
# lo manda (el cron corre cada minuto y no debe repetirlo).
TABLA_SEGUIMIENTO_RESUMENES = Tabla(
    nombre=NOMBRE_TABLA_SEGUIMIENTO_RESUMENES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="fecha", tipo="DATE", not_null=True, comentario="Día del resumen"),
        Columna(nombre="fecha_envio", tipo="TIMESTAMP", not_null=True, comentario="Hora de Madrid"),
        Columna(nombre="resumen", tipo="MEDIUMTEXT", comentario="A quién le llegó y cuántos elementos"),
    ],
    indices=[Index(columnas=["fecha"], unico=True, nombre="gd_seguimiento_resumenes_fecha_uk")],
    comentario="Resúmenes diarios de seguimiento ya mandados",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_SEGUIMIENTO, TABLA_SEGUIMIENTO_RESUMENES]
