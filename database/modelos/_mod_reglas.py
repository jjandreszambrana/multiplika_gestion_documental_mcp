"""CRUD de gd_reglas y armado del bloque de reglas globales que se le
inyecta a la IA al abrir sesión — ver docs/gestion-documental.md → "Reglas
de comportamiento".

Vive en database/modelos porque lo usan los tres sitios: las herramientas
MCP, el panel y el chat del panel (es la única carpeta que llega a los dos
árboles de despliegue, igual que _mod_enlaces.py)."""

import asyncio

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_enlaces import SENTIDO_CENTRAL
from ..dependencias._dep_reglas import AMBITO_HEREDADA, AMBITO_PROPIA, REGLA_META, TABLA_REGLAS
from ._mod_enlaces import EnlaceError, EnlacesCRUD, llamar_enlace

#: Nombre de la tool con la que una GD le pide sus reglas compartibles a su
#: central (ver _herr_reglas.py — si cambia allí, cambia aquí).
TOOL_REGLAS_COMPARTIDAS = "obtener_reglas_compartidas_gd"

# minimo: sin paginar — las reglas de una GD se cuentan por decenas, no por miles
LIMITE_REGLAS = 500

#: Mucho más corto que el de una consulta normal a una central
#: (TIMEOUT_ENLACE_SEGUNDOS, 30 s): las reglas globales se piden dentro del
#: `initialize` de MCP, así que una central lenta dejaría al cliente sin poder
#: ni conectarse. Sin sus reglas heredadas se trabaja; sin conexión, no.
TIMEOUT_REGLAS_HEREDADAS_SEGUNDOS = 5

#: Regla de dedo para enseñar en el panel lo que pesa el bloque global
#: (~4 caracteres por token en español): orientativo, no exacto.
CARACTERES_POR_TOKEN = 4

_CAMPOS_EDITABLES = ["texto", "categoria", "es_global", "prioridad", "activa", "reservada"]

#: Primero lo más prioritario y, a igualdad, lo más antiguo (el orden en que
#: el cliente las fue escribiendo).
ORDEN_REGLAS = "prioridad DESC, id ASC"


def _normalizar(datos: dict) -> dict:
    """Quita los espacios de sobra de texto y categoría, y no deja guardar
    ninguno de los dos en blanco: una regla vacía se le inyectaría a la IA
    igual, ocupando sitio sin decir nada, y una categoría con espacios de más
    partiría en dos un grupo que debería ser uno. El llamador convierte el
    ValueError en lo que toque (400 en el panel, ToolError en MCP)."""
    limpios = dict(datos)
    for campo in ("texto", "categoria"):
        if limpios.get(campo) is not None:
            limpios[campo] = limpios[campo].strip()
            if not limpios[campo]:
                raise ValueError(f"El campo '{campo}' de una regla no puede quedar en blanco")
    return limpios


class ReglasCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_REGLAS, config)

    async def listar_reglas(
        self, categoria: str | None = None, solo_globales: bool = False,
        incluir_inactivas: bool = False, solo_compartidas: bool = False,
    ) -> list[dict]:
        """`solo_compartidas` deja fuera las reservadas — es lo único que
        puede salir hacia una GD enlazada."""
        filtros = {}
        if categoria:
            filtros["categoria"] = {"op": "=", "valor": categoria}
        if solo_globales:
            filtros["es_global"] = {"op": "=", "valor": True}
        if not incluir_inactivas:
            filtros["activa"] = {"op": "=", "valor": True}
        if solo_compartidas:
            filtros["reservada"] = {"op": "=", "valor": False}
        filas, _ = await self.listar(filtros=filtros or None, orden=ORDEN_REGLAS, limit=LIMITE_REGLAS)
        return filas

    async def crear(self, datos: dict) -> int:
        return await self.insert(_normalizar({k: v for k, v in datos.items() if k in _CAMPOS_EDITABLES}))

    async def actualizar_campos(self, id_regla: int, datos: dict) -> dict | None:
        if not await self.obtener(id_regla):
            return None
        cambios = _normalizar({k: v for k, v in datos.items() if k in _CAMPOS_EDITABLES and v is not None})
        if cambios:
            await self.update(id_regla, cambios)
        return await self.obtener(id_regla)


async def reglas_heredadas(config: dict, categoria: str | None = None, solo_globales: bool = False) -> list[dict]:
    """Reglas de las GDs centrales enlazadas, pedidas en vivo (no se copian
    — ver _dep_reglas.py). Cada una lleva `ambito` heredada y `origen` (el
    nombre de la central). Una central caída se salta: quedarse sin las
    reglas heredadas no puede impedir trabajar con las propias."""
    heredadas = []
    for enlace in await EnlacesCRUD(config).listar_metadatos(SENTIDO_CENTRAL, solo_activos=True):
        con_clave = await EnlacesCRUD(config).obtener_con_clave(enlace["id"])
        try:
            reglas = await asyncio.wait_for(
                llamar_enlace(
                    enlace["url_mcp"], con_clave["api_key"], TOOL_REGLAS_COMPARTIDAS,
                    {"categoria": categoria, "solo_globales": solo_globales},
                ),
                timeout=TIMEOUT_REGLAS_HEREDADAS_SEGUNDOS,
            )
        except (EnlaceError, asyncio.TimeoutError):
            continue
        for regla in reglas or []:
            heredadas.append({**regla, "ambito": AMBITO_HEREDADA, "origen": enlace["nombre"]})
    return heredadas


async def reglas_con_heredadas(config: dict, categoria: str | None = None, solo_globales: bool = False) -> list[dict]:
    """Lo que se le da a la IA: primero las propias, después las heredadas.

    El orden ES la precedencia, y la regla meta se la explica (ver
    REGLA_META). No se descartan las heredadas de una categoría en la que
    haya reglas propias: una regla es texto libre y el servidor no puede
    saber si dos se contradicen de verdad o hablan de cosas distintas —
    tirarlas todas perdería instrucciones que no estorbaban."""
    propias = await ReglasCRUD(config).listar_reglas(categoria, solo_globales)
    return [{**r, "ambito": AMBITO_PROPIA} for r in propias] + await reglas_heredadas(config, categoria, solo_globales)


def _linea(regla: dict) -> str:
    return f"- [{regla['categoria']}] {regla['texto']}"


async def texto_reglas_globales(config: dict) -> str:
    """Bloque de texto con las reglas globales (propias y heredadas) más la
    regla meta, listo para meter en el contexto inicial de la IA. La regla
    meta va siempre, aunque el cliente no tenga ninguna regla todavía."""
    reglas = await reglas_con_heredadas(config, solo_globales=True)
    partes = []

    propias = [r for r in reglas if r["ambito"] == AMBITO_PROPIA]
    if propias:
        lineas = "\n".join(_linea(r) for r in propias)
        partes.append(f"Reglas de comportamiento de esta gestión documental:\n{lineas}")

    heredadas = [r for r in reglas if r["ambito"] == AMBITO_HEREDADA]
    for origen in dict.fromkeys(r["origen"] for r in heredadas):
        lineas = "\n".join(_linea(r) for r in heredadas if r["origen"] == origen)
        partes.append(f'Heredadas de la GD central "{origen}" (las de arriba mandan sobre estas):\n{lineas}')

    partes.append(REGLA_META)
    return "\n\n".join(partes)
