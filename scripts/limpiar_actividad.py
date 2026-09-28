#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Limpieza de fondo del registro de actividad: borra los apuntes de
`gd_actividad` con más de 365 días — ver docs/gestion-documental.md →
"Registro de actividad". Borrado físico, sin papelera.

Recorre TODOS los proyectos activos de `tipo_producto='gestion_documental'`.
Autocontenido y con SQL en línea, mismo patrón y mismos motivos que
scripts/limpiar_conversaciones_chat.py (ver su docstring). Si el esquema
de gd_actividad cambia, hay que tocar también aquí.

Pensado para cron mensual, ya desplegado en
apps/mcp_server/paneles_cliente/multiplika_gestion_documental_mcp/scripts/.

Uso: python scripts/limpiar_actividad.py [--dias 365] [--simular]
Necesita ENV_PATH apuntando a env/env.json (ver docs/despliegue.md)."""

import argparse
import asyncio
import os
import sys

_RAIZ_CORE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))))
sys.path.insert(0, _RAIZ_CORE)

from mtpk_mariadb import AsyncCrudBase  # noqa: E402
from mtpk_postgres.async_adapter import AsyncDatabase  # noqa: E402

from database.config_db import get_db_config  # noqa: E402
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS  # noqa: E402

DIAS_POR_DEFECTO = 365


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


async def _contar_antiguos(config: dict, dias: int) -> int:
    db = AsyncDatabase(**config)
    sql = """
        SELECT COUNT(*) AS n FROM gd_actividad
        WHERE fecha < CURRENT_TIMESTAMP - (%s || ' days')::interval
    """
    return (await db.query(sql, (str(dias),)))[0]["n"]


async def _borrar_antiguos(config: dict, dias: int) -> int:
    db = AsyncDatabase(**config)
    sql = """
        DELETE FROM gd_actividad
        WHERE fecha < CURRENT_TIMESTAMP - (%s || ' days')::interval
    """
    return await db.query(sql, (str(dias),))


async def _procesar_proyecto(proyecto: dict, dias: int, simular: bool) -> None:
    config = get_db_config(proyecto["id"])
    antiguos = await _contar_antiguos(config, dias)
    if not antiguos:
        print(f"{proyecto['nombre']}: ningún apunte de actividad con más de {dias} días.")
        return
    if simular:
        print(f"{proyecto['nombre']}: se borrarían {antiguos} apunte(s) (--simular, no se borra nada).")
        return
    borrados = await _borrar_antiguos(config, dias)
    print(f"{proyecto['nombre']}: borrados {borrados} apunte(s) de actividad con más de {dias} días.")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dias", type=int, default=DIAS_POR_DEFECTO)
    parser.add_argument("--simular", action="store_true", help="No borra nada, solo cuenta y lista")
    args = parser.parse_args()

    for proyecto in await _proyectos_gestion_documental_activos():
        await _procesar_proyecto(proyecto, args.dias, args.simular)


if __name__ == "__main__":
    asyncio.run(main())
