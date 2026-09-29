#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Hace saltar las programaciones cuya hora ya llegó y manda los
recordatorios de los avisos sin "Hecho" — ver docs/gestion-documental.md
→ "Programaciones y notificaciones". Recorre cada proyecto de gestión
documental activo; un fallo en uno no para a los demás.

A diferencia de avisar_caducidades.py y compañía, NO es autocontenido:
se lanza como módulo (python -m) para usar la misma lógica que las tools
y el panel (database/modelos/_mod_programaciones.py) en vez de copiarla.
El lío que evitan los otros (imports relativos de database/modelos que
fallan en un script suelto) no aparece así, porque el paquete se resuelve
entero desde la raíz del core, igual que el panel.

Pensado para cron CADA MINUTO, desde la raíz del core (cron
`mcp_gd_programaciones`):
    ENV_PATH=env/env.json python -m \
        apps.mcp_server.paneles_cliente.multiplika_gestion_documental_mcp.scripts.procesar_programaciones

Las dos pasadas que puedan solaparse no repiten nada: cada programación y
cada recordatorio se "reclama" con un UPDATE condicionado antes de avisar."""

import asyncio
import sys

from mtpk_mariadb import AsyncCrudBase

from database.config_db import get_db_config
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS

from ..database.modelos._mod_programaciones import procesar_pendientes


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


async def main() -> int:
    errores = 0
    for proyecto in await _proyectos_gestion_documental_activos():
        try:
            resultado = await procesar_pendientes(get_db_config(proyecto["id"]), proyecto["id"])
        except Exception as e:  # tabla aún sin crear, base caída... sigue con el resto
            errores += 1
            print(f"[{proyecto['nombre']}] error: {e}", file=sys.stderr)
            continue
        if resultado["saltadas"] or resultado["recordatorios"]:
            print(f"[{proyecto['nombre']}] avisos: {resultado['saltadas']}, recordatorios: {resultado['recordatorios']}")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
