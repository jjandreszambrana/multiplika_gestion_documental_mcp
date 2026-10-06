"""Webs y redes sociales — ver docs/gestion-documental.md → "Webs y redes
sociales" y docs/planificacion/webs-y-redes-sociales.md.

gd_activos_digitales es el inventario (cada web, base de datos, cuenta de
red social...) y gd_cambios_externos todo cambio hecho fuera de la GD,
desde que se propone hasta que se aplica o se deshace: es lo que permite
el "proponer → aprobar" común a la IA, al chat y al panel, y el deshacer.

Sin FKs a propósito, como gd_actividad: borrar una credencial o una
entidad no debe llevarse el rastro de los cambios hechos en una web. Los
estados y niveles van como VARCHAR validado en el código (no ENUM) para
poder añadir valores en fases siguientes sin migrar la columna."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla
from mtpk_postgres.core_sync import SQLLiteral

NOMBRE_TABLA_ACTIVOS = "gd_activos_digitales"
NOMBRE_TABLA_CAMBIOS = "gd_cambios_externos"
__DB_NAME__ = get_db_name("gestion_documental")

TIPOS_ACTIVO = ["web", "red_social", "base_datos", "dominio", "otro"]
# Qué sabe hacer la GD con cada plataforma: wordpress (contenido, conector...),
# bd (consultas y cambios en la base de datos), red (publicar en redes) y
# ficheros (webs hechas a medida: archivos por SFTP o Git). Las que no salen
# aquí (Shopify, PrestaShop, Wix, otra) solo se inventarían de momento.
CAPACIDAD_POR_PLATAFORMA = {
    "wordpress": "wordpress", "woocommerce": "wordpress",
    "mysql": "bd", "postgres": "bd",
    "instagram": "red", "facebook": "red", "linkedin": "red", "google_business": "red", "x": "red",
    "tiktok": "red", "youtube": "red",
    "a_medida": "ficheros",
}
PLATAFORMAS_CONECTABLES = list(CAPACIDAD_POR_PLATAFORMA)
PLATAFORMAS = PLATAFORMAS_CONECTABLES + ["shopify", "prestashop", "wix", "otra"]
# De menos a más permiso: el orden importa (la IA solo puede bajarlo).
NIVELES_PERMISO = ["lectura", "proponer", "aplicar_confirmando", "autonomo"]
ESTADOS_ACTIVO = ["activo", "pausado", "error"]

# "aplicando" y "deshaciendo" duran lo que tarda la web en contestar: evitan que dos
# personas apliquen o deshagan el mismo cambio a la vez.
ESTADOS_CAMBIO = ["propuesto", "aplicando", "aplicado", "rechazado", "caducado", "fallido", "deshaciendo", "deshecho"]
VIAS = ["ia", "chat", "panel"]

CAMPOS_ACTIVOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Identificador del activo"),
    Columna(nombre="nombre", tipo="VARCHAR", longitud=150, not_null=True,
            comentario='Nombre puesto por el cliente, p.ej. "Web corporativa" o "Instagram tienda"'),
    Columna(nombre="tipo", tipo="VARCHAR", longitud=30, not_null=True,
            comentario="web, red_social, base_datos, dominio, otro (ver TIPOS_ACTIVO)"),
    Columna(nombre="plataforma", tipo="VARCHAR", longitud=30, not_null=True,
            comentario="wordpress, woocommerce, a_medida, instagram... (ver PLATAFORMAS)"),
    Columna(nombre="url", tipo="VARCHAR", longitud=500,
            comentario="Dirección de la web o del perfil"),
    Columna(nombre="descripcion", tipo="MEDIUMTEXT",
            comentario="Para qué sirve, qué hay que tener en cuenta — lo lee la IA"),
    Columna(nombre="id_credencial", tipo="INT",
            comentario="Credencial con la que se conecta (→ gd_credenciales.id, sin FK)"),
    Columna(nombre="id_entidad", tipo="INT",
            comentario="Entidad relacionada, opcional (→ gd_entidades.id, sin FK)"),
    Columna(nombre="nivel_permiso", tipo="VARCHAR", longitud=30, not_null=True, default="lectura",
            comentario="lectura, proponer, aplicar_confirmando, autonomo (ver NIVELES_PERMISO)"),
    Columna(nombre="conector_instalado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="Si tiene instalado el conector propio de Multiplika (fases siguientes)"),
    Columna(nombre="modo_conexion", tipo="VARCHAR", longitud=30,
            comentario="Redes sociales: directo o intermediario (fases siguientes)"),
    Columna(nombre="ajustes", tipo="MEDIUMTEXT",
            comentario="JSON con las elecciones del cliente para este activo (ver AJUSTES en "
                       "_mod_activos_digitales.py) — solo se guardan las que difieren del valor por defecto"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="activo",
            comentario="activo, pausado (no se le hace nada) o error (falló la última conexión)"),
    Columna(nombre="ultimo_error", tipo="MEDIUMTEXT",
            comentario="Mensaje de la última conexión fallida"),
    Columna(nombre="fecha_ultima_conexion", tipo="TIMESTAMP",
            comentario="Última vez que se probó la conexión, saliera bien o mal"),
    Columna(nombre="archivado", tipo="BOOLEAN", not_null=True, default=False),
    Columna(nombre="fecha_alta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
]

INDICES_ACTIVOS = [
    Index(columnas=["nombre"], nombre="gd_activos_digitales_nombre_idx"),
    Index(columnas=["id_entidad"], nombre="gd_activos_digitales_entidad_idx"),
]

TABLA_ACTIVOS = Tabla(
    nombre=NOMBRE_TABLA_ACTIVOS, columnas=CAMPOS_ACTIVOS, indices=INDICES_ACTIVOS,
    comentario="Inventario de webs, bases de datos y redes sociales de la empresa",
    db_name=__DB_NAME__,
)

CAMPOS_CAMBIOS = [
    Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True,
            comentario="Número de la propuesta"),
    Columna(nombre="id_activo", tipo="INT", not_null=True,
            comentario="Activo afectado (→ gd_activos_digitales.id, sin FK)"),
    Columna(nombre="operacion", tipo="VARCHAR", longitud=50, not_null=True,
            comentario="wp_editar_entrada, wp_moderar_comentario... (ver OPERACIONES en _mod_cambios_externos.py)"),
    Columna(nombre="id_objeto", tipo="VARCHAR", longitud=100,
            comentario="Id del elemento en la plataforma (la entrada, el comentario...). En una "
                       "creación se rellena al aplicar"),
    Columna(nombre="resumen", tipo="VARCHAR", longitud=500, not_null=True,
            comentario='La propuesta en palabras normales, p.ej. "Editar la entrada «Horario»: título"'),
    Columna(nombre="motivo", tipo="MEDIUMTEXT", comentario="Por qué se propone, si se dijo"),
    Columna(nombre="datos_antes", tipo="MEDIUMTEXT",
            comentario="JSON con lo que había antes — NULL en una creación o tras purgar el detalle"),
    Columna(nombre="datos_despues", tipo="MEDIUMTEXT",
            comentario="JSON con lo que se va a poner — NULL tras purgar el detalle"),
    Columna(nombre="datos_aplicados", tipo="MEDIUMTEXT",
            comentario="JSON con lo que la plataforma guardó de verdad al aplicar (puede diferir de "
                       "datos_despues, p.ej. WordPress limpia etiquetas) — para deshacer con seguridad"),
    Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, default="propuesto",
            comentario="propuesto, aplicado, rechazado, caducado, fallido, deshecho (ver ESTADOS_CAMBIO)"),
    Columna(nombre="via_propuesta", tipo="VARCHAR", longitud=10, not_null=True,
            comentario="ia, chat o panel"),
    Columna(nombre="propuesto_por", tipo="VARCHAR", longitud=150, not_null=True,
            comentario="Persona o API key — copia del nombre, como en gd_actividad"),
    Columna(nombre="fecha_propuesta", tipo="TIMESTAMP", not_null=True, default=SQLLiteral("CURRENT_TIMESTAMP"),
            protegido_actualizar=True),
    Columna(nombre="via_resolucion", tipo="VARCHAR", longitud=10,
            comentario="Por dónde se aplicó o rechazó"),
    Columna(nombre="resuelto_por", tipo="VARCHAR", longitud=150, comentario="Quién lo aplicó o rechazó"),
    Columna(nombre="fecha_resolucion", tipo="TIMESTAMP"),
    Columna(nombre="resultado", tipo="MEDIUMTEXT",
            comentario="Qué pasó al aplicar: comprobación posterior, error, aviso de caducidad..."),
    Columna(nombre="deshecho_por", tipo="VARCHAR", longitud=150),
    Columna(nombre="via_deshecho", tipo="VARCHAR", longitud=10),
    Columna(nombre="fecha_deshecho", tipo="TIMESTAMP"),
    Columna(nombre="detalle_purgado", tipo="BOOLEAN", not_null=True, default=False,
            comentario="True cuando ya se borraron antes/después por antigüedad: deja de poder deshacerse"),
]

INDICES_CAMBIOS = [
    Index(columnas=["id_activo", "fecha_propuesta"], nombre="gd_cambios_externos_activo_fecha_idx"),
    Index(columnas=["estado"], nombre="gd_cambios_externos_estado_idx"),
]

TABLA_CAMBIOS = Tabla(
    nombre=NOMBRE_TABLA_CAMBIOS, columnas=CAMPOS_CAMBIOS, indices=INDICES_CAMBIOS,
    comentario="Cambios propuestos/aplicados/deshechos en webs y redes, con copia de lo anterior",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_ACTIVOS, TABLA_CAMBIOS]
