"""Biblioteca del asesor contable — ver docs/contabilidad/planificacion.md
(fase 1) y docs/contabilidad/estructura-temas.md.

Tres capas, todo en ficheros Markdown con cabecera YAML bajo
`conocimiento_contable/` (igual para todos los clientes; lo propio de cada
uno va en sus reglas):

- `temas/`: árbol área → bloque → capítulo → tema. Cada carpeta lleva un
  `_nodo.md` con su id, título y resumen; cada tema es un `.md` con su id.
  Manda el `id` de dentro, no el nombre del fichero (el prefijo numérico
  solo da el orden).
- `normativa/<id BOE>/`: artículos literales del BOE, uno por fichero
  (`<id_bloque>.md` el vigente, `<id_bloque>.<vigente_desde>.md` los
  anteriores). Los escribe scripts/normativa_boe.py.
- `doctrina/`: resúmenes propios de consultas de la DGT citadas.

Se lee del disco una vez por proceso. Un id que llega en una petición se
busca en lo ya cargado y nunca se usa para componer una ruta."""

import datetime
import functools
import logging
import unicodedata
from pathlib import Path

import yaml

DIRECTORIO = Path(__file__).parent / "conocimiento_contable"
FICHERO_NODO = "_nodo.md"
FICHERO_NORMA = "_norma.md"
TIPOS_POR_PROFUNDIDAD = ("area", "bloque", "capitulo")
MESES_PARA_CADUCAR = 12
LIMITE_BUSQUEDA = 8
PESO_TITULO, PESO_CLAVE, PESO_RESUMEN = 3, 3, 1
SIN_REVISAR = "pendiente"

logger = logging.getLogger(__name__)


def _leer(fichero: Path) -> tuple[dict, str]:
    """(cabecera, cuerpo) de un Markdown con cabecera YAML entre `---`."""
    texto = fichero.read_text(encoding="utf-8")
    if not texto.startswith("---"):
        return {}, texto
    _, cabecera, cuerpo = texto.split("---", 2)
    return yaml.safe_load(cabecera) or {}, cuerpo.strip()


def _normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in sin_tildes if not unicodedata.combining(c))


def _como_fecha(valor) -> datetime.date | None:
    if isinstance(valor, datetime.date):
        return valor
    try:
        return datetime.date.fromisoformat(str(valor))
    except ValueError:
        return None


def _cargar_arbol(carpeta: Path, padre: int | None, posicion: str, profundidad: int, nodos: dict) -> list[int]:
    """Carga una carpeta del árbol y devuelve los ids de sus hijos en orden."""
    hijos = []
    for elemento in sorted(carpeta.iterdir()):
        es_carpeta = elemento.is_dir()
        if not es_carpeta and (elemento.suffix != ".md" or elemento.name == FICHERO_NODO):
            continue
        fichero = elemento / FICHERO_NODO if es_carpeta else elemento
        if not fichero.is_file():
            logger.warning("biblioteca contable: %s no tiene %s, se ignora", elemento, FICHERO_NODO)
            continue
        cabecera, cuerpo = _leer(fichero)
        id_nodo = cabecera.get("id")
        if not isinstance(id_nodo, int) or id_nodo in nodos:
            logger.warning("biblioteca contable: id ausente o repetido en %s, se ignora", fichero)
            continue
        pos = f"{posicion}.{len(hijos) + 1}" if posicion else str(len(hijos) + 1)
        nodo = {
            **cabecera, "id": id_nodo, "padre": padre, "posicion": pos,
            "tipo": "tema" if not es_carpeta else TIPOS_POR_PROFUNDIDAD[min(profundidad, 2)],
        }
        nodos[id_nodo] = nodo
        if es_carpeta:
            nodo["hijos"] = _cargar_arbol(elemento, id_nodo, pos, profundidad + 1, nodos)
        else:
            nodo["cuerpo"] = cuerpo
        hijos.append(id_nodo)
    return hijos


def _cargar_fuentes() -> dict:
    """{id_fuente: [versiones, la vigente primero]} de normativa/ y doctrina/.
    El id de un artículo es `<id BOE>/<id_bloque>`; el de una consulta, el
    nombre del fichero."""
    fuentes = {}
    for norma in sorted((DIRECTORIO / "normativa").glob("*/")):
        datos_norma, _ = _leer(norma / FICHERO_NORMA) if (norma / FICHERO_NORMA).is_file() else ({}, "")
        for fichero in sorted(norma.glob("*.md")):
            if fichero.name == FICHERO_NORMA:
                continue
            cabecera, cuerpo = _leer(fichero)
            id_bloque = fichero.name.split(".")[0]
            version = {**cabecera, "norma": norma.name, "titulo_norma": datos_norma.get("titulo"), "texto": cuerpo}
            fuentes.setdefault(f"{norma.name}/{id_bloque}", []).append(version)
    for fichero in sorted((DIRECTORIO / "doctrina").glob("*.md")):
        cabecera, cuerpo = _leer(fichero)
        fuentes[fichero.stem] = [{**cabecera, "texto": cuerpo}]
    for versiones in fuentes.values():
        versiones.sort(key=lambda v: str(v.get("vigente_desde") or ""), reverse=True)
    return fuentes


@functools.cache
def _biblioteca() -> tuple[dict, list[int], dict]:
    nodos = {}
    raiz = _cargar_arbol(DIRECTORIO / "temas", None, "", 0, nodos) if (DIRECTORIO / "temas").is_dir() else []
    return nodos, raiz, _cargar_fuentes()


def _tiene_temas(nodo: dict, nodos: dict) -> bool:
    return nodo["tipo"] == "tema" or any(_tiene_temas(nodos[i], nodos) for i in nodo["hijos"])


def _hijos_con_temas(ids: list[int], nodos: dict) -> list[dict]:
    """Las partes del árbol que aún no tienen ningún tema escrito no se enseñan."""
    return [_resumen_nodo(nodos[i]) for i in ids if _tiene_temas(nodos[i], nodos)]


def _resumen_nodo(nodo: dict) -> dict:
    datos = {k: nodo.get(k) for k in ("id", "tipo", "posicion", "titulo", "resumen")}
    if nodo["tipo"] != "tema":
        datos["hijos"] = len(nodo["hijos"])
    return datos


def _ruta(nodo: dict, nodos: dict) -> list[dict]:
    ruta = []
    while nodo["padre"] is not None:
        nodo = nodos[nodo["padre"]]
        ruta.insert(0, {"id": nodo["id"], "posicion": nodo["posicion"], "titulo": nodo.get("titulo")})
    return ruta


def _avisos(tema: dict, fuentes: dict) -> list[str]:
    """Lo que la IA tiene que decir al usar el tema: se calcula aquí para no
    dejarle a ella las cuentas con fechas."""
    avisos = []
    if (tema.get("revisado_por") or SIN_REVISAR) == SIN_REVISAR:
        avisos.append("Tema no revisado todavía: dilo al usarlo.")
    revisado = _como_fecha(tema.get("revisado"))
    if revisado and (datetime.date.today() - revisado).days > MESES_PARA_CADUCAR * 30:
        avisos.append(f"Revisado por última vez el {revisado}: puede estar desactualizado, avísalo.")
    cambiadas = [
        f for f in tema.get("fuentes") or []
        if revisado and (c := _como_fecha((fuentes.get(f) or [{}])[0].get("cambiado"))) and c > revisado
    ]
    if cambiadas:
        avisos.append(f"Pendiente de revisar: la norma citada cambió después de revisarlo ({', '.join(cambiadas)}).")
    return avisos


def indice(id_nodo: int | None = None) -> dict | None:
    """Hijos de un nodo (sin id: las áreas). None si el nodo no existe o es un tema."""
    nodos, raiz, _ = _biblioteca()
    if id_nodo is None:
        return {"nodo": None, "hijos": _hijos_con_temas(raiz, nodos)}
    nodo = nodos.get(id_nodo)
    if not nodo or nodo["tipo"] == "tema":
        return None
    return {
        "nodo": {**_resumen_nodo(nodo), "ruta": _ruta(nodo, nodos)},
        "hijos": _hijos_con_temas(nodo["hijos"], nodos),
    }


def tema(id_tema: int) -> dict | None:
    nodos, _, fuentes = _biblioteca()
    nodo = nodos.get(id_tema)
    if not nodo or nodo["tipo"] != "tema":
        return None
    relacionados = [_resumen_nodo(nodos[i]) for i in nodo.get("relacionados") or [] if nodos.get(i, {}).get("tipo") == "tema"]
    return {
        **{k: v for k, v in nodo.items() if k not in ("padre", "relacionados")},
        "ruta": _ruta(nodo, nodos), "relacionados": relacionados, "avisos": _avisos(nodo, fuentes),
        "fuentes": [{"id": f, "disponible": f in fuentes} for f in nodo.get("fuentes") or []],
    }


def buscar(texto: str) -> list[dict]:
    """Temas que más se parecen a `texto`, por palabras en título, palabras
    clave y resumen (sin tildes ni mayúsculas)."""
    nodos, _, _ = _biblioteca()
    palabras = [p for p in _normalizar(texto).split() if p]
    if not palabras:
        return []
    resultados = []
    for nodo in nodos.values():
        if nodo["tipo"] != "tema":
            continue
        titulo = _normalizar(nodo.get("titulo") or "")
        claves = _normalizar(" ".join(str(c) for c in nodo.get("palabras_clave") or []))
        resumen = _normalizar(nodo.get("resumen") or "")
        puntos = sum(
            PESO_TITULO * (p in titulo) + PESO_CLAVE * (p in claves) + PESO_RESUMEN * (p in resumen)
            for p in palabras
        )
        if puntos:
            resultados.append((puntos, {**_resumen_nodo(nodo), "ruta": _ruta(nodo, nodos)}))
    resultados.sort(key=lambda r: -r[0])
    return [r for _, r in resultados[:LIMITE_BUSQUEDA]]


def fuente(id_fuente: str, fecha: str | None = None) -> dict | None:
    """Un artículo o una consulta. Con `fecha` (AAAA-MM-DD), la versión que
    estaba vigente ese día si se conserva; si no, None."""
    _, _, fuentes = _biblioteca()
    versiones = fuentes.get(id_fuente)
    if not versiones:
        return None
    if not fecha:
        return {"id": id_fuente, **versiones[0]}
    dia = _como_fecha(fecha)
    for version in versiones:
        desde = _como_fecha(version.get("vigente_desde"))
        if dia and (not desde or desde <= dia):
            return {"id": id_fuente, **version}
    return None
