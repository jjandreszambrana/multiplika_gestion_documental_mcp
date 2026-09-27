"""Marca de las herramientas que solo leen: una API key de rol invitado
únicamente puede usar estas (ver apps/mcp_server/core/solo_lectura.py del
core). Una herramienta sin marcar cuenta como escritura y queda bloqueada
para invitados — si añades una que solo lee, márcala con
`@mcp_app.tool(annotations=SOLO_LECTURA)`.

Una key de rol gd_enlazada (otra gestión documental que consulta a esta,
ver docs/gestion-documental.md → "GDs enlazadas") ve ÚNICAMENTE las
herramientas etiquetadas con `TAGS_GD_ENLAZADA` — lista blanca aparte y
mucho más corta, porque esa key la tiene otra empresa. Constantes propias
en vez de importarlas del core, para que este proyecto no falle al
importar en un servidor con un core anterior."""

SOLO_LECTURA = {"readOnlyHint": True}
TAGS_GD_ENLAZADA = {"gd_enlazada"}
ID_ROL_GD_ENLAZADA = 5  # mcpc_roles.id — ver lib/roles_proyecto.py del core


def es_gd_enlazada(proyecto: dict) -> bool:
    """True si la petición en curso viene de otra GD (key de rol
    gd_enlazada). `proyecto` es lo que devuelve resolver_proyecto_actual()."""
    return proyecto.get("id_rol_api_key") == ID_ROL_GD_ENLAZADA


def origen_enlazada(proyecto: dict) -> str:
    """Con qué nombre identificar a la GD que llama: el nombre que el admin
    le puso a su key al emitirla."""
    return proyecto.get("nombre_api_key") or "GD enlazada"
