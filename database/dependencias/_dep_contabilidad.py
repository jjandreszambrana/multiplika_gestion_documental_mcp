"""Asesor contable conectado con la contabilidad de Multiplika SIF — ver
docs/contabilidad/planificacion.md (fases 2 a 4).

- gd_conta_empresas: las empresas del SIF que esta GD puede ver (el
  límite). En modo asesoría, las vinculadas a la asesoría; en modo empresa,
  la fijada. Las mantiene al día la clave de la GD. No tiene nada que ver
  con gd_entidades (esas son los clientes y proveedores del propio tenant).
- gd_conta_accesos: el usuario del SIF de cada usuario de la GD, con su
  credencial privada (gd_credenciales.id_usuario_dueno).
- gd_conta_propuestas: lo que propone la IA (asientos, reclasificaciones,
  avisos, apartados de la memoria) para que lo revise el contable. Nada de
  esto se escribe en el SIF por sí solo.

Sin FKs hacia credenciales: borrar una credencial no debe llevarse el
rastro."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_CONTA_EMPRESAS = "gd_conta_empresas"
NOMBRE_TABLA_CONTA_ACCESOS = "gd_conta_accesos"
NOMBRE_TABLA_CONTA_PROPUESTAS = "gd_conta_propuestas"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_ACCESO = ["activo", "sin_permiso", "clave_incorrecta"]
TIPOS_PROPUESTA = ["asiento", "reclasificacion", "aviso", "memoria"]
ESTADOS_PROPUESTA = ["pendiente", "aceptada", "descartada"]

TABLA_CONTA_EMPRESAS = Tabla(
    nombre=NOMBRE_TABLA_CONTA_EMPRESAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_obligado_sif", tipo="INT", not_null=True, unique=True),
        Columna(nombre="nif", tipo="VARCHAR", longitud=20),
        Columna(nombre="nombre", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="contabilidad_autorizada", tipo="BOOLEAN", not_null=True, default=False,
                comentario="Si la asesoría tiene permiso de contabilidad en el SIF para esta empresa"),
        Columna(nombre="baja", tipo="BOOLEAN", not_null=True, default=False,
                comentario="Ya no está en el SIF: no se enseña, pero se conserva lo suyo"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
        Columna(nombre="ultima_sincronizacion", tipo="TIMESTAMP"),
    ],
    comentario="Empresas de la contabilidad del SIF que puede ver esta GD",
    db_name=__DB_NAME__,
)

TABLA_CONTA_ACCESOS = Tabla(
    nombre=NOMBRE_TABLA_CONTA_ACCESOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_usuario", tipo="INT", not_null=True, unique=True,
                comentario="Usuario de la GD (mcpc_usuarios, base de control: sin FK)"),
        Columna(nombre="id_credencial", tipo="INT", not_null=True,
                comentario="→ gd_credenciales.id, con id_usuario_dueno = id_usuario"),
        Columna(nombre="id_usuario_sif", tipo="INT"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="activo",
                comentario="activo, sin_permiso o clave_incorrecta"),
        Columna(nombre="ultima_comprobacion", tipo="TIMESTAMP"),
        Columna(nombre="ultimo_error", tipo="MEDIUMTEXT"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
    ],
    comentario="Acceso de cada usuario de la GD a la contabilidad del SIF",
    db_name=__DB_NAME__,
)

TABLA_CONTA_PROPUESTAS = Tabla(
    nombre=NOMBRE_TABLA_CONTA_PROPUESTAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_obligado_sif", tipo="INT", not_null=True, comentario="Empresa del SIF"),
        Columna(nombre="tipo", tipo="VARCHAR", longitud=20, not_null=True,
                comentario="asiento, reclasificacion, aviso o memoria"),
        Columna(nombre="titulo", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="detalle", tipo="MEDIUMTEXT",
                comentario="JSON: el asiento (fecha, concepto, apuntes) o el apartado de la memoria"),
        Columna(nombre="justificacion", tipo="MEDIUMTEXT"),
        Columna(nombre="id_tema", tipo="INT", comentario="Tema de la biblioteca contable en que se apoya"),
        Columna(nombre="id_documento", tipo="INT", comentario="Documento de la GD del que sale, si hay"),
        Columna(nombre="origen", tipo="VARCHAR", longitud=20, not_null=True, default="ia",
                comentario="ia (chat o MCP) o revision (la revisión automática)"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="pendiente"),
        Columna(nombre="motivo_descarte", tipo="MEDIUMTEXT"),
        Columna(nombre="creado_por", tipo="VARCHAR", longitud=150),
        Columna(nombre="revisado_por", tipo="INT", comentario="Usuario de la GD que la aceptó o descartó"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
        Columna(nombre="fecha_revision", tipo="TIMESTAMP"),
    ],
    indices=[Index(columnas=["id_obligado_sif", "estado"])],
    comentario="Propuestas contables de la IA para que las revise el contable",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CONTA_EMPRESAS, TABLA_CONTA_ACCESOS, TABLA_CONTA_PROPUESTAS]
