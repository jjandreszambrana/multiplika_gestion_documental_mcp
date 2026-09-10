from database.config_db import get_db_name
from mtpk_postgres import Columna, Tabla

NOMBRE_TABLA_CONFIGURACION = "gd_configuracion"
__DB_NAME__ = get_db_name("gestion_documental")  # alias real: el slug del cliente

# Proveedores de embedding soportados y su dimensión de vector — la
# dimensión hay que fijarla al crear la base del cliente (update_db.py
# --proveedor-embedding), no se puede cambiar después sin migrar
# gd_chunks.embedding a mano (columna VECTOR de tamaño fijo en Postgres).
PROVEEDORES_EMBEDDING_SOPORTADOS = {
    "mistral:mistral-embed": 1024,
    "openai:text-embedding-3-small": 1536,
    "openai:text-embedding-3-large": 3072,
}
PROVEEDOR_EMBEDDING_POR_DEFECTO = "mistral:mistral-embed"


def construir_tabla_configuracion(proveedor_embedding: str = PROVEEDOR_EMBEDDING_POR_DEFECTO) -> Tabla:
    dimension = PROVEEDORES_EMBEDDING_SOPORTADOS[proveedor_embedding]
    campos = [
        Columna(nombre="id", tipo="INT", primary_key=True, default=1,
                comentario="Fijo a 1: la tabla tiene siempre una única fila"),
        Columna(nombre="modo_busqueda", tipo="ENUM", enum_opciones=["fulltext", "semantico"],
                not_null=True, default="fulltext",
                comentario="Modo de búsqueda activo del cliente, cambiable en cualquier momento"),
        Columna(nombre="proveedor_embedding", tipo="VARCHAR", longitud=100, not_null=True,
                default=proveedor_embedding,
                comentario="Proveedor:modelo de embedding usado si el modo es semántico"),
        Columna(nombre="dimension_embedding", tipo="INT", not_null=True, default=dimension,
                comentario="Dimensión del vector de embedding — debe coincidir con gd_chunks.embedding"),
        Columna(nombre="email_avisos", tipo="VARCHAR", longitud=255,
                comentario="A quién avisar por email cuando hay documentos por caducar (aviso "
                           "proactivo diario, no solo si se pregunta — ver "
                           "listar_documentos_por_caducar_gd). NULL desactiva el aviso"),
        # Cuenta de correo PROPIA del cliente (no un buzón compartido de la
        # plataforma) — la configura cada cliente con su dirección y
        # contraseña, y sirve para las dos cosas: enviar los avisos de
        # caducidad (scripts/avisar_caducidades.py) y recibir documentos
        # por email (scripts/revisar_correo_entrante.py). Decisión de
        # producto, 2026-09-10 — se descartó un dominio/buzón propio de la
        # plataforma (ver docs/gestion-documental.md → "Ingesta por email").
        Columna(nombre="email_cuenta_direccion", tipo="VARCHAR", longitud=255,
                comentario="Dirección de la cuenta de correo del cliente. NULL desactiva tanto "
                           "el envío de avisos como la ingesta por email"),
        Columna(nombre="email_cuenta_usuario", tipo="VARCHAR", longitud=255,
                comentario="Usuario de acceso SMTP/IMAP, si es distinto de la dirección "
                           "(algunos proveedores lo piden aparte). NULL = usar la dirección"),
        Columna(nombre="email_cuenta_password_cifrada", tipo="VARCHAR", longitud=500,
                comentario="Contraseña (o contraseña de aplicación) de la cuenta, cifrada — "
                           "Fernet, lib.cifrado del repo core, igual que gd_credenciales"),
        Columna(nombre="email_cuenta_smtp_host", tipo="VARCHAR", longitud=255),
        Columna(nombre="email_cuenta_smtp_port", tipo="INT", default=587,
                comentario="587 (STARTTLS) por defecto; 465 se trata como SMTPS directo"),
        Columna(nombre="email_cuenta_imap_host", tipo="VARCHAR", longitud=255),
        Columna(nombre="email_cuenta_imap_port", tipo="INT", default=993),
    ]
    return Tabla(
        nombre=NOMBRE_TABLA_CONFIGURACION, columnas=campos,
        comentario="Configuración de búsqueda del cliente (fila única)", db_name=__DB_NAME__,
        registros_iniciales=[{"id": 1}],
    )


# Tabla con el proveedor por defecto (mistral) — válida para cualquier
# código que solo necesite las columnas (CRUD vía _mod_configuracion.py);
# para dar de alta un cliente con otro proveedor, usar
# construir_tabla_configuracion(proveedor_embedding) desde update_db.py.
TABLA_CONFIGURACION = construir_tabla_configuracion()

__TABLAS__ = [TABLA_CONFIGURACION]
