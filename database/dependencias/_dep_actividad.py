"""Registro de actividad — ver docs/gestion-documental.md → "Registro de
actividad". Un apunte por cada cambio que salió bien, venga de la IA
(Claude/ChatGPT con su API key), del chat del panel o de un botón del
panel. Las consultas no se apuntan.

Sin FKs a propósito: borrar un documento, una entidad o un usuario no
debe borrar su rastro — por eso `quien` y `nombre_objeto` son copias del
nombre en el momento del apunte. Se limpia solo lo que tenga más de 365
días (scripts/limpiar_actividad.py)."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_ACTIVIDAD = "gd_actividad"
__DB_NAME__ = get_db_name("gestion_documental")

ORIGENES_ACTIVIDAD = ["ia", "chat", "panel"]

CAMPOS_ACTIVIDAD = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador del apunte"),
    Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True, comentario="Cuándo pasó"),
    Columna(nombre="id_usuario", tipo="INT",
            comentario="Usuario del panel (o del chat) que lo hizo (→ mcpc_usuarios.id del core, sin "
                       "FK entre bases) — NULL si vino de una API key o de soporte"),
    Columna(nombre="id_api_key", tipo="INT",
            comentario="API key con la que se hizo, si vino de un cliente MCP (→ mcpc_api_keys.id)"),
    Columna(nombre="quien", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Nombre de la persona o de la API key en ese momento — copia, para que siga "
                       "legible aunque luego se renombre o se borre"),
    Columna(nombre="origen", tipo="ENUM", enum_opciones=ORIGENES_ACTIVIDAD, not_null=True,
            comentario="ia = cliente MCP con API key; chat = chat del panel; panel = botón del panel"),
    Columna(nombre="accion", tipo="VARCHAR", longitud=100, not_null=True,
            comentario="Nombre interno de la acción (la herramienta MCP o la del panel) — para filtrar"),
    Columna(nombre="descripcion", tipo="VARCHAR", longitud=500, not_null=True,
            comentario='La frase en palabras normales, p.ej. "archivó el documento «Factura 1234»"'),
    Columna(nombre="tipo_objeto", tipo="VARCHAR", longitud=50,
            comentario="Qué se tocó: documento, entidad, regla, script..."),
    Columna(nombre="id_objeto", tipo="INT", comentario="Id de ese elemento en su tabla"),
    Columna(nombre="nombre_objeto", tipo="VARCHAR", longitud=255,
            comentario="Nombre del elemento en ese momento — copia, sigue legible aunque se borre"),
    Columna(nombre="detalle", tipo="MEDIUMTEXT",
            comentario="Datos de la acción en JSON, sin secretos ni archivos y con los textos largos "
                       "recortados (ver _mod_actividad.limpiar_detalle)"),
]

INDICES_ACTIVIDAD = [
    Index(columnas=["fecha"]),
    Index(columnas=["tipo_objeto", "id_objeto"]),
    Index(columnas=["quien", "fecha"]),
]

TABLA_ACTIVIDAD = Tabla(
    nombre=NOMBRE_TABLA_ACTIVIDAD, columnas=CAMPOS_ACTIVIDAD, indices=INDICES_ACTIVIDAD,
    comentario="Registro de actividad: quién cambió qué y cuándo — solo se escribe, nunca se "
               "edita; se borra lo que tenga más de 365 días",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_ACTIVIDAD]
