"""CRM: personas de contacto de cada entidad, etapas del embudo de ventas y
oportunidades — ver docs/gestion-documental.md → "CRM" y
docs/planificacion/crm.md (fase 1).

- gd_entidades_contactos: las personas dentro de una entidad ("Ana,
  compras"). Se borran con su entidad.
- gd_crm_etapas: las columnas del embudo, con su probabilidad. Un solo
  embudo por proyecto; las de por defecto se siembran en update_db.py.
- gd_oportunidades: cada posible venta. La entidad no se puede borrar
  mientras tenga oportunidades (FK sin cascada).
- gd_oportunidades_documentos: presupuestos, propuestas... de cada una.
- gd_oportunidades_cambios: cada cambio de etapa, para la línea de tiempo
  de la entidad y los informes de conversión.

`id_usuario_responsable` sin FK: los usuarios viven en la base de control
— mismo criterio que gd_seguimiento."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS
from ._dep_entidades import NOMBRE_TABLA_ENTIDADES

NOMBRE_TABLA_CONTACTOS = "gd_entidades_contactos"
NOMBRE_TABLA_ETAPAS = "gd_crm_etapas"
NOMBRE_TABLA_OPORTUNIDADES = "gd_oportunidades"
NOMBRE_TABLA_OPORTUNIDADES_DOCUMENTOS = "gd_oportunidades_documentos"
NOMBRE_TABLA_OPORTUNIDADES_CAMBIOS = "gd_oportunidades_cambios"
__DB_NAME__ = get_db_name("gestion_documental")

TIPOS_ETAPA = ["abierta", "ganada", "perdida"]

#: (nombre, probabilidad, tipo) — se siembran solo si la tabla está vacía
ETAPAS_POR_DEFECTO = [
    ("Contacto", 10, "abierta"),
    ("Propuesta", 30, "abierta"),
    ("Negociación", 60, "abierta"),
    ("Ganada", 100, "ganada"),
    ("Perdida", 0, "perdida"),
]

TABLA_CONTACTOS = Tabla(
    nombre=NOMBRE_TABLA_CONTACTOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_entidad", tipo="INT", not_null=True, comentario="→ gd_entidades.id"),
        Columna(nombre="nombre", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="cargo", tipo="VARCHAR", longitud=150, comentario="Opcional: compras, gerencia..."),
        Columna(nombre="email", tipo="VARCHAR", longitud=255),
        Columna(nombre="telefono", tipo="VARCHAR", longitud=50),
        Columna(nombre="observaciones", tipo="MEDIUMTEXT"),
        Columna(nombre="principal", tipo="BOOLEAN", not_null=True, default=False,
                comentario="La persona de referencia de la entidad (como mucho una)"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
    ],
    indices=[Index(columnas=["id_entidad"], nombre="gd_entidades_contactos_entidad_idx")],
    foreign_keys=[
        ForeignKey(columna="id_entidad", referencia_tabla=NOMBRE_TABLA_ENTIDADES,
                   referencia_columna="id", on_delete="CASCADE"),
    ],
    comentario="Personas de contacto de cada entidad",
    db_name=__DB_NAME__,
)

TABLA_ETAPAS = Tabla(
    nombre=NOMBRE_TABLA_ETAPAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="nombre", tipo="VARCHAR", longitud=100, not_null=True),
        Columna(nombre="orden", tipo="INT", not_null=True, default=0),
        Columna(nombre="probabilidad", tipo="INT", not_null=True, default=0,
                comentario="0-100: cuánto se espera ganar de lo que está en esta etapa"),
        Columna(nombre="tipo", tipo="VARCHAR", longitud=20, not_null=True, default="abierta",
                enum_opciones=TIPOS_ETAPA,
                comentario="abierta, ganada o perdida: al entrar en ganada/perdida se cierra la oportunidad"),
    ],
    indices=[Index(columnas=["orden"], nombre="gd_crm_etapas_orden_idx")],
    comentario="Etapas del embudo de ventas",
    db_name=__DB_NAME__,
)

TABLA_OPORTUNIDADES = Tabla(
    nombre=NOMBRE_TABLA_OPORTUNIDADES,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="titulo", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="id_entidad", tipo="INT", not_null=True, comentario="→ gd_entidades.id"),
        Columna(nombre="id_contacto", tipo="INT", comentario="→ gd_entidades_contactos.id"),
        Columna(nombre="importe", tipo="NUMERIC", precision=14, escala=2, comentario="Sin impuestos"),
        Columna(nombre="id_etapa", tipo="INT", not_null=True, comentario="→ gd_crm_etapas.id"),
        Columna(nombre="fecha_prevista_cierre", tipo="DATE"),
        Columna(nombre="id_usuario_responsable", tipo="INT",
                comentario="Quién la lleva (→ mcpc_usuarios.id, sin FK entre bases). NULL = nadie"),
        Columna(nombre="origen", tipo="VARCHAR", longitud=100,
                comentario="Texto libre: web, recomendación, feria..."),
        Columna(nombre="descripcion", tipo="MEDIUMTEXT"),
        Columna(nombre="proximo_paso", tipo="VARCHAR", longitud=255,
                comentario="Lo siguiente que hay que hacer: «llamar para cerrar fecha»"),
        Columna(nombre="fecha_proximo_paso", tipo="DATE",
                comentario="Cuándo: entra en el resumen diario de su responsable ese día o si se pasa"),
        Columna(nombre="motivo_perdida", tipo="VARCHAR", longitud=255),
        Columna(nombre="fecha_cierre", tipo="DATE", comentario="Cuándo se ganó o perdió"),
        Columna(nombre="codigo_erp", tipo="VARCHAR", longitud=100,
                comentario="Presupuesto o pedido en el ERP, cuando lo haya (fase 2)"),
        Columna(nombre="creado_por", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
        Columna(nombre="fecha_cambio", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP")),
    ],
    indices=[
        Index(columnas=["id_entidad"], nombre="gd_oportunidades_entidad_idx"),
        Index(columnas=["id_etapa"], nombre="gd_oportunidades_etapa_idx"),
        Index(columnas=["id_usuario_responsable"], nombre="gd_oportunidades_responsable_idx"),
    ],
    foreign_keys=[
        ForeignKey(columna="id_entidad", referencia_tabla=NOMBRE_TABLA_ENTIDADES,
                   referencia_columna="id", on_delete="RESTRICT"),
        ForeignKey(columna="id_contacto", referencia_tabla=NOMBRE_TABLA_CONTACTOS,
                   referencia_columna="id", on_delete="SET NULL"),
        ForeignKey(columna="id_etapa", referencia_tabla=NOMBRE_TABLA_ETAPAS,
                   referencia_columna="id", on_delete="RESTRICT"),
    ],
    comentario="Oportunidades de venta (embudo)",
    db_name=__DB_NAME__,
)

TABLA_OPORTUNIDADES_DOCUMENTOS = Tabla(
    nombre=NOMBRE_TABLA_OPORTUNIDADES_DOCUMENTOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_oportunidad", tipo="INT", not_null=True),
        Columna(nombre="id_documento", tipo="INT", not_null=True),
        Columna(nombre="fecha_asignacion", tipo="TIMESTAMP", not_null=True,
                default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True),
    ],
    indices=[
        Index(columnas=["id_oportunidad", "id_documento"], unico=True, nombre="gd_oportunidades_documentos_uk"),
        Index(columnas=["id_documento"], nombre="gd_oportunidades_documentos_doc_idx"),
    ],
    foreign_keys=[
        ForeignKey(columna="id_oportunidad", referencia_tabla=NOMBRE_TABLA_OPORTUNIDADES,
                   referencia_columna="id", on_delete="CASCADE"),
        ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
                   referencia_columna="id", on_delete="CASCADE"),
    ],
    comentario="Documentos de cada oportunidad (presupuestos, propuestas...)",
    db_name=__DB_NAME__,
)

TABLA_OPORTUNIDADES_CAMBIOS = Tabla(
    nombre=NOMBRE_TABLA_OPORTUNIDADES_CAMBIOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_oportunidad", tipo="INT", not_null=True),
        Columna(nombre="id_etapa_anterior", tipo="INT", comentario="NULL al crearla"),
        Columna(nombre="id_etapa", tipo="INT", not_null=True),
        Columna(nombre="nombre_etapa", tipo="VARCHAR", longitud=100, not_null=True,
                comentario="Copia del nombre: si la etapa se renombra o borra, el historial no cambia"),
        Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP")),
        Columna(nombre="quien", tipo="VARCHAR", longitud=255, not_null=True),
    ],
    indices=[Index(columnas=["id_oportunidad"], nombre="gd_oportunidades_cambios_op_idx")],
    foreign_keys=[
        ForeignKey(columna="id_oportunidad", referencia_tabla=NOMBRE_TABLA_OPORTUNIDADES,
                   referencia_columna="id", on_delete="CASCADE"),
    ],
    comentario="Cambios de etapa de cada oportunidad",
    db_name=__DB_NAME__,
)

__TABLAS__ = [
    TABLA_CONTACTOS, TABLA_ETAPAS, TABLA_OPORTUNIDADES,
    TABLA_OPORTUNIDADES_DOCUMENTOS, TABLA_OPORTUNIDADES_CAMBIOS,
]
