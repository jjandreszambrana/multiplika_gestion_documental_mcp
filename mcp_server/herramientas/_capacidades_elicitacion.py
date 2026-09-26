"""Detecta si el cliente MCP conectado declaró soporte de elicitation en
modo formulario al iniciar la sesión — la única señal fiable de si
`ctx.elicit(...)` puede funcionar. Sustituye a la detección anterior por
cabecera `X-Client-App: ponnodo`: cualquier cliente sin esa capacidad
(no solo PonNodo) sigue el mismo camino alternativo — ver
guardar_documento_gd (_herr_documentos.py) y crear_credencial_gd
(_herr_credenciales.py). Que el cliente la declare no garantiza que el
intento vaya a funcionar (puede fallar igual, o el usuario cerrar el
formulario sin rellenarlo); esas tools tratan ambos casos igual."""

from fastmcp import Context


def puede_elicitar_formulario(ctx: Context) -> bool:
    capacidades = ctx.session.client_capabilities
    return (
        capacidades is not None
        and capacidades.elicitation is not None
        and capacidades.elicitation.form is not None
    )
