"""SEO (fase 3 de webs y redes) — ver docs/gestion-documental.md → "Webs y
redes sociales". Cada auditoría (recorrido de la web) y lo que encontró.
Los datos de Google (Search Console, PageSpeed) no se guardan aquí: se
piden en vivo, que Google ya guarda 16 meses. Sin FKs, como el resto de
webs y redes."""

from database.config_db import get_db_name
from mtpk_postgres import Columna, Index, Tabla

NOMBRE_TABLA_AUDITORIAS = "gd_auditorias_seo"
NOMBRE_TABLA_HALLAZGOS = "gd_hallazgos_seo"
__DB_NAME__ = get_db_name("gestion_documental")

ESTADOS_AUDITORIA = ["en_curso", "terminada", "fallida"]
ESTADOS_HALLAZGO = ["abierto", "en_tarea", "resuelto", "ignorado"]
GRAVEDADES = ["alta", "media", "baja"]

TABLA_AUDITORIAS = Tabla(
    nombre=NOMBRE_TABLA_AUDITORIAS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_activo", tipo="INT", not_null=True, comentario="→ gd_activos_digitales.id, sin FK"),
        Columna(nombre="fecha_inicio", tipo="TIMESTAMP", not_null=True),
        Columna(nombre="fecha_fin", tipo="TIMESTAMP"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, comentario="en_curso, terminada, fallida"),
        Columna(nombre="paginas", tipo="INT", comentario="Páginas recorridas"),
        Columna(nombre="limite_alcanzado", tipo="BOOLEAN", comentario="Si se paró en el máximo de páginas"),
        Columna(nombre="resumen", tipo="MEDIUMTEXT", comentario="JSON: problemas por gravedad, datos del sitio"),
        Columna(nombre="error", tipo="MEDIUMTEXT"),
        Columna(nombre="lanzada_por", tipo="VARCHAR", longitud=150),
    ],
    indices=[Index(columnas=["id_activo", "fecha_inicio"], nombre="gd_auditorias_seo_activo_fecha_idx")],
    comentario="Auditorías SEO: cada recorrido de una web",
    db_name=__DB_NAME__,
)

TABLA_HALLAZGOS = Tabla(
    nombre=NOMBRE_TABLA_HALLAZGOS,
    columnas=[
        Columna(nombre="id", tipo="INT", primary_key=True, auto_increment=True),
        Columna(nombre="id_auditoria", tipo="INT", not_null=True),
        Columna(nombre="id_activo", tipo="INT", not_null=True),
        Columna(nombre="tipo", tipo="VARCHAR", longitud=50, not_null=True, comentario="sin_descripcion, pagina_rota... (ver REGLAS en _mod_seo.py)"),
        Columna(nombre="gravedad", tipo="VARCHAR", longitud=10, not_null=True, comentario="alta, media, baja"),
        Columna(nombre="url", tipo="VARCHAR", longitud=1000, comentario="Página afectada; NULL si es de toda la web"),
        Columna(nombre="texto", tipo="VARCHAR", longitud=500, not_null=True, comentario="El problema en palabras normales"),
        Columna(nombre="detalle", tipo="MEDIUMTEXT", comentario="JSON con los datos concretos"),
        Columna(nombre="objeto_tipo", tipo="VARCHAR", longitud=20, comentario="entradas o paginas, si se sabe qué entrada de WordPress es"),
        Columna(nombre="objeto_id", tipo="INT"),
        Columna(nombre="clics", tipo="INT", comentario="Clics desde Google en los últimos 28 días (si hay Search Console)"),
        Columna(nombre="impresiones", tipo="INT"),
        Columna(nombre="prioridad", tipo="FLOAT", not_null=True, comentario="Gravedad × visitas: lo primero que conviene arreglar"),
        Columna(nombre="estado", tipo="VARCHAR", longitud=20, not_null=True, comentario="abierto, en_tarea, resuelto, ignorado"),
        Columna(nombre="id_nota", tipo="INT", comentario="Nota del bloc creada como tarea (→ gd_bloc_notas.id, sin FK)"),
        Columna(nombre="fecha", tipo="TIMESTAMP", not_null=True),
        Columna(nombre="fecha_resuelto", tipo="TIMESTAMP"),
    ],
    indices=[
        Index(columnas=["id_auditoria", "prioridad"], nombre="gd_hallazgos_seo_auditoria_prioridad_idx"),
        Index(columnas=["id_activo", "tipo", "url"], nombre="gd_hallazgos_seo_activo_tipo_url_idx"),
    ],
    comentario="Problemas SEO encontrados en cada auditoría",
    db_name=__DB_NAME__,
)

__TABLAS__ = [TABLA_AUDITORIAS, TABLA_HALLAZGOS]
