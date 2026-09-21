from database.config_db import get_db_name
from mtpk_postgres import Columna, ForeignKey, Index, Tabla

from ._dep_credenciales import NOMBRE_TABLA_CREDENCIALES

NOMBRE_TABLA_CREDENCIALES_CAMPOS = "gd_credenciales_campos"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_CREDENCIALES_CAMPOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno del campo"),
    Columna(nombre="id_credencial", tipo="INT", not_null=True,
            comentario="Credencial a la que pertenece este campo (→ gd_credenciales.id)"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=100, not_null=True,
            comentario='Nombre del campo, libre según el servicio, p.ej. "Application Key" o '
                       '"Consumer Secret" — para credenciales tipo OAuth con varios secretos a '
                       "la vez, aparte del valor principal de gd_credenciales"),
    Columna(nombre="valor_cifrado", tipo="VARCHAR", longitud=500, not_null=True,
            comentario="Igual de secreto que gd_credenciales.valor_cifrado, mismo mecanismo de "
                       "cifrado (Fernet, lib.cifrado)"),
]

INDICES_CREDENCIALES_CAMPOS = [
    Index(columnas=["id_credencial"]),
]

FK_CREDENCIALES_CAMPOS = [
    ForeignKey(columna="id_credencial", referencia_tabla=NOMBRE_TABLA_CREDENCIALES,
               referencia_columna="id", on_delete="CASCADE"),
]

TABLA_CREDENCIALES_CAMPOS = Tabla(
    nombre=NOMBRE_TABLA_CREDENCIALES_CAMPOS, columnas=CAMPOS_CREDENCIALES_CAMPOS,
    indices=INDICES_CREDENCIALES_CAMPOS, foreign_keys=FK_CREDENCIALES_CAMPOS,
    comentario="Campos secretos adicionales de una credencial (OAuth con varios secretos a la "
               "vez) — se borran solos si se borra la credencial (ON DELETE CASCADE)",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CREDENCIALES_CAMPOS]
