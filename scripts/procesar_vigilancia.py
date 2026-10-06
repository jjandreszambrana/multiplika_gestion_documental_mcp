#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Vigilancia de webs: lanza las comprobaciones que toquen (que la web
responde, certificado, dominio, administradores nuevos, plugins con fallos
conocidos...), avisa al momento de lo grave y, los lunes desde las 8:00,
manda el resumen semanal — ver docs/gestion-documental.md → "Webs y redes
sociales". Recorre cada proyecto de gestión documental activo; un fallo en
uno no para a los demás.

Como procesar_programaciones.py, NO es autocontenido: se lanza como módulo
para usar la misma lógica que las tools y el panel. Va en un cron propio
(y no dentro del de cada minuto) para que una web lenta no retrase los
avisos programados. Pensado para cada 5 minutos, desde la raíz del core
(cron `mcp_gd_vigilancia`):
    ENV_PATH=env/env.json python -m \\
        apps.mcp_server.paneles_cliente.multiplika_gestion_documental_mcp.scripts.procesar_vigilancia

Dos pasadas que se solapen no repiten nada: cada comprobación se reclama
con un UPDATE condicionado antes de lanzarla. Las largas (copias,
actualizaciones, auditorías SEO) solo las hace un proceso a la vez (cerrojo
de archivo): si una tarda una hora, las pasadas siguientes hacen solo las
rápidas y terminan enseguida, en vez de amontonarse procesos en memoria."""

import asyncio
import fcntl
import sys

from mtpk_mariadb import AsyncCrudBase

from database.config_db import get_db_config
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS

from ..database.modelos._mod_vigilancia import procesar_vigilancia


async def _proyectos_gestion_documental_activos() -> list[dict]:
    proyectos = AsyncCrudBase(TABLA_PROYECTOS, get_db_config("control"))
    filas, _ = await proyectos.listar(
        filtros={
            "motor": {"op": "=", "valor": "postgres"},
            "estado": {"op": "=", "valor": 1},
            "tipo_producto": {"op": "=", "valor": "gestion_documental"},
        },
        limit=1000,
    )
    return [p for p in filas if p.get("db_password_cifrada")]


CERROJO_LARGAS = "/tmp/mcp_gd_vigilancia_largas.lock"


def _cerrojo_largas():
    """El archivo abierto con el cerrojo puesto, o None si otro proceso lo tiene."""
    archivo = open(CERROJO_LARGAS, "w")
    try:
        fcntl.flock(archivo, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return archivo
    except BlockingIOError:
        archivo.close()
        return None


async def main() -> int:
    errores = 0
    cerrojo = _cerrojo_largas()  # se suelta solo al terminar el proceso
    for proyecto in await _proyectos_gestion_documental_activos():
        try:
            r = await procesar_vigilancia(get_db_config(proyecto["id"]), proyecto["id"], incluir_largas=cerrojo is not None)
        except Exception as e:  # tabla aún sin crear, base caída... sigue con el resto
            errores += 1
            print(f"[{proyecto['nombre']}] error: {e}", file=sys.stderr)
            continue
        if r["hechas"]:
            print(f"[{proyecto['nombre']}] comprobaciones: {r['hechas']}, graves: {r['graves']}")
        if r["resumen"]:
            print(f"[{proyecto['nombre']}] resumen semanal: {r['resumen']}")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
