#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Limpieza de fondo del chat de IA: borra las conversaciones de
`gd_chat_conversaciones` que lleven mucho tiempo sin usarse (por
`fecha_actualizacion`) — ver docs/gestion-documental.md → "Chat de IA" y
`database/modelos/_mod_chat.py`. Borrado físico, sin ninguna papelera:
una vez pasado el umbral, la conversación desaparece de verdad, igual
que al borrarla a mano desde el panel.

Recorre TODOS los proyectos activos de `tipo_producto='gestion_documental'`
(misma consulta a la base de control que scripts/avisar_caducidades.py).

Autocontenido a propósito, igual que avisar_caducidades.py: no importa la
capa `database/modelos` de este repo (sus imports relativos están
pensados para desplegarse bajo `apps.mcp_server.*`, no para correr como
script suelto) — borra con SQL en línea directamente sobre
`gd_chat_conversaciones`. Si el esquema de esa tabla cambia, hay que
tocar también aquí.

Pensado para cron, corriendo ya desplegado en
apps/mcp_server/paneles_cliente/multiplika_gestion_documental_mcp/scripts/
(mismo patrón que avisar_caducidades.py) — 5 niveles por encima está la
raíz del repo core, de donde salen `database.config_db` (resuelve el
alias -> credenciales reales, con descifrado) y
`database.control.dependencias._dep_proyectos` (mcpc_proyectos).

Una vez al mes basta — es limpieza de fondo, no algo con urgencia diaria.

Uso: python scripts/limpiar_conversaciones_chat.py [--dias 180] [--simular]
Necesita ENV_PATH apuntando a env/env.json, igual que el resto de scripts
que corren ya desplegados (ver docs/despliegue.md)."""

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

DIAS_POR_DEFECTO = 180


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


async def _conversaciones_inactivas(config: dict, dias: int) -> list[dict]:
    db = AsyncDatabase(**config)
    sql = """
        SELECT id, id_usuario, titulo, fecha_actualizacion
        FROM gd_chat_conversaciones
        WHERE fecha_actualizacion < CURRENT_TIMESTAMP - (%s || ' days')::interval
        ORDER BY fecha_actualizacion ASC
    """
    return await db.query(sql, (str(dias),))


async def _borrar_conversaciones(config: dict, dias: int) -> int:
    db = AsyncDatabase(**config)
    sql = """
        DELETE FROM gd_chat_conversaciones
        WHERE fecha_actualizacion < CURRENT_TIMESTAMP - (%s || ' days')::interval
    """
    return await db.query(sql, (str(dias),))


async def _procesar_proyecto(proyecto: dict, dias: int, simular: bool) -> None:
    config = get_db_config(proyecto["id"])
    inactivas = await _conversaciones_inactivas(config, dias)
    if not inactivas:
        print(f"{proyecto['nombre']}: ninguna conversación inactiva desde hace más de {dias} días.")
        return

    if simular:
        print(f"{proyecto['nombre']}: se borrarían {len(inactivas)} conversación(es) (--simular, no se borra nada):")
        for c in inactivas:
            print(f"  - id={c['id']} usuario={c['id_usuario']} titulo={c['titulo'] or '(sin título)'} "
                  f"última actividad={c['fecha_actualizacion']}")
        return

    borradas = await _borrar_conversaciones(config, dias)
    print(f"{proyecto['nombre']}: borradas {borradas} conversación(es) inactivas desde hace más de {dias} días.")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dias", type=int, default=DIAS_POR_DEFECTO)
    parser.add_argument("--simular", action="store_true", help="No borra nada, solo cuenta y lista")
    args = parser.parse_args()

    for proyecto in await _proyectos_gestion_documental_activos():
        await _procesar_proyecto(proyecto, args.dias, args.simular)


if __name__ == "__main__":
    asyncio.run(main())
