#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Hace las copias de seguridad programadas de la base de cada cliente —
ver docs/gestion-documental.md → "Copias de seguridad de la base de
datos". Recorre cada proyecto de gestión documental activo; un fallo en
uno no para a los demás (y queda apuntado en sus ajustes, para que el
panel lo enseñe).

Aparte de procesar_programaciones.py a propósito: un pg_dump grande
puede tardar minutos, y aquel corre cada minuto con avisos que no deben
retrasarse.

Como módulo, desde la raíz del core, cada 5 minutos (cron
`mcp_gd_copias_bd`):
    ENV_PATH=env/env.json python -m \\
        apps.mcp_server.paneles_cliente.multiplika_gestion_documental_mcp.scripts.procesar_copias_bd"""

import asyncio
import sys

from database.config_db import get_db_config

from ..database.modelos._mod_copias_bd import procesar_programada
from .procesar_programaciones import _proyectos_gestion_documental_activos


async def main() -> int:
    errores = 0
    for proyecto in await _proyectos_gestion_documental_activos():
        try:
            linea = await procesar_programada(proyecto["id"], get_db_config(proyecto["id"]))
        except Exception as e:  # base caída, disco lleno...: sigue con el resto
            errores += 1
            print(f"[{proyecto['nombre']}] error: {e}", file=sys.stderr)
            continue
        if linea:
            print(f"[{proyecto['nombre']}] copia de la base: {linea}")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
