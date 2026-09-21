"""Marca de las herramientas que solo leen: una API key de rol invitado
únicamente puede usar estas (ver apps/mcp_server/core/solo_lectura.py del
core). Una herramienta sin marcar cuenta como escritura y queda bloqueada
para invitados — si añades una que solo lee, márcala con
`@mcp_app.tool(annotations=SOLO_LECTURA)`."""

SOLO_LECTURA = {"readOnlyHint": True}
