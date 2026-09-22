"""Certificados digitales de entidades (.p12/.pfx con contraseña, o
.cer/.pem sin ella) — ver docs/gestion-documental.md → "Certificados de
entidades". Al subir un archivo se separa en sus piezas: el certificado
y la clave privada (si la hay) se guardan cada uno en su propio campo
cifrado (mismo Fernet que gd_credenciales) — nunca se guarda el archivo
original tal cual. Una copia descargable (el .p12) se reconstruye al
vuelo uniendo certificado+clave en el momento de pedirla, no se guarda
ya montada. Los datos que ya son públicos en el propio certificado
(titular, emisor, fechas...) se guardan en claro, igual que credenciales
guarda "usuario" sin cifrar."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

from ._dep_entidades import NOMBRE_TABLA_ENTIDADES

NOMBRE_TABLA_CERTIFICADOS = "gd_certificados"
NOMBRE_TABLA_CERTIFICADOS_LOG = "gd_certificados_log"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_CERTIFICADOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del certificado"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Nombre corto puesto por quien lo sube, para identificarlo en el listado"),
    Columna(nombre="descripcion", tipo="MEDIUMTEXT",
            comentario="Nota libre opcional — para qué se usa este certificado"),
    Columna(nombre="id_entidad", tipo="INT",
            comentario="Opcional — entidad a la que pertenece (→ gd_entidades.id). Un "
                       "certificado cuelga como mucho de una entidad; puede no tener ninguna"),
    Columna(nombre="formato", tipo="VARCHAR", longitud=10, not_null=True,
            comentario='"p12" (con clave privada, llevaba contraseña) o "cer" (solo la parte '
                       'pública) — según cómo se haya podido leer el archivo subido'),
    Columna(nombre="titular", tipo="VARCHAR", longitud=255,
            comentario="Nombre del titular, extraído del propio certificado (subject CN)"),
    Columna(nombre="nif_titular", tipo="VARCHAR", longitud=30,
            comentario="NIF del titular si el certificado lo lleva (subject serialNumber, "
                       "habitual en certificados españoles) — extraído, no editable a mano"),
    Columna(nombre="emisor", tipo="VARCHAR", longitud=255,
            comentario="Autoridad certificadora (issuer CN), extraído del certificado"),
    Columna(nombre="numero_serie", tipo="VARCHAR", longitud=100,
            comentario="Número de serie del certificado, extraído"),
    Columna(nombre="fecha_emision", tipo="DATE",
            comentario="Inicio de validez, extraído del certificado"),
    Columna(nombre="fecha_caducidad", tipo="DATE",
            comentario="Fin de validez, extraído del certificado — para el aviso de caducidad"),
    Columna(nombre="aviso_caducidad_enviado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Mismo mecanismo que gd_versiones: un solo aviso, nunca repetido"),
    Columna(nombre="certificado_cifrado", tipo="MEDIUMTEXT", not_null=True,
            comentario="El certificado en sí (PEM), cifrado con Fernet — es la parte pública, "
                       "pero se cifra igualmente por coherencia y porque ya viaja junto a datos "
                       "sensibles del cliente"),
    Columna(nombre="clave_cifrada", tipo="MEDIUMTEXT",
            comentario="La clave privada (PEM, sin proteger con contraseña propia — ya la "
                       "protege el cifrado Fernet), cifrada — NULL si el certificado subido era "
                       "solo la parte pública (.cer/.pem, formato='cer')"),
    Columna(nombre="contrasena_cifrada", tipo="VARCHAR", longitud=500,
            comentario="Contraseña con la que se protegía el .p12/.pfx original — cifrada, se "
                       "reutiliza para proteger la copia que se genera al descargar. NULL si el "
                       "certificado no llevaba contraseña o es formato='cer'"),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"), protegido_actualizar=True),
]

INDICES_CERTIFICADOS = [
    Index(columnas=["id_entidad"]),
    Index(columnas=["fecha_caducidad"]),
]

FKS_CERTIFICADOS = [
    ForeignKey(columna="id_entidad", referencia_tabla=NOMBRE_TABLA_ENTIDADES,
               referencia_columna="id", on_delete="SET NULL"),
]

TABLA_CERTIFICADOS = Tabla(
    nombre=NOMBRE_TABLA_CERTIFICADOS, columnas=CAMPOS_CERTIFICADOS, indices=INDICES_CERTIFICADOS,
    foreign_keys=FKS_CERTIFICADOS,
    comentario="Certificados digitales de entidades — archivo y contraseña cifrados, gestionados "
               "solo desde el panel",
    db_name=__DB_NAME__,
)


CAMPOS_CERTIFICADOS_LOG = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del registro de uso"),
    Columna(nombre="id_certificado", tipo="INT",
            comentario="Certificado usado (→ gd_certificados.id) — SET NULL si se borra el "
                       "certificado, el registro de auditoría no debe desaparecer con él"),
    Columna(nombre="certificado_nombre", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Copia del nombre del certificado en el momento del uso — a propósito "
                       "denormalizado, para que el registro siga siendo legible aunque el "
                       "certificado se borre después"),
    Columna(nombre="id_usuario", tipo="INT", not_null=True,
            comentario="Quién pidió la copia o el uso (→ mcpc_usuarios.id, sin FK entre bases)"),
    Columna(nombre="accion", tipo="VARCHAR", longitud=50, not_null=True,
            comentario='Qué se hizo, p.ej. "descarga" — texto libre corto, abierto a futuras '
                       "acciones además de descargar (p.ej. una firma)"),
    Columna(nombre="detalle", tipo="MEDIUMTEXT",
            comentario="Contexto opcional de la operación"),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_CERTIFICADOS_LOG = [
    Index(columnas=["id_certificado"]),
]

FKS_CERTIFICADOS_LOG = [
    ForeignKey(columna="id_certificado", referencia_tabla=NOMBRE_TABLA_CERTIFICADOS,
               referencia_columna="id", on_delete="SET NULL"),
]

TABLA_CERTIFICADOS_LOG = Tabla(
    nombre=NOMBRE_TABLA_CERTIFICADOS_LOG, columnas=CAMPOS_CERTIFICADOS_LOG,
    indices=INDICES_CERTIFICADOS_LOG, foreign_keys=FKS_CERTIFICADOS_LOG,
    comentario="Registro de auditoría de uso de certificados — de solo escritura, nunca se "
               "edita ni se borra una fila",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CERTIFICADOS, TABLA_CERTIFICADOS_LOG]
