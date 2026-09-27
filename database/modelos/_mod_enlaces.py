"""GDs enlazadas — ver docs/gestion-documental.md → "GDs enlazadas".
Acceso a gd_enlaces / gd_preguntas_pendientes / gd_uso_enlaces y el
cliente MCP con el que esta GD habla con otra (mismo mecanismo que el
chat del panel usa contra su propio servidor: fastmcp + `x-api-key`).
Vive en database/modelos porque lo usan tanto las herramientas MCP como
el panel (es la única carpeta que llega a los dos árboles de despliegue)."""

import os
from decimal import Decimal

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport
from lib.cifrado import cifrar, descifrar
from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_enlaces import (
    ID_ROL_GD_ENLAZADA,
    MOTIVO_SIN_RESULTADOS,
    SENTIDO_CENTRAL,
    TABLA_ENLACES,
    TABLA_PREGUNTAS_PENDIENTES,
    TABLA_USO_ENLACES,
)

# Hasta cuántas GDs seguidas puede subir una consulta (cliente → asesoría →
# sector). `cadena_gds` lleva las URLs ya recorridas para no entrar en bucle.
PROFUNDIDAD_MAXIMA = 3
TIMEOUT_ENLACE_SEGUNDOS = 30
SEPARADOR_ORIGEN = " › "


class EnlaceError(Exception):
    """La otra GD no respondió o rechazó la llamada — el mensaje es apto
    para enseñárselo al cliente."""


def url_mcp_propia() -> str | None:
    """URL pública /mcp de ESTE servidor, derivada de GD_URL_PUBLICA
    (https://host/gd → https://host/mcp; la inyecta sync.py del núcleo en el
    servicio). None si el servidor no la tiene configurada."""
    url_gd = os.environ.get("GD_URL_PUBLICA")
    if not url_gd:
        return None
    return url_gd.rstrip("/").removesuffix("/gd") + "/mcp"


def cliente_enlace(url_mcp: str, api_key: str) -> Client:
    transporte = StreamableHttpTransport(url_mcp, headers={"x-api-key": api_key})
    return Client(transporte, timeout=TIMEOUT_ENLACE_SEGUNDOS)


async def llamar_enlace(url_mcp: str, api_key: str, herramienta: str, argumentos: dict | None = None):
    """Una llamada a una herramienta de la otra GD. Devuelve el resultado
    ya deserializado; cualquier fallo (red, clave revocada, error de la
    herramienta) sale como EnlaceError."""
    try:
        async with cliente_enlace(url_mcp, api_key) as mcp:
            resultado = await mcp.call_tool(herramienta, argumentos or {}, raise_on_error=False)
    except Exception as e:  # httpx, auth 401, timeout... — no hay que distinguirlos aquí
        raise EnlaceError(f"No se pudo conectar con la GD enlazada ({url_mcp}): {e}") from e
    if resultado.is_error:
        texto = "\n".join(b.text for b in resultado.content if getattr(b, "type", None) == "text")
        raise EnlaceError(texto or f"La GD enlazada rechazó la llamada a {herramienta}")
    return resultado.data


async def probar_enlace(url_mcp: str, api_key: str) -> list[str]:
    """Nombres de las herramientas que la otra GD nos deja usar con esa key."""
    try:
        async with cliente_enlace(url_mcp, api_key) as mcp:
            return [h.name for h in await mcp.list_tools()]
    except Exception as e:
        raise EnlaceError(f"No se pudo conectar con la GD enlazada ({url_mcp}): {e}") from e


# Keys de rol gd_enlazada en la base de control del núcleo (MariaDB): la que
# emitimos a la otra GD al enlazar, y la que revocamos al desenlazar.
def _api_keys_control():
    from database.control.dependencias._dep_api_keys import TABLA_API_KEYS
    from database.config_db import get_db_config
    from mtpk_mariadb import AsyncCrudBase as CrudControl

    return CrudControl(TABLA_API_KEYS, get_db_config("control"))


async def emitir_key_gd_enlazada(id_proyecto: int, nombre: str) -> tuple[int, str]:
    """Emite una key de rol gd_enlazada para que OTRA GD nos llame. Nunca
    se le enseña a nadie: viaja directa a la otra GD al enlazar."""
    from lib.api_keys import generar_api_key

    key = generar_api_key()
    id_api_key = await _api_keys_control().insert({
        "id_proyecto": id_proyecto, "nombre": nombre, "id_rol": ID_ROL_GD_ENLAZADA,
        "prefijo": key["prefijo"], "api_key_cifrada": key["api_key_cifrada"],
    })
    return id_api_key, key["api_key"]


async def revocar_key(id_api_key: int) -> None:
    from datetime import datetime, timezone

    await _api_keys_control().update(id_api_key, {"estado": 0, "fecha_revocacion": datetime.now(timezone.utc)})


class EnlacesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_ENLACES, config)

    async def crear(self, nombre: str, url_mcp: str, api_key: str, sentido: str, id_api_key_emitida: int) -> int:
        return await self.insert({
            "nombre": nombre, "url_mcp": url_mcp, "api_key_cifrada": cifrar(api_key),
            "sentido": sentido, "id_api_key_emitida": id_api_key_emitida,
        })

    async def listar_metadatos(self, sentido: str | None = None, solo_activos: bool = False) -> list[dict]:
        """Sin la key cifrada — es lo que se enseña en el panel."""
        filtros = {}
        if sentido:
            filtros["sentido"] = {"op": "=", "valor": sentido}
        if solo_activos:
            filtros["activo"] = {"op": "=", "valor": True}
        filas, _ = await self.listar(filtros=filtros or None, orden="nombre ASC", limit=100)
        return [{k: v for k, v in f.items() if k != "api_key_cifrada"} for f in filas]

    async def obtener_con_clave(self, id_enlace: int) -> dict | None:
        fila = await self.obtener(id_enlace)
        if not fila:
            return None
        return {**fila, "api_key": descifrar(fila.pop("api_key_cifrada"))}

    async def obtener_por_key_emitida(self, id_api_key: int) -> dict | None:
        filas, _ = await self.listar(filtros={"id_api_key_emitida": {"op": "=", "valor": id_api_key}}, limit=1)
        return filas[0] if filas else None

    async def cambiar_activo(self, id_enlace: int, activo: bool) -> dict | None:
        if not await self.obtener(id_enlace):
            return None
        await self.update(id_enlace, {"activo": activo})
        return await self.obtener(id_enlace)


async def consultar_centrales(
    config: dict, pregunta: str, limite: int, cadena_gds: list[str] | None
) -> list[dict]:
    """Pregunta a todas las centrales activas de esta GD y junta sus
    fragmentos, cada uno con `origen` (nombre de la central; si viene de
    más arriba, "Central › Sector") e `id_enlace` para poder pedir después
    el documento completo. Una central caída no rompe el resto: su fallo
    se devuelve como un resultado más, con `error`."""
    cadena = list(cadena_gds or [])
    propia = url_mcp_propia()
    if propia:
        cadena.append(propia)
    if len(cadena) > PROFUNDIDAD_MAXIMA:
        return []

    resultados = []
    for enlace in await EnlacesCRUD(config).listar_metadatos(SENTIDO_CENTRAL, solo_activos=True):
        if enlace["url_mcp"] in cadena:
            continue  # ya recorrida: dos GDs enlazadas entre sí no se preguntan en bucle
        con_clave = await EnlacesCRUD(config).obtener_con_clave(enlace["id"])
        try:
            fragmentos = await llamar_enlace(
                enlace["url_mcp"], con_clave["api_key"], "consultar_documentos_gd",
                {"pregunta": pregunta, "limite": limite, "cadena_gds": cadena},
            )
        except EnlaceError as e:
            resultados.append({"origen": enlace["nombre"], "id_enlace": enlace["id"], "error": str(e)})
            continue
        for f in fragmentos or []:
            origen = enlace["nombre"] + (SEPARADOR_ORIGEN + f["origen"] if f.get("origen") else "")
            resultados.append({**f, "origen": origen, "id_enlace": enlace["id"]})
    return resultados


class PreguntasPendientesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_PREGUNTAS_PENDIENTES, config)

    async def anotar(self, pregunta: str, origen: str, motivo: str, detalle: str | None = None) -> dict:
        """Misma pregunta (normalizada) y mismo origen, todavía pendiente →
        se suma una vez en lugar de crear otra fila."""
        db = AsyncDatabase(**self.config)
        existente = await db.query(
            f'SELECT id FROM "{TABLA_PREGUNTAS_PENDIENTES.nombre}" '
            f"WHERE lower(trim(pregunta)) = lower(trim(%s)) AND origen = %s AND estado = 'pendiente' LIMIT 1",
            (pregunta, origen), uno=True,
        )
        if existente:
            await db.query(
                f'UPDATE "{TABLA_PREGUNTAS_PENDIENTES.nombre}" SET veces = veces + 1, '
                f"fecha_ultima = CURRENT_TIMESTAMP, detalle = COALESCE(%s, detalle) WHERE id = %s",
                (detalle, existente["id"]),
            )
            return await self.obtener(existente["id"])
        id_nueva = await self.insert({"pregunta": pregunta.strip(), "origen": origen, "motivo": motivo, "detalle": detalle})
        return await self.obtener(id_nueva)

    async def listar_por_estado(self, estado: str | None = None, origen: str | None = None) -> list[dict]:
        filtros = {}
        if estado:
            filtros["estado"] = {"op": "=", "valor": estado}
        if origen:
            filtros["origen"] = {"op": "=", "valor": origen}
        filas, _ = await self.listar(filtros=filtros or None, orden="veces DESC, fecha_ultima DESC", limit=500)
        return filas

    async def cambiar_estado(self, id_pregunta: int, estado: str) -> dict | None:
        if not await self.obtener(id_pregunta):
            return None
        await self.update(id_pregunta, {"estado": estado})
        return await self.obtener(id_pregunta)


class UsoEnlacesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_USO_ENLACES, config)

    async def registrar(
        self, origen: str, tipo: str, tokens_entrada: int = 0, tokens_salida: int = 0,
        modelo: str | None = None, coste_estimado: Decimal | float = 0,
    ) -> None:
        await self.insert({
            "origen": origen, "tipo": tipo, "tokens_entrada": tokens_entrada, "tokens_salida": tokens_salida,
            "modelo": modelo, "coste_estimado": coste_estimado,
        })

    async def resumen_mensual(self, mes: str) -> list[dict]:
        """`mes` = "YYYY-MM". Una fila por origen y tipo: cuántas veces,
        tokens y coste — lo que el admin usa para repercutir el gasto."""
        db = AsyncDatabase(**self.config)
        return await db.query(
            f"""
            SELECT origen, tipo, COUNT(*) AS veces,
                   SUM(tokens_entrada) AS tokens_entrada, SUM(tokens_salida) AS tokens_salida,
                   SUM(coste_estimado) AS coste_estimado
            FROM "{TABLA_USO_ENLACES.nombre}"
            WHERE to_char(fecha, 'YYYY-MM') = %s
            GROUP BY origen, tipo
            ORDER BY origen, tipo
            """,
            (mes,),
        )


async def anotar_sin_resultados(config: dict, pregunta: str, origen: str) -> None:
    await PreguntasPendientesCRUD(config).anotar(pregunta, origen, MOTIVO_SIN_RESULTADOS)
