#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Revisión nocturna de la contabilidad del SIF — ver
docs/contabilidad/planificacion.md (fase 4). En cada GD con el asesor
contable activado, para cada acceso al SIF de un usuario:

1. Vuelve a preguntar al SIF qué empresas ve ese acceso (y apunta si la
   contraseña ha dejado de valer).
2. Si su dueño activó la revisión automática en ese acceso, mira en cada
   una de sus empresas los saldos que no deberían existir (caja o bancos en
   negativo, clientes acreedores, proveedores deudores, la 555 sin cerrar)
   y si el IVA del último trimestre cuadra con las facturas. Lo que
   encuentra lo deja como aviso en "Propuestas", sin repetir uno que siga
   pendiente.

Lo calcula el programa con reglas fijas (_mod_conta_analisis.py): no gasta
IA. Solo lee del SIF, con el acceso de quien activó la revisión.

Como módulo, desde la raíz del core, una vez cada noche (cron
`mcp_gd_revisar_contabilidad`):
    ENV_PATH=env/env.json python -m \\
        apps.mcp_server.paneles_cliente.multiplika_gestion_documental_mcp.scripts.revisar_contabilidad"""

import asyncio
import sys

from database.config_db import get_db_config

from ..database.modelos import _mod_contabilidad_sif as sif
from ..database.modelos._mod_conta_analisis import saldos_anomalos
from ..database.modelos._mod_conta_propuestas import aviso_sin_repetir
from ..database.modelos._mod_configuracion import ConfiguracionCRUD
from ..database.modelos._repeticiones import ahora_madrid
from .procesar_programaciones import _proyectos_gestion_documental_activos

MESES_TRIMESTRE = 3


def _ultimo_trimestre_cerrado(hoy) -> tuple[int, str]:
    trimestre = (hoy.month - 1) // MESES_TRIMESTRE  # el que está en curso, contando desde 0
    return (hoy.year, f"{trimestre}T") if trimestre else (hoy.year - 1, "4T")


async def _revisar_empresa(config: dict, acceso: dict, empresa: dict, ejercicio: int, trimestre: tuple[int, str]) -> int:
    nuevos = 0
    sumas = await sif.pedir_con_acceso(config, acceso, empresa, "/contabilidad/informes/sumas_y_saldos", {"ejercicio": ejercicio, "nivel": 0})
    for aviso in saldos_anomalos(sumas.get("lineas") or []):
        nuevos += await aviso_sin_repetir(config, empresa["id_empresa"], aviso["titulo"], aviso["justificacion"], {"cuentas": aviso["cuentas"]})
    cuadre = await sif.pedir_con_acceso(config, acceso, empresa, "/contabilidad/fiscal/cuadre_iva",
                                        {"ejercicio": trimestre[0], "periodo": trimestre[1]})
    if cuadre.get("cuadra") is False:
        nuevos += await aviso_sin_repetir(
            config, empresa["id_empresa"], f"El IVA del {trimestre[1]} de {trimestre[0]} no cuadra con las facturas",
            "El IVA de las facturas no coincide con el contabilizado: revisa facturas sin contabilizar o asientos de IVA a mano.",
            cuadre,
        )
    return nuevos


async def main() -> int:
    errores = 0
    hoy = ahora_madrid()
    for proyecto in await _proyectos_gestion_documental_activos():
        config = get_db_config(proyecto["id"])
        try:
            if not await ConfiguracionCRUD(config).obtener_modulo_contable():
                continue
            accesos = await sif.todos_los_accesos(config)
        except Exception as e:  # base caída: sigue con el resto
            errores += 1
            print(f"[{proyecto['nombre']}] error: {e}", file=sys.stderr)
            continue
        for acceso in accesos:
            try:
                await sif.actualizar_acceso(config, acceso)
            except Exception as e:  # contraseña cambiada, SIF caído...: queda marcado en el acceso
                print(f"[{proyecto['nombre']}] acceso {acceso['id']}: {e}", file=sys.stderr)
                continue
            if not acceso["revision_automatica"]:
                continue
            for empresa in await sif.empresas_del_acceso(config, acceso):
                try:
                    nuevos = await _revisar_empresa(config, acceso, empresa, hoy.year, _ultimo_trimestre_cerrado(hoy))
                except Exception as e:  # sin ejercicio abierto o sin permiso: no para a las demás
                    print(f"[{proyecto['nombre']}] {empresa['nombre']}: {e}", file=sys.stderr)
                    continue
                if nuevos:
                    print(f"[{proyecto['nombre']}] {empresa['nombre']}: {nuevos} avisos nuevos")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
