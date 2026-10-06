"""GEO: medir si la empresa sale en las respuestas de las IAs (fase 6 de webs
y redes) — ver docs/gestion-documental.md → "Webs y redes sociales".

Se hacen las preguntas de la web a cada IA disponible (Claude con la clave
de la empresa; ChatGPT, Gemini y Perplexity si el cliente da su clave) y se
apunta si nombran la marca, si citan la web, en qué puesto y qué otros
sitios salen. Es una medida aproximada: las IAs cambian sus respuestas de
un día para otro; vale para ver tendencias, no posiciones exactas.

Cuesta dinero (cada pregunta es una consulta a cada IA, con búsqueda web):
por eso solo se mide una vez al mes, o cuando alguien lo pide."""

import json
import re
import unicodedata
import uuid
from datetime import datetime
from urllib.parse import urlparse

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_geo import TABLA_MEDICIONES, TABLA_PREGUNTAS
from . import _mod_geo_claude as claude
from ._mod_activos_digitales import ActivosDigitalesCRUD, ajustes_efectivos
from ._mod_comprobaciones_web import dominio_registrado
from ._mod_credenciales import CredencialesCRUD
from ._mod_geo_motores import MOTORES

MAX_PREGUNTAS = 50


def _normal(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")


def _dominio(url: str) -> str | None:
    host = urlparse(url).hostname
    return dominio_registrado(host) if host else None


def analizar(texto: str, urls: list[str], marcas: list[str], dominio_web: str) -> dict:
    """Si sale la marca (palabra entera, sin distinguir tildes), si cita la
    web, en qué puesto entre los sitios citados y quiénes más salen."""
    normal = _normal(texto)
    aparece = any(re.search(rf"\b{re.escape(_normal(m))}\b", normal) for m in marcas if m.strip())
    dominios = list(dict.fromkeys(d for d in (_dominio(u) for u in urls) if d))
    enlaza = dominio_web in dominios or dominio_web in normal
    posicion = dominios.index(dominio_web) + 1 if dominio_web in dominios else None
    competidores = [d for d in dominios if d != dominio_web][:10]
    return {"aparece": aparece or enlaza, "enlaza": enlaza, "posicion": posicion, "competidores": competidores}


def marcas_de(activo: dict) -> list[str]:
    elegidas = [m.strip() for m in (ajustes_efectivos(activo)["geo_marcas"] or "").split(",") if m.strip()]
    return elegidas or [activo["nombre"]]


# --- Preguntas ---

async def preguntas(config: dict, id_activo: int, solo_activas: bool = False) -> list[dict]:
    return await AsyncDatabase(**config).query(
        f'SELECT * FROM "{TABLA_PREGUNTAS.nombre}" WHERE id_activo = %s {"AND activa = true" if solo_activas else ""} ORDER BY id',
        (id_activo,))


async def anadir_preguntas(config: dict, id_activo: int, textos: list[str]) -> list[dict]:
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    if not activo["url"]:
        raise ValueError("El GEO se mide para webs (hace falta la dirección)")
    ya = await preguntas(config, id_activo)
    nuevas = [t.strip()[:500] for t in textos if t and t.strip() and t.strip() not in {p["pregunta"] for p in ya}]
    if len(ya) + len(nuevas) > MAX_PREGUNTAS:
        raise ValueError(f"Como mucho {MAX_PREGUNTAS} preguntas por web (cada una cuesta en cada medición)")
    crud = AsyncCrudBase(TABLA_PREGUNTAS, config)
    for t in nuevas:
        await crud.insert({"id_activo": id_activo, "pregunta": t})
    return await preguntas(config, id_activo)


async def cambiar_pregunta(config: dict, id_pregunta: int, activa: bool | None = None, borrar: bool = False) -> None:
    db = AsyncDatabase(**config)
    if borrar:
        await db.query(f'DELETE FROM "{TABLA_PREGUNTAS.nombre}" WHERE id = %s', (id_pregunta,))
    elif activa is not None:
        await db.query(f'UPDATE "{TABLA_PREGUNTAS.nombre}" SET activa = %s WHERE id = %s', (activa, id_pregunta))


# --- Medir ---

async def motores_disponibles(config: dict, id_proyecto: int) -> dict:
    """{motor: clave o None (Claude usa la de la empresa)}."""
    disponibles = {}
    if await claude.get_anthropic_api_key(id_proyecto):
        disponibles["claude"] = None
    credenciales = CredencialesCRUD(config)
    for motor, (nombre_credencial, _) in MOTORES.items():
        c = await credenciales.obtener_por_nombre(nombre_credencial)
        if c:
            disponibles[motor] = await credenciales.valor_descifrado(c["id"])
    return disponibles


async def medir(config: dict, id_proyecto: int, id_activo: int) -> dict:
    activo = await ActivosDigitalesCRUD(config).obtener_o_error(id_activo)
    lista = await preguntas(config, id_activo, solo_activas=True)
    if not lista:
        raise ValueError("Esta web no tiene preguntas de GEO: añade las que haría un cliente real")
    motores = await motores_disponibles(config, id_proyecto)
    if not motores:
        raise ValueError("No hay ninguna IA con la que medir: hace falta la clave de Anthropic de la empresa o una credencial "
                         "«openai», «gemini» o «perplexity»")
    marcas, dominio_web = marcas_de(activo), dominio_registrado(urlparse(activo["url"]).hostname or "")
    tanda, ahora = uuid.uuid4().hex[:12], datetime.now()
    crud = AsyncCrudBase(TABLA_MEDICIONES, config)
    for p in lista:
        for motor, clave in motores.items():
            fila = {"id_pregunta": p["id"], "id_activo": id_activo, "tanda": tanda, "fecha": ahora, "motor": motor}
            try:
                r = await (claude.preguntar(id_proyecto, p["pregunta"]) if motor == "claude" else MOTORES[motor][1](clave, p["pregunta"]))
                a = analizar(r["texto"], r["urls"], marcas, dominio_web)
                fila.update(modelo=r["modelo"], aparece=a["aparece"], enlaza=a["enlaza"], posicion=a["posicion"],
                            competidores=json.dumps(a["competidores"]), respuesta=r["texto"][:4000])
            except Exception as e:  # una IA caída o sin saldo no tumba las demás
                fila["error"] = str(e)[:500]
            await crud.insert(fila)
    return await resultados(config, id_activo)


async def resultados(config: dict, id_activo: int) -> dict:
    """La última medición y la anterior, para ver la tendencia."""
    db = AsyncDatabase(**config)
    tandas = await db.query(
        f'SELECT tanda, max(fecha) AS fecha FROM "{TABLA_MEDICIONES.nombre}" WHERE id_activo = %s GROUP BY tanda ORDER BY 2 DESC LIMIT 2',
        (id_activo,))
    if not tandas:
        return {"medido": False}

    async def de(tanda: str) -> dict:
        filas = await db.query(
            f'SELECT m.*, p.pregunta FROM "{TABLA_MEDICIONES.nombre}" m LEFT JOIN "{TABLA_PREGUNTAS.nombre}" p ON p.id = m.id_pregunta '
            "WHERE m.tanda = %s ORDER BY m.id", (tanda,))
        validas = [f for f in filas if not f["error"]]
        competidores: dict[str, int] = {}
        for f in validas:
            for d in json.loads(f["competidores"] or "[]"):
                competidores[d] = competidores.get(d, 0) + 1
        por_motor = {}
        for f in validas:
            m = por_motor.setdefault(f["motor"], {"respuestas": 0, "aparece": 0, "enlaza": 0})
            m["respuestas"] += 1
            m["aparece"] += bool(f["aparece"])
            m["enlaza"] += bool(f["enlaza"])
        return {"fecha": filas[0]["fecha"] if filas else None, "respuestas": len(validas),
                "aparece": sum(bool(f["aparece"]) for f in validas), "enlaza": sum(bool(f["enlaza"]) for f in validas),
                "por_motor": por_motor, "competidores": sorted(competidores.items(), key=lambda x: -x[1])[:10],
                "errores": [f"{f['motor']}: {f['error']}" for f in filas if f["error"]][:5],
                "detalle": [{k: f[k] for k in ("pregunta", "motor", "aparece", "enlaza", "posicion")} for f in validas]}

    actual = await de(tandas[0]["tanda"])
    return {"medido": True, "actual": actual, "anterior": await de(tandas[1]["tanda"]) if len(tandas) > 1 else None}


async def comprobacion(activo: dict, cliente, previo: dict, config: dict | None = None, id_proyecto: int | None = None,
                       **_) -> tuple[str, str, dict]:
    """Comprobación de vigilancia «geo» (una vez al mes)."""
    if not await preguntas(config, activo["id"], solo_activas=True):
        return "sin_datos", "Sin preguntas de GEO: añade las que haría un cliente real (pestaña SEO)", {}
    try:
        r = await medir(config, id_proyecto, activo["id"])
    except ValueError as e:
        return "sin_datos", str(e), {}
    a = r["actual"]
    if not a["respuestas"]:
        return "error", "Ninguna IA ha respondido: " + "; ".join(a["errores"]), {}
    pct = round(a["aparece"] * 100 / a["respuestas"])
    texto = f"Sale en {a['aparece']} de {a['respuestas']} respuestas de IAs ({pct} %)"
    ant = r["anterior"]
    if ant and ant["respuestas"]:
        texto += f"; el mes pasado, {round(ant['aparece'] * 100 / ant['respuestas'])} %"
    return ("aviso" if pct == 0 else "ok"), texto, {"porcentaje": pct}
