"""Asesor contable conectado con la contabilidad de Multiplika SIF — ver
docs/contabilidad/planificacion.md (fases 2 a 4).

Una sola regla (usuario, 2026-10-10, [5.9] del canal compartido): **cada
usuario de la GD vincula su propio acceso al SIF** y ve lo que ese usuario
del SIF puede ver. Puede tener varios accesos, a SIF distintos y de
distinto tipo (de una empresa o de una asesoría). No hay nada que
configurar a nivel de la GD.

- gd_conta_accesos: los accesos de cada usuario (dirección del SIF y su
  credencial privada, gd_credenciales.id_usuario_dueno).
- gd_conta_empresas: cada empresa del SIF que ha visto algún acceso, una
  vez por (SIF, id de la empresa en ese SIF): `id` es el número con el que
  la GD la nombra en todas partes, porque el id del SIF se repite entre
  SIF distintos.
- gd_conta_accesos_empresas: qué empresas ve cada acceso y con qué nivel.
  Se rehace al añadir el acceso, con "Actualizar" y cada noche.
- gd_conta_propuestas: lo que propone la IA para que lo revise el contable.

Sin FKs hacia credenciales: borrar una credencial no debe llevarse el
rastro."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_CONTA_ACCESOS = "gd_conta_accesos"
NOMBRE_TABLA_CONTA_EMPRESAS = "gd_conta_empresas"
NOMBRE_TABLA_CONTA_ACCESOS_EMPRESAS = "gd_conta_accesos_empresas"
NOMBRE_TABLA_CONTA_PROPUESTAS = "gd_conta_propuestas"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_ACCESO = ["activo", "sin_empresas", "clave_incorrecta"]
TIPOS_ACCESO = ["empresa", "asesoria", "otro"]
TIPOS_PROPUESTA = ["asiento", "reclasificacion", "aviso", "memoria"]
ESTADOS_PROPUESTA = ["pendiente", "aceptada", "descartada"]

TABLA_CONTA_ACCESOS = Tabla(
    nombre=NOMBRE_TABLA_CONTA_ACCESOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_usuario", tipo="INT", not_null=True,
                comentario="Usuario de la GD (mcpc_usuarios, base de control: sin FK)"),
        Columna(nombre="url_sif", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="id_credencial", tipo="INT", not_null=True,
                comentario="→ gd_credenciales.id, con id_usuario_dueno = id_usuario"),
        Columna(nombre="tipo", tipo="VARCHAR", longitud=20, not_null=True, default="otro",
                comentario="empresa, asesoria u otro: sale del rol del usuario en el SIF, no se elige"),
        Columna(nombre="nombre_sif", tipo="VARCHAR", longitud=255,
                comentario="A quién pertenece en el SIF (la empresa o la asesoría), para enseñarlo"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="activo",
                comentario="activo, sin_empresas o clave_incorrecta"),
        Columna(nombre="revision_automatica", tipo="BOOLEAN", not_null=True, default=False,
                comentario="Revisión nocturna de sus empresas (scripts/revisar_contabilidad.py)"),
        Columna(nombre="pausado", tipo="BOOLEAN", not_null=True, default=False,
                comentario="Pausado por su dueño: no se usa (ni empresas, ni revisión, ni usuarios) hasta reanudarlo"),
        Columna(nombre="ultima_comprobacion", tipo="TIMESTAMP"),
        Columna(nombre="ultimo_error", tipo="MEDIUMTEXT"),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
    ],
    comentario="Accesos de cada usuario de la GD a la contabilidad de un SIF",
    db_name=__DB_NAME__,
)

TABLA_CONTA_EMPRESAS = Tabla(
    nombre=NOMBRE_TABLA_CONTA_EMPRESAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="url_sif", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="id_obligado_sif", tipo="INT", not_null=True, comentario="Id de la empresa en ese SIF"),
        Columna(nombre="nif", tipo="VARCHAR", longitud=20),
        Columna(nombre="nombre", tipo="VARCHAR", longitud=255, not_null=True),
        Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
                protegido_actualizar=True),
    ],
    indices=[Index(columnas=["url_sif", "id_obligado_sif"], unico=True, nombre="gd_conta_empresas_sif_idx")],
    comentario="Empresas de la contabilidad de los SIF que ven los accesos de esta GD",
    db_name=__DB_NAME__,
)

TABLA_CONTA_ACCESOS_EMPRESAS = Tabla(
    nombre=NOMBRE_TABLA_CONTA_ACCESOS_EMPRESAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_acceso", tipo="INT", not_null=True),
        Columna(nombre="id_empresa", tipo="INT", not_null=True),
        Columna(nombre="nivel", tipo="VARCHAR", longitud=20, comentario="consulta, apuntes, cierre o admin (del SIF)"),
    ],
    foreign_keys=[
        ForeignKey(columna="id_acceso", referencia_tabla=NOMBRE_TABLA_CONTA_ACCESOS, referencia_columna="id", on_delete="CASCADE"),
        ForeignKey(columna="id_empresa", referencia_tabla=NOMBRE_TABLA_CONTA_EMPRESAS, referencia_columna="id", on_delete="CASCADE"),
    ],
    indices=[Index(columnas=["id_acceso", "id_empresa"], unico=True, nombre="gd_conta_accesos_empresas_idx")],
    comentario="Qué empresas ve cada acceso al SIF",
    db_name=__DB_NAME__,
)

TABLA_CONTA_PROPUESTAS = Tabla(
    nombre=NOMBRE_TABLA_CONTA_PROPUESTAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_empresa", tipo="INT", not_null=True, comentario="→ gd_conta_empresas.id (sin FK: se conserva)"),
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
    indices=[Index(columnas=["id_empresa", "estado"], nombre="gd_conta_propuestas_empresa_idx")],
    comentario="Propuestas contables de la IA para que las revise el contable",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CONTA_ACCESOS, TABLA_CONTA_EMPRESAS, TABLA_CONTA_ACCESOS_EMPRESAS, TABLA_CONTA_PROPUESTAS]
