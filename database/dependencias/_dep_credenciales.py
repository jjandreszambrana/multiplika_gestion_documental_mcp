from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_CREDENCIALES = "gd_credenciales"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_CREDENCIALES = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la credencial"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=100, not_null=True,
            comentario='Identificador corto puesto por el cliente, p.ej. "erp_contabilidad"'),
    Columna(nombre="descripcion", tipo="MEDIUMTEXT", not_null=True,
            comentario="Para qué sirve esta credencial — es lo que ve la IA, nunca el valor"),
    Columna(nombre="usuario", tipo="VARCHAR", longitud=150,
            comentario="Usuario, si esta credencial lo necesita (no todas — un token o una API "
                       "key sueltos no lo llevan). No es secreto, se guarda sin cifrar y la IA "
                       "sí puede verlo, a diferencia del valor"),
    Columna(nombre="valor_cifrado", tipo="VARCHAR", longitud=500, not_null=True,
            comentario="La contraseña, token o API key — lo único realmente secreto, cifrado "
                       "con Fernet (lib.cifrado del repo core, mismo mecanismo que "
                       "mcpc_api_keys)"),
    Columna(nombre="id_usuario_dueno", tipo="INT",
            comentario="NULL = del proyecto, como siempre. Con dueño (mcpc_usuarios.id, sin FK), "
                       "es privada de ese usuario: no se lista ni se encuentra por nombre (p.ej. "
                       "su acceso a la contabilidad del SIF, ver _mod_contabilidad_sif.py)"),
    Columna(nombre="fecha_actualizacion", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP"),
            comentario="Fecha de creación o de la última vez que se cambió el valor"),
]

INDICES_CREDENCIALES = [
    Index(columnas=["nombre"], unico=True),
]

TABLA_CREDENCIALES = Tabla(
    nombre=NOMBRE_TABLA_CREDENCIALES, columnas=CAMPOS_CREDENCIALES, indices=INDICES_CREDENCIALES,
    comentario="Credenciales del cliente para conectar con servicios externos, gestionadas "
               "solo desde el panel — la IA solo puede listar nombre+descripción, nunca leer "
               "el valor",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_CREDENCIALES]
