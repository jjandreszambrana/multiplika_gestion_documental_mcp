"""Conciliación bancaria — ver docs/planificacion/conciliacion-bancaria.md.

- gd_conciliaciones: un extracto subido (una cuenta y un periodo).
- gd_conciliacion_movimientos: cada línea del extracto con lo que se ha
  encontrado para ella y lo que decidió el contable.

La GD no escribe en el SIF: esta tabla es el resultado del trabajo y el
contable decide. Sin FKs hacia empresas ni documentos: borrar uno no debe
llevarse el rastro."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_CONCILIACIONES = "gd_conciliaciones"
NOMBRE_TABLA_CONCILIACION_MOVIMIENTOS = "gd_conciliacion_movimientos"
NOMBRE_TABLA_CUENTAS_BANCARIAS = "gd_cuentas_bancarias"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_MOVIMIENTO = ["sin_emparejar", "exacto", "dudoso", "asentado", "asiento_propuesto", "confirmado", "descartado"]

TABLA_CONCILIACIONES = Tabla(
    nombre=NOMBRE_TABLA_CONCILIACIONES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_empresa", tipo="INT", not_null=True, comentario="→ gd_conta_empresas.id (sin FK: se conserva)"),
        Columna(nombre="banco", tipo="VARCHAR", longitud=4, not_null=True),
        Columna(nombre="oficina", tipo="VARCHAR", longitud=4, not_null=True),
        Columna(nombre="cuenta", tipo="VARCHAR", longitud=10, not_null=True),
        Columna(nombre="titular", tipo="VARCHAR", longitud=20),
        Columna(nombre="divisa", tipo="VARCHAR", longitud=3, not_null=True, default="EUR"),
        Columna(nombre="fecha_desde", tipo="DATE", not_null=True),
        Columna(nombre="fecha_hasta", tipo="DATE", not_null=True),
        Columna(nombre="saldo_inicial", tipo="NUMERIC", precision=14, escala=2, not_null=True),
        Columna(nombre="saldo_final", tipo="NUMERIC", precision=14, escala=2, not_null=True),
        Columna(nombre="cuadra", tipo="BOOLEAN", not_null=True, default=True,
                comentario="Saldo inicial + movimientos = saldo final del propio extracto"),
        Columna(nombre="huella", tipo="VARCHAR", longitud=64, not_null=True,
                comentario="SHA-256 del contenido de esa cuenta: evita subir dos veces el mismo extracto"),
        Columna(nombre="id_documento", tipo="INT", comentario="Archivo del extracto en la GD, si se guardó"),
        Columna(nombre="creado_por", tipo="INT", comentario="Usuario de la GD que lo subió"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
    ],
    indices=[
        Index(columnas=["id_empresa", "huella"], unico=True, nombre="gd_conciliaciones_huella_idx"),
        Index(columnas=["id_empresa", "fecha_hasta"], nombre="gd_conciliaciones_empresa_idx"),
    ],
    comentario="Extractos bancarios subidos para conciliar",
    db_name=__DB_NAME__,
)

TABLA_CONCILIACION_MOVIMIENTOS = Tabla(
    nombre=NOMBRE_TABLA_CONCILIACION_MOVIMIENTOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_conciliacion", tipo="INT", not_null=True),
        Columna(nombre="orden", tipo="INT", not_null=True, comentario="Posición en el extracto"),
        Columna(nombre="fecha_operacion", tipo="DATE", not_null=True),
        Columna(nombre="fecha_valor", tipo="DATE", not_null=True),
        Columna(nombre="importe", tipo="NUMERIC", precision=14, escala=2, not_null=True,
                comentario="Con signo: negativo = cargo, positivo = abono"),
        Columna(nombre="concepto_comun", tipo="VARCHAR", longitud=2),
        Columna(nombre="concepto_propio", tipo="VARCHAR", longitud=3),
        Columna(nombre="numero_documento", tipo="VARCHAR", longitud=10),
        Columna(nombre="referencia1", tipo="VARCHAR", longitud=12),
        Columna(nombre="referencia2", tipo="VARCHAR", longitud=16),
        Columna(nombre="concepto", tipo="MEDIUMTEXT", comentario="Texto libre de los registros 23"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="sin_emparejar"),
        Columna(nombre="propuesta", tipo="MEDIUMTEXT",
                comentario="JSON: facturas candidatas, motivo y confianza"),
        Columna(nombre="decision", tipo="MEDIUMTEXT", comentario="JSON: lo que decidió el contable"),
        Columna(nombre="nota", tipo="MEDIUMTEXT"),
        Columna(nombre="revisado_por", tipo="INT"),
        Columna(nombre="fecha_revision", tipo="TIMESTAMP"),
    ],
    foreign_keys=[
        ForeignKey(columna="id_conciliacion", referencia_tabla=NOMBRE_TABLA_CONCILIACIONES, referencia_columna="id", on_delete="CASCADE"),
    ],
    indices=[Index(columnas=["id_conciliacion", "estado"], nombre="gd_conciliacion_movimientos_idx")],
    comentario="Líneas de cada extracto bancario y su conciliación",
    db_name=__DB_NAME__,
)

TABLA_CUENTAS_BANCARIAS = Tabla(
    nombre=NOMBRE_TABLA_CUENTAS_BANCARIAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_empresa", tipo="INT", not_null=True, comentario="→ gd_conta_empresas.id (sin FK: se conserva)"),
        Columna(nombre="banco", tipo="VARCHAR", longitud=4, not_null=True),
        Columna(nombre="oficina", tipo="VARCHAR", longitud=4, not_null=True),
        Columna(nombre="cuenta", tipo="VARCHAR", longitud=10, not_null=True),
        Columna(nombre="subcuenta", tipo="VARCHAR", longitud=20,
                comentario="Subcuenta 572 del plan de la empresa en el SIF; la elige el contable una vez"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
    ],
    indices=[Index(columnas=["id_empresa", "banco", "oficina", "cuenta"], unico=True, nombre="gd_cuentas_bancarias_idx")],
    comentario="Cuentas bancarias de cada empresa y su subcuenta contable",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CUENTAS_BANCARIAS, TABLA_CONCILIACIONES, TABLA_CONCILIACION_MOVIMIENTOS]
