"""Herramientas MCP de gd_envios — comunicaciones (documentos-plantilla
con variables `{{asi}}`) enviadas por email a entidades. Ver
docs/gestion-documental.md → "Comunicaciones y envíos"."""

from datetime import datetime

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias import resolver_proyecto_actual
from database.config_db import get_db_config
from fastmcp.exceptions import ToolError

from ..database.modelos._mod_envios import (
    EnviosCRUD,
    cancelar_envio,
    crear_envios,
    detectar_variables_documento,
    enviar_envio,
    reintentar_envio,
)


async def _contexto_actual() -> dict:
    proyecto = await resolver_proyecto_actual()
    return get_db_config(proyecto["id"])


@mcp_app.tool()
async def detectar_variables_documento_gd(id_documento: int) -> dict:
    """Variables `{{asi}}` que aparecen en el nombre y en el contenido
    (versión vigente) de un documento usado como plantilla de
    comunicación. Devuelve dos listas: "auto" (se rellenan solas con los
    datos de cada entidad destinataria: nombre, email, dirección...) y
    "personalizadas" (las escribes tú al crear el envío, mismo valor
    para todas las entidades del lote). Llama a esta tool antes de
    crear_envios_gd para saber qué personalizadas hace falta pedirle al
    cliente."""
    config = await _contexto_actual()
    try:
        return await detectar_variables_documento(config, id_documento)
    except ValueError as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def crear_envios_gd(
    id_documento: int,
    ids_entidad: list[int],
    creado_por: str,
    variables_personalizadas: dict | None = None,
    fecha_programada: str | None = None,
) -> list[dict]:
    """Crea un envío de este documento (usado como plantilla) para cada
    entidad de `ids_entidad` — uno por entidad, cada uno con su propio
    email y sus propias variables "auto" (ver
    detectar_variables_documento_gd), pero las mismas
    `variables_personalizadas` para todas.

    `ids_entidad` puede venir de una lista que te dé el cliente, o de las
    entidades ya vinculadas a este documento (consulta antes
    listar_entidades_documento_gd si te pide "mándaselo a los de
    siempre" o algo parecido) — las dos vías valen igual, esta tool no
    distingue de dónde salen los ids.

    `fecha_programada`: fecha y hora ISO (p.ej. "2026-10-03T09:00:00")
    para mandarlo más adelante — el cron se encarga solo. Si la dejas
    vacía, los envíos quedan listos para mandar YA: llama a
    enviar_envio_gd con el id de cada uno que te devuelva esta tool (o
    dile al cliente que se van a mandar y hazlo en el mismo turno, uno
    por uno).

    El contenido queda fijado en el momento de crear el envío: si
    corriges el documento después, no afecta a envíos ya creados,
    programados o no.

    `creado_por`: quién programa/manda esto — pregúntaselo al cliente si
    no lo sabes, no lo inventes."""
    config = await _contexto_actual()
    fecha = datetime.fromisoformat(fecha_programada) if fecha_programada else None
    try:
        return await crear_envios(
            config, id_documento, ids_entidad, variables_personalizadas or {}, creado_por, fecha,
        )
    except ValueError as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def enviar_envio_gd(id_envio: int) -> dict:
    """Manda ahora mismo un envío ya creado (en estado 'programado') —
    úsala justo después de crear_envios_gd si el cliente quiere mandarlo
    ya, en vez de esperar a una fecha programada. No falla si el envío
    en sí falla (buzón inválido, SMTP caído...): revisa el `estado` y
    `error` de la respuesta."""
    config = await _contexto_actual()
    try:
        return await enviar_envio(config, id_envio)
    except ValueError as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def listar_envios_documento_gd(id_documento: int) -> list[dict]:
    """Envíos (programados, enviados, fallidos o cancelados) de un
    documento usado como plantilla, más recientes primero."""
    config = await _contexto_actual()
    return await EnviosCRUD(config).listar_de_documento(id_documento)


@mcp_app.tool()
async def listar_envios_entidad_gd(id_entidad: int) -> list[dict]:
    """Envíos recibidos (o pendientes de recibir) por una entidad, más
    recientes primero."""
    config = await _contexto_actual()
    return await EnviosCRUD(config).listar_de_entidad(id_entidad)


@mcp_app.tool()
async def cancelar_envio_gd(id_envio: int) -> dict:
    """Cancela un envío programado antes de que llegue su fecha — solo
    funciona si sigue en estado 'programado'."""
    config = await _contexto_actual()
    try:
        return await cancelar_envio(config, id_envio)
    except ValueError as e:
        raise ToolError(str(e)) from e


@mcp_app.tool()
async def reintentar_envio_gd(id_envio: int) -> dict:
    """Reintenta ahora mismo un envío que falló (mismo contenido ya
    resuelto, no vuelve a pedir nada) — solo funciona si sigue en estado
    'fallido' y la entidad ya tiene un email configurado."""
    config = await _contexto_actual()
    try:
        return await reintentar_envio(config, id_envio)
    except ValueError as e:
        raise ToolError(str(e)) from e
