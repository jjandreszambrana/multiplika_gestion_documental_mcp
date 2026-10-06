"""Conexión con el ERP del cliente — ver docs/gestion-documental.md →
"Ventas (CRM)" y docs/planificacion/crm.md (fase 2).

Dos vías, que rellenan las mismas tablas:
- Multiplika SIF, por su API con usuario y contraseña de un obligado
  (gd_erp_conexiones; la contraseña va en gd_credenciales, cifrada).
- Importación desde Excel/CSV (gd_erp_importaciones guarda el fichero
  mientras se revisa, y gd_erp_mapeos recuerda qué columna es qué).

El ERP manda en clientes (gd_entidades, por código o NIF) y facturas
(gd_erp_facturas, solo la cabecera: sin líneas). La GD nunca borra nada
de lo que viene del ERP.

Sin FKs hacia credenciales y conexiones, como gd_activos_digitales: borrar
una credencial no debe llevarse el rastro de lo importado."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_entidades import NOMBRE_TABLA_ENTIDADES

NOMBRE_TABLA_CONEXIONES = "gd_erp_conexiones"
NOMBRE_TABLA_FACTURAS = "gd_erp_facturas"
NOMBRE_TABLA_IMPORTACIONES = "gd_erp_importaciones"
NOMBRE_TABLA_MAPEOS = "gd_erp_mapeos"
__DB_NAME__ = get_db_name("gestion_documental")

PLATAFORMAS_ERP = ["multiplika_sif"]
ORIGENES = ["sif", "excel"]
OBJETOS_IMPORTACION = ["clientes", "facturas", "cobros"]
ESTADOS_IMPORTACION = ["pendiente", "aplicada", "descartada", "fallida"]

TABLA_CONEXIONES = Tabla(
    nombre=NOMBRE_TABLA_CONEXIONES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="nombre", tipo="VARCHAR", longitud=150, not_null=True),
        Columna(nombre="plataforma", tipo="VARCHAR", longitud=30, not_null=True, default="multiplika_sif"),
        Columna(nombre="url", tipo="VARCHAR", longitud=255, not_null=True,
                comentario="Dirección de SIF, p.ej. https://sif2.multiplika.net"),
        Columna(nombre="id_credencial", tipo="INT", not_null=True,
                comentario="→ gd_credenciales.id: usuario y contraseña del obligado"),
        Columna(nombre="id_obligado", tipo="INT", comentario="Si falta, se saca de /usuarios/me al probar"),
        Columna(nombre="activa", tipo="BOOLEAN", not_null=True, default=True,
                comentario="False = no se sincroniza cada noche"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="sin_probar",
                comentario="sin_probar, ok o error"),
        Columna(nombre="ultimo_error", tipo="MEDIUMTEXT"),
        Columna(nombre="fecha_ultima_sync", tipo="TIMESTAMP", comentario="Hora de Madrid"),
        Columna(nombre="fecha_ultimo_intento", tipo="TIMESTAMP",
                comentario="Última pasada nocturna, saliera bien o mal: una que falla no se repite cada minuto"),
        Columna(nombre="resumen_ultima_sync", tipo="MEDIUMTEXT"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
    ],
    comentario="Conexiones con el ERP (Multiplika SIF)",
    db_name=__DB_NAME__,
)

TABLA_FACTURAS = Tabla(
    nombre=NOMBRE_TABLA_FACTURAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="origen", tipo="VARCHAR", longitud=10, not_null=True, comentario="sif o excel"),
        Columna(nombre="id_conexion", tipo="INT", comentario="→ gd_erp_conexiones.id (solo sif)"),
        Columna(nombre="id_externo", tipo="VARCHAR", longitud=100,
                comentario="Id de la factura en SIF, para pedir sus líneas en vivo"),
        Columna(nombre="numero", tipo="VARCHAR", longitud=100, not_null=True),
        Columna(nombre="fecha", tipo="DATE", not_null=True),
        Columna(nombre="id_entidad", tipo="INT", comentario="→ gd_entidades.id. NULL si no se supo de quién es"),
        Columna(nombre="nif_cliente", tipo="VARCHAR", longitud=20),
        Columna(nombre="nombre_cliente", tipo="VARCHAR", longitud=255),
        Columna(nombre="base", tipo="NUMERIC", precision=14, escala=2),
        Columna(nombre="total", tipo="NUMERIC", precision=14, escala=2, not_null=True),
        Columna(nombre="pendiente_cobro", tipo="NUMERIC", precision=14, escala=2,
                comentario="NULL = no se sabe (el Excel no lo traía)"),
        Columna(nombre="anulada", tipo="BOOLEAN", not_null=True, default=False),
        Columna(nombre="fecha_actualizacion", tipo="TIMESTAMP", not_null=True, comentario="Hora de Madrid"),
    ],
    indices=[
        Index(columnas=["origen", "numero", "fecha"], unico=True, nombre="gd_erp_facturas_numero_uk"),
        Index(columnas=["id_entidad", "fecha"], nombre="gd_erp_facturas_entidad_idx"),
    ],
    foreign_keys=[
        ForeignKey(columna="id_entidad", referencia_tabla=NOMBRE_TABLA_ENTIDADES,
                   referencia_columna="id", on_delete="SET NULL"),
    ],
    comentario="Cabeceras de las facturas del ERP (sin líneas)",
    db_name=__DB_NAME__,
)

TABLA_MAPEOS = Tabla(
    nombre=NOMBRE_TABLA_MAPEOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="objeto", tipo="VARCHAR", longitud=20, not_null=True, comentario="clientes, facturas o cobros"),
        Columna(nombre="huella_cabeceras", tipo="VARCHAR", longitud=64, not_null=True,
                comentario="Huella de las cabeceras del fichero: si coinciden, se reaprovecha el mapeo"),
        Columna(nombre="cabeceras", tipo="MEDIUMTEXT", not_null=True, comentario="JSON: las cabeceras tal cual"),
        Columna(nombre="columnas", tipo="MEDIUMTEXT", not_null=True,
                comentario="JSON: campo de la GD -> índice de la columna del fichero"),
        Columna(nombre="formato_fecha", tipo="VARCHAR", longitud=20, not_null=True, default="dd/mm/aaaa"),
        Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, comentario="Hora de Madrid"),
    ],
    indices=[Index(columnas=["objeto", "huella_cabeceras"], unico=True, nombre="gd_erp_mapeos_uk")],
    comentario="Qué columna del Excel de cada ERP es cada campo",
    db_name=__DB_NAME__,
)

TABLA_IMPORTACIONES = Tabla(
    nombre=NOMBRE_TABLA_IMPORTACIONES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="objeto", tipo="VARCHAR", longitud=20, not_null=True),
        Columna(nombre="nombre_fichero", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="archivo", tipo="BLOB", comentario="El fichero; se vacía al aplicarla o descartarla"),
        Columna(nombre="todos_los_clientes", tipo="BOOLEAN", not_null=True, default=False,
                comentario="Solo clientes: los que no vengan se marcan baja_erp"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="pendiente"),
        Columna(nombre="resumen", tipo="MEDIUMTEXT", comentario="JSON: creados, actualizados, errores..."),
        Columna(nombre="quien", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, comentario="Hora de Madrid"),
        Columna(nombre="fecha_aplicada", tipo="TIMESTAMP"),
    ],
    indices=[Index(columnas=["fecha"], nombre="gd_erp_importaciones_fecha_idx")],
    comentario="Importaciones desde Excel: el fichero mientras se revisa y el resumen al aplicarla",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CONEXIONES, TABLA_FACTURAS, TABLA_MAPEOS, TABLA_IMPORTACIONES]
