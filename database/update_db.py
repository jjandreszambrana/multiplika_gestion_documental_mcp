#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Aplica el esquema de gestión documental sobre la base física de un cliente.

Uso:
    python update_db.py <alias_cliente>                                  # aplicar (mistral por defecto)
    python update_db.py <alias_cliente> --proveedor-embedding openai:text-embedding-3-small
    python update_db.py <alias_cliente> --permitir-drop                  # + eliminar índices/FKs huérfanos

<alias_cliente> es el slug del proyecto en mcpc_proyectos (1 BD por cliente:
hay que ejecutar esto una vez por cada cliente dado de alta, no una sola vez
para toda la plataforma).

El proveedor de embedding se fija al crear la base del cliente y no se
puede cambiar después sin migrar gd_chunks.embedding a mano (columna
VECTOR de tamaño fijo en Postgres) — ver PROVEEDORES_EMBEDDING_SOPORTADOS
en database/dependencias/_dep_configuracion.py.
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mtpk_postgres.core_sync import ManagerDB

from database.config_db import get_db_config
from database.dependencias._dep_configuracion import PROVEEDOR_EMBEDDING_POR_DEFECTO, PROVEEDORES_EMBEDDING_SOPORTADOS
from database.dependencias._dep_tipos_documento import TIPOS_POR_DEFECTO
from database.dependencias._esquema import tablas_esquema
from database.modelos._mod_crm import sembrar_etapas
from database.modelos._mod_tipos_documento import TiposDocumentoCRUD


async def _sembrar_tipos_documento_por_defecto(config: dict) -> None:
    """Solo si la tabla está vacía — un cliente que ya haya quitado/añadido
    tipos no debe verlos reaparecer en cada migración."""
    tipos = TiposDocumentoCRUD(config)
    existentes, _ = await tipos.listar(limit=1)
    if existentes:
        return
    for nombre in TIPOS_POR_DEFECTO:
        await tipos.crear(nombre)
    print(f"Tipos de documento por defecto creados: {', '.join(TIPOS_POR_DEFECTO)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("alias", help="Slug del proyecto de cliente (mcpc_proyectos)")
    parser.add_argument(
        "--proveedor-embedding", choices=list(PROVEEDORES_EMBEDDING_SOPORTADOS),
        default=PROVEEDOR_EMBEDDING_POR_DEFECTO,
    )
    parser.add_argument("--permitir-drop", action="store_true")
    args = parser.parse_args()

    tablas = tablas_esquema(args.proveedor_embedding)

    manager = ManagerDB(**get_db_config(args.alias))
    for tabla in tablas:
        manager.add_tabla(tabla)
    resultado = manager.crear_todo(permitir_drop=args.permitir_drop)
    manager.cerrar()

    if "error" in resultado:
        print("\nError aplicando el esquema:")
        print(resultado["error"])
        sys.exit(1)

    asyncio.run(_sembrar_tipos_documento_por_defecto(get_db_config(args.alias)))
    if asyncio.run(sembrar_etapas(get_db_config(args.alias))):
        print("Etapas del embudo de ventas por defecto creadas")


if __name__ == "__main__":
    main()
