#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Mantenimiento diario de los cambios en webs y redes (gd_cambios_externos)
— ver docs/gestion-documental.md → "Webs y redes sociales":

- Caduca las propuestas que nadie ha aprobado en el plazo del activo.
- Borra los resultados de la vigilancia más antiguos que su plazo
  (gd_resultados_comprobacion).
- Borra la copia (antes/después) de los cambios más antiguos de lo que el
  cliente quiere guardar en cada activo: puede llevar datos personales. El
  resumen del cambio se queda, pero ya no se puede deshacer.

Cada activo con sus plazos (gd_activos_digitales.ajustes). Autocontenido y
con SQL en línea, mismo patrón que scripts/limpiar_actividad.py: si cambian
los ajustes o sus valores por defecto en database/modelos/
_mod_activos_digitales.py (AJUSTES), hay que tocar también aquí.

Uso: python scripts/limpiar_cambios_web.py [--simular]
Necesita ENV_PATH apuntando a env/env.json (ver docs/despliegue.md)."""

import argparse
import asyncio
import json
import os
import sys

_RAIZ_CORE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))))
sys.path.insert(0, _RAIZ_CORE)

from mtpk_mariadb import AsyncCrudBase  # noqa: E402
from mtpk_postgres.async_adapter import AsyncDatabase  # noqa: E402

from database.config_db import get_db_config  # noqa: E402
from database.control.dependencias._dep_proyectos import TABLA_PROYECTOS  # noqa: E402

# Mismos valores por defecto que AJUSTES en _mod_activos_digitales.py
DEFECTO_CADUCIDAD_PROPUESTAS_DIAS = 7
DEFECTO_CONSERVAR_DETALLE_DIAS = 365
DEFECTO_CONSERVAR_RESULTADOS_DIAS = 365


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


async def _tiene_tablas(db: AsyncDatabase) -> bool:
    fila = await db.query("SELECT to_regclass('gd_cambios_externos') IS NOT NULL AS hay", uno=True)
    return bool(fila and fila["hay"])


async def procesar(config: dict, simular: bool) -> dict:
    db = AsyncDatabase(**config)
    if not await _tiene_tablas(db):
        return {"caducadas": 0, "purgados": 0, "resultados": 0}
    caducadas = purgados = resultados = 0
    hay_vigilancia = (await db.query("SELECT to_regclass('gd_resultados_comprobacion') IS NOT NULL AS hay", uno=True))["hay"]
    for activo in await db.query("SELECT id, ajustes FROM gd_activos_digitales"):
        ajustes = json.loads(activo["ajustes"] or "{}")
        dias_caducidad = str(ajustes.get("caducidad_propuestas_dias", DEFECTO_CADUCIDAD_PROPUESTAS_DIAS))
        dias_conservar = str(ajustes.get("conservar_detalle_cambios_dias", DEFECTO_CONSERVAR_DETALLE_DIAS))
        dias_resultados = str(ajustes.get("conservar_resultados_dias", DEFECTO_CONSERVAR_RESULTADOS_DIAS))
        condicion_resultados = "id_activo = %s AND fecha < CURRENT_TIMESTAMP - (%s || ' days')::interval"
        condicion_caducar = ("id_activo = %s AND estado = 'propuesto' "
                             "AND fecha_propuesta < CURRENT_TIMESTAMP - (%s || ' days')::interval")
        condicion_purgar = ("id_activo = %s AND detalle_purgado = false "
                            "AND fecha_propuesta < CURRENT_TIMESTAMP - (%s || ' days')::interval")
        if simular:
            caducadas += (await db.query(f"SELECT COUNT(*) AS n FROM gd_cambios_externos WHERE {condicion_caducar}",
                                         (activo["id"], dias_caducidad), uno=True))["n"]
            purgados += (await db.query(f"SELECT COUNT(*) AS n FROM gd_cambios_externos WHERE {condicion_purgar}",
                                        (activo["id"], dias_conservar), uno=True))["n"]
            if hay_vigilancia:
                resultados += (await db.query(f"SELECT COUNT(*) AS n FROM gd_resultados_comprobacion WHERE {condicion_resultados}",
                                              (activo["id"], dias_resultados), uno=True))["n"]
            continue
        caducadas += await db.query(
            "UPDATE gd_cambios_externos SET estado = 'caducado', fecha_resolucion = CURRENT_TIMESTAMP, "
            f"resultado = 'Caducada: nadie la aprobó a tiempo' WHERE {condicion_caducar}",
            (activo["id"], dias_caducidad)) or 0
        purgados += await db.query(
            "UPDATE gd_cambios_externos SET datos_antes = NULL, datos_despues = NULL, datos_aplicados = NULL, "
            f"detalle_purgado = true WHERE {condicion_purgar}",
            (activo["id"], dias_conservar)) or 0
        if hay_vigilancia:
            resultados += await db.query(f"DELETE FROM gd_resultados_comprobacion WHERE {condicion_resultados}",
                                         (activo["id"], dias_resultados)) or 0
    return {"caducadas": caducadas, "purgados": purgados, "resultados": resultados}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simular", action="store_true", help="No cambia nada, solo cuenta")
    args = parser.parse_args()
    for proyecto in await _proyectos_gestion_documental_activos():
        r = await procesar(get_db_config(proyecto["id"]), args.simular)
        prefijo = "(--simular) se harían: " if args.simular else ""
        print(f"{proyecto['nombre']}: {prefijo}{r['caducadas']} propuesta(s) caducada(s), "
              f"{r['purgados']} copia(s) de cambios borrada(s), {r['resultados']} resultado(s) de vigilancia borrado(s).")


if __name__ == "__main__":
    asyncio.run(main())
