"""Solicitudes de alta de credencial pendientes de que el cliente escriba
el valor en el formulario web de un solo uso (ver
mcp_server/herramientas/_herr_credenciales.py y panel_cliente/servidor.py
→ "Formulario de credencial (enlace de un solo uso)"). Solo existe para
clientes que no soportan `elicitation/create` (cabecera `X-Client-App:
ponnodo`) — con elicitation normal no se usa esta tabla."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_SOLICITUDES_CREDENCIAL = "gd_solicitudes_credencial"
__DB_NAME__ = get_db_name("gestion_documental")

CAMPOS_SOLICITUDES_CREDENCIAL = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador interno de la solicitud"),
    Columna(nombre="token_hash", tipo="VARCHAR", longitud=64, not_null=True,
            comentario="SHA-256 del token del enlace — el token en claro nunca se guarda, "
                       "solo viaja en la URL que se le da al cliente"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=100, not_null=True,
            comentario="Nombre de la futura credencial (gd_credenciales.nombre)"),
    Columna(nombre="descripcion", tipo="MEDIUMTEXT", not_null=True),
    Columna(nombre="usuario", tipo="VARCHAR", longitud=150,
            comentario="Usuario asociado, si aplica — igual que gd_credenciales.usuario"),
    Columna(nombre="fecha_creacion", tipo="TIMESTAMP", not_null=True,
            default=SQLLiteral("CURRENT_TIMESTAMP")),
    Columna(nombre="fecha_expiracion", tipo="TIMESTAMP", not_null=True,
            comentario="El enlace deja de ser válido pasado este instante (15 minutos desde "
                       "la creación)"),
    Columna(nombre="usado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Se pone a true en cuanto el cliente rellena el formulario una vez — "
                       "un segundo intento con el mismo token ya no vale"),
]

INDICES_SOLICITUDES_CREDENCIAL = [
    Index(columnas=["token_hash"], unico=True),
]

TABLA_SOLICITUDES_CREDENCIAL = Tabla(
    nombre=NOMBRE_TABLA_SOLICITUDES_CREDENCIAL, columnas=CAMPOS_SOLICITUDES_CREDENCIAL,
    indices=INDICES_SOLICITUDES_CREDENCIAL,
    comentario="Solicitudes de alta de credencial pendientes de rellenar por el formulario web "
               "de un solo uso (clientes sin soporte de elicitation, p.ej. PonNodo)",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_SOLICITUDES_CREDENCIAL]
