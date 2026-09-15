"""Detección del cliente PonNodo (Claude Code en modo headless, `claude
--print`) — confirmado con una prueba real que en ese modo
`elicitation/create` no llega a ningún sitio: no aparece nada en
pantalla, el cliente da timeout y la tool falla con "el cliente no ha
rellenado el formulario". PonNodo se identifica a sí mismo con la
cabecera HTTP `X-Client-App: ponnodo` para que las tools que piden datos
con elicitation puedan tomar un camino alternativo — ver
guardar_documento_gd (_herr_documentos.py) y crear_credencial_gd
(_herr_credenciales.py). Para cualquier otro cliente (la cabecera no
llega, o llega con otro valor) el comportamiento no cambia."""

from fastmcp.server.dependencies import get_http_headers

CABECERA_CLIENTE_APP = "x-client-app"
VALOR_PONNODO = "ponnodo"


def es_cliente_ponnodo() -> bool:
    return get_http_headers().get(CABECERA_CLIENTE_APP, "").strip().lower() == VALOR_PONNODO
