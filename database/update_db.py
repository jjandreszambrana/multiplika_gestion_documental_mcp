#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""Aplica el esquema de gestión documental sobre la base física de un cliente.

Uso:
    python update_db.py <alias_cliente>                    # aplicar
    python update_db.py <alias_cliente> --permitir-drop     # + eliminar índices/FKs huérfanos

<alias_cliente> es el slug del proyecto en mcpc_proyectos (1 BD por cliente:
hay que ejecutar esto una vez por cada cliente dado de alta, no una sola vez
para toda la plataforma).
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mtpk_postgres.core_sync import ManagerDB

from database.config_db import get_db_config
from database.dependencias._dep_configuracion import TABLA_CONFIGURACION
from database.dependencias._dep_documentos import TABLA_DOCUMENTOS
from database.dependencias._dep_versiones import TABLA_VERSIONES
from database.dependencias._dep_chunks import TABLA_CHUNKS

TABLAS = [
    TABLA_CONFIGURACION,
    TABLA_DOCUMENTOS,
    TABLA_VERSIONES,
    TABLA_CHUNKS,
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("alias", help="Slug del proyecto de cliente (mcpc_proyectos)")
    parser.add_argument("--permitir-drop", action="store_true")
    args = parser.parse_args()

    manager = ManagerDB(**get_db_config(args.alias))

    for tabla in TABLAS:
        manager.add_tabla(tabla)
    resultado = manager.crear_todo(permitir_drop=args.permitir_drop)
    manager.cerrar()

    if "error" in resultado:
        print("\nError aplicando el esquema:")
        print(resultado["error"])
        sys.exit(1)


if __name__ == "__main__":
    main()
