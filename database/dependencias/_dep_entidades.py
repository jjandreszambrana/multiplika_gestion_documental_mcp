"""Entidades (clientes, proveedores, empleados...) — ver
docs/gestion-documental.md → "Entidades". Ficha de contacto mínima,
relacionable con documentos; un documento puede tener varias entidades
relacionadas (p.ej. un contrato con el cliente y con un fiador) y una
entidad puede aparecer en muchos documentos — de ahí la tabla de relación
aparte (gd_documentos_entidades), mismo patrón que gd_documentos_grupos."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_documentos import NOMBRE_TABLA_DOCUMENTOS

NOMBRE_TABLA_ENTIDADES = "gd_entidades"
NOMBRE_TABLA_DOCUMENTOS_ENTIDADES = "gd_documentos_entidades"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_ENTIDADES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la entidad"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=255, not_null=True,
            comentario="Nombre de la entidad (persona o empresa)"),
    Columna(nombre="tipo", tipo="VARCHAR", longitud=50, not_null=True,
            comentario='Qué es: "cliente", "proveedor", "empleado"... — texto libre, catálogo '
                       "abierto igual que gd_documentos.tipo_documento, no una lista cerrada"),
    Columna(nombre="direccion", tipo="VARCHAR", longitud=255,
            comentario="Dirección postal — opcional"),
    Columna(nombre="localidad", tipo="VARCHAR", longitud=150, comentario="Opcional"),
    Columna(nombre="provincia", tipo="VARCHAR", longitud=150, comentario="Opcional"),
    Columna(nombre="codigo_postal", tipo="VARCHAR", longitud=20,
            comentario="Texto, no número — hay códigos postales con letras fuera de España"),
    Columna(nombre="pais", tipo="VARCHAR", longitud=100, comentario="Opcional"),
    Columna(nombre="telefono", tipo="VARCHAR", longitud=50, comentario="Opcional"),
    Columna(nombre="email", tipo="VARCHAR", longitud=255, comentario="Opcional"),
    Columna(nombre="observaciones", tipo="MEDIUMTEXT", comentario="Texto libre — opcional"),
    Columna(nombre="codigo", tipo="VARCHAR", longitud=100,
            comentario="Código de esta entidad en el ERP del cliente, para poder cruzar datos — "
                       "opcional, único si se rellena (varias entidades pueden no tener ninguno)"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
    Columna(nombre="nif", tipo="VARCHAR", longitud=20,
            comentario="NIF/CIF — opcional. Sirve para cruzar con el ERP cuando no hay código"),
    Columna(nombre="baja_erp", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True si ya no está en el ERP (la importación con «son todos mis clientes» no la "
                       "encontró): no se borra, solo se marca"),
    Columna(nombre="fecha_sync_erp", tipo="TIMESTAMP",
            comentario="Última vez que sus datos llegaron del ERP (SIF o Excel). Hora de Madrid"),
]

INDICES_ENTIDADES = [
    Index(columnas=["nombre"]),
    Index(columnas=["tipo"]),
    Index(columnas=["codigo"], unico=True),
    Index(columnas=["nif"], nombre="gd_entidades_nif_idx"),
]

TABLA_ENTIDADES = Tabla(
    nombre=NOMBRE_TABLA_ENTIDADES, columnas=CAMPOS_ENTIDADES, indices=INDICES_ENTIDADES,
    comentario="Clientes, proveedores, empleados... — ficha mínima de contacto, relacionable con "
               "documentos",
    db_name=__DB_NAME__,
)


CAMPOS_DOCUMENTOS_ENTIDADES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la relación"),
    Columna(nombre="id_documento", tipo="INT", not_null=True,
            comentario="Documento relacionado (→ gd_documentos.id)"),
    Columna(nombre="id_entidad", tipo="INT", not_null=True,
            comentario="Entidad relacionada (→ gd_entidades.id)"),
    Columna(nombre="fecha_asignacion", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_DOCUMENTOS_ENTIDADES = [
    Index(columnas=["id_documento", "id_entidad"], unico=True),
    Index(columnas=["id_entidad"]),
]

FKS_DOCUMENTOS_ENTIDADES = [
    ForeignKey(columna="id_documento", referencia_tabla=NOMBRE_TABLA_DOCUMENTOS,
               referencia_columna="id", on_delete="CASCADE"),
    ForeignKey(columna="id_entidad", referencia_tabla=NOMBRE_TABLA_ENTIDADES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_DOCUMENTOS_ENTIDADES = Tabla(
    nombre=NOMBRE_TABLA_DOCUMENTOS_ENTIDADES, columnas=CAMPOS_DOCUMENTOS_ENTIDADES,
    indices=INDICES_DOCUMENTOS_ENTIDADES, foreign_keys=FKS_DOCUMENTOS_ENTIDADES,
    comentario="Relación muchos-a-muchos entre documentos y entidades",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_ENTIDADES, TABLA_DOCUMENTOS_ENTIDADES]
