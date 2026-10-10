#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Mantenimiento de la biblioteca del asesor contable — ver
docs/contabilidad/fuentes.md → "Mantenimiento". Se ejecuta en LOCAL, no en
el servidor: lo que cambia se revisa, se hace commit y se sube con el
despliegue de siempre.

    python scripts/biblioteca_contable.py normativa   # baja/actualiza del BOE los artículos citados
    python scripts/biblioteca_contable.py comprobar   # revisa ids, campos obligatorios y enlaces

`normativa` recorre las `fuentes` de todos los temas con forma
`<id BOE>/<id bloque>` y, para cada norma, baja su índice de la API de
datos abiertos del BOE (sin clave). Un artículo que no está guardado, o
cuya `fecha_actualizacion` en el índice ha cambiado, se vuelve a bajar
entero (la API da todas sus versiones) y se guardan la vigente y las que
han estado vigentes en los últimos `ANIOS_HISTORICO` años. Si el texto
vigente cambió, se marca `cambiado` con la fecha de hoy: los temas que lo
citan salen como "pendiente de revisar" (database/biblioteca_contable.py)."""

import argparse
import datetime
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "database"))
import biblioteca_contable  # noqa: E402  (el módulo, sin el paquete: no necesita el núcleo)

API_BOE = "https://www.boe.es/datosabiertos/api/legislacion-consolidada/id"
URL_WEB_BOE = "https://www.boe.es/buscar/act.php?id={norma}#{bloque}"
TIMEOUT_SEGUNDOS = 30
ANIOS_HISTORICO = 2
PATRON_FUENTE_BOE = re.compile(r"^(BOE-[A-Z]-\d{4}-\d+)/([\w-]+)$")
RANGOS_ID = {"area": (1, 99), "bloque": (100, 999), "capitulo": (1000, 9999), "tema": (10000, 10**9)}
CAMPOS_TEMA = ("titulo", "resumen", "palabras_clave", "aplica_a", "revisado", "revisado_por", "fuentes")
MAX_PALABRAS_TEMA = 1400  # 1.200 de guía + margen para el asiento de ejemplo


def _pedir(url: str, tipo: str) -> bytes:
    peticion = urllib.request.Request(url, headers={"Accept": tipo})
    with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
        return respuesta.read()


def _escribir(fichero: Path, cabecera: dict, cuerpo: str) -> None:
    texto_cabecera = yaml.safe_dump(cabecera, allow_unicode=True, sort_keys=False)
    fichero.write_text(f"---\n{texto_cabecera}---\n{cuerpo}\n", encoding="utf-8")


def _fecha_boe(valor: str) -> str:
    return f"{valor[:4]}-{valor[4:6]}-{valor[6:8]}"


def _texto_version(version: ET.Element) -> tuple[str, str]:
    """(título del artículo, cuerpo en Markdown) de un <version> del BOE."""
    lineas, titulo = [], ""
    for elemento in version:
        if elemento.tag == "table":
            filas = [" | ".join("".join(c.itertext()).strip() for c in fila) for fila in elemento.iter("tr")]
            lineas.append("\n".join(filas))
            continue
        texto = " ".join("".join(elemento.itertext()).split())
        if not texto:
            continue
        if elemento.get("class") == "articulo" and not titulo:
            titulo = texto
            continue
        lineas.append(texto)
    return titulo, "\n\n".join(lineas)


def _bajar_articulo(norma: str, bloque: str, fecha_actualizacion: str, carpeta: Path) -> bool:
    """Baja un artículo y guarda sus versiones. True si cambió el texto vigente."""
    xml = ET.fromstring(_pedir(f"{API_BOE}/{norma}/texto/bloque/{bloque}", "application/xml"))
    versiones = xml.findall("./data/bloque/version")
    if not versiones:
        raise ValueError(f"{norma}/{bloque}: el BOE no devuelve ninguna versión")
    limite = (datetime.date.today() - datetime.timedelta(days=365 * ANIOS_HISTORICO)).isoformat()
    actual = carpeta / f"{bloque}.md"
    texto_anterior = biblioteca_contable._leer(actual)[1] if actual.is_file() else None
    cambio = False
    for i, version in enumerate(versiones):
        desde = _fecha_boe(version.get("fecha_vigencia") or version.get("fecha_publicacion"))
        hasta = _fecha_boe(versiones[i + 1].get("fecha_vigencia")) if i + 1 < len(versiones) else None
        if hasta and hasta < limite:
            continue
        titulo, cuerpo = _texto_version(version)
        cabecera = {
            "articulo": titulo, "id_bloque": bloque, "vigente_desde": desde, "vigente_hasta": hasta,
            "fecha_actualizacion": fecha_actualizacion, "descargado": datetime.date.today().isoformat(),
            "url": URL_WEB_BOE.format(norma=norma, bloque=bloque),
        }
        if hasta is None:
            cambio = texto_anterior is not None and texto_anterior != cuerpo
            if cambio:
                cabecera["cambiado"] = datetime.date.today().isoformat()
            elif actual.is_file():
                previo = biblioteca_contable._leer(actual)[0].get("cambiado")
                if previo:
                    cabecera["cambiado"] = str(previo)
            _escribir(actual, cabecera, cuerpo)
        else:
            _escribir(carpeta / f"{bloque}.{desde}.md", cabecera, cuerpo)
    return cambio


def normativa() -> None:
    nodos, _, _ = biblioteca_contable._biblioteca()
    citados: dict[str, set[str]] = {}
    for nodo in nodos.values():
        for id_fuente in nodo.get("fuentes") or []:
            if coincidencia := PATRON_FUENTE_BOE.match(str(id_fuente)):
                citados.setdefault(coincidencia[1], set()).add(coincidencia[2])

    for norma, bloques in sorted(citados.items()):
        carpeta = biblioteca_contable.DIRECTORIO / "normativa" / norma
        carpeta.mkdir(parents=True, exist_ok=True)
        if not (carpeta / biblioteca_contable.FICHERO_NORMA).is_file():
            datos = json.loads(_pedir(f"{API_BOE}/{norma}/metadatos", "application/json"))["data"]
            datos = datos[0] if isinstance(datos, list) else datos
            _escribir(carpeta / biblioteca_contable.FICHERO_NORMA, {"titulo": datos["titulo"], "id": norma}, "")
        indice = json.loads(_pedir(f"{API_BOE}/{norma}/texto/indice", "application/json"))["data"][0]["bloque"]
        fechas = {b["id"]: b.get("fecha_actualizacion") for b in indice}
        for bloque in sorted(bloques):
            if bloque not in fechas:
                print(f"AVISO {norma}/{bloque}: no existe en el índice del BOE (¿derogado o id mal escrito?)")
                continue
            guardado = carpeta / f"{bloque}.md"
            if guardado.is_file() and str(biblioteca_contable._leer(guardado)[0].get("fecha_actualizacion")) == str(fechas[bloque]):
                continue
            cambio = _bajar_articulo(norma, bloque, fechas[bloque], carpeta)
            print(f"{'CAMBIADO' if cambio else 'guardado'} {norma}/{bloque}")


def comprobar() -> int:
    """Lista los problemas de la biblioteca; devuelve cuántos hay."""
    nodos, _, fuentes = biblioteca_contable._biblioteca()
    problemas = []
    for fichero in (biblioteca_contable.DIRECTORIO / "temas").rglob("*.md"):
        cabecera, _ = biblioteca_contable._leer(fichero)
        id_nodo = cabecera.get("id")
        if not isinstance(id_nodo, int) or nodos.get(id_nodo, {}).get("titulo") != cabecera.get("titulo"):
            problemas.append(f"{fichero}: id ausente o repetido ({id_nodo})")
    for nodo in nodos.values():
        minimo, maximo = RANGOS_ID[nodo["tipo"]]
        sitio = f"{nodo['tipo']} {nodo['id']} ({nodo.get('titulo')})"
        if not minimo <= nodo["id"] <= maximo:
            problemas.append(f"{sitio}: el id no está en el rango de su tipo {minimo}-{maximo}")
        if not nodo.get("titulo") or not nodo.get("resumen"):
            problemas.append(f"{sitio}: falta título o resumen")
        if nodo["tipo"] != "tema":
            continue
        problemas += [f"{sitio}: falta {c}" for c in CAMPOS_TEMA if not nodo.get(c)]
        if len(nodo.get("cuerpo", "").split()) > MAX_PALABRAS_TEMA:
            problemas.append(f"{sitio}: pasa de {MAX_PALABRAS_TEMA} palabras, conviene partirlo")
        problemas += [f"{sitio}: relacionado {r} no es un tema" for r in nodo.get("relacionados") or [] if nodos.get(r, {}).get("tipo") != "tema"]
        problemas += [f"{sitio}: fuente {f} sin guardar (¿falta ejecutar normativa?)" for f in nodo.get("fuentes") or [] if f not in fuentes]
    print("\n".join(problemas) or "Sin problemas.")
    return len(problemas)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("orden", choices=["normativa", "comprobar"])
    orden = parser.parse_args().orden
    if orden == "normativa":
        normativa()
    else:
        sys.exit(1 if comprobar() else 0)
