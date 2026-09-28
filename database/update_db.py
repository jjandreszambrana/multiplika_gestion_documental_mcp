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
from database.dependencias._dep_configuracion import (
    PROVEEDOR_EMBEDDING_POR_DEFECTO,
    PROVEEDORES_EMBEDDING_SOPORTADOS,
    construir_tabla_configuracion,
)
from database.dependencias._dep_documentos import TABLA_DOCUMENTOS
from database.dependencias._dep_documentos_pendientes import TABLA_DOCUMENTOS_PENDIENTES
from database.dependencias._dep_versiones import TABLA_VERSIONES
from database.dependencias._dep_historial_ediciones import TABLA_HISTORIAL_EDICIONES
from database.dependencias._dep_chunks import construir_tabla_chunks
from database.dependencias._dep_credenciales import TABLA_CREDENCIALES
from database.dependencias._dep_credenciales_campos import TABLA_CREDENCIALES_CAMPOS
from database.dependencias._dep_solicitudes_credencial import TABLA_SOLICITUDES_CREDENCIAL
from database.dependencias._dep_estilos import TABLA_ESTILOS, TABLA_ESTILOS_IMAGENES
from database.dependencias._dep_tipos_documento import TABLA_TIPOS_DOCUMENTO, TIPOS_POR_DEFECTO
from database.dependencias._dep_notas import TABLA_NOTAS, TABLA_NOTAS_RELACIONES
from database.dependencias._dep_grupos import TABLA_DOCUMENTOS_GRUPOS, TABLA_GRUPOS
from database.dependencias._dep_entidades import TABLA_DOCUMENTOS_ENTIDADES, TABLA_ENTIDADES
from database.dependencias._dep_envios import TABLA_ENVIOS
from database.dependencias._dep_chat import TABLA_CHAT_CONVERSACIONES
from database.dependencias._dep_scripts import TABLA_DOCUMENTOS_SCRIPTS, TABLA_SCRIPTS
from database.dependencias._dep_enlaces import TABLA_ENLACES, TABLA_PREGUNTAS_PENDIENTES, TABLA_USO_ENLACES
from database.dependencias._dep_aprendizajes import TABLA_APRENDIZAJES
from database.dependencias._dep_reglas import TABLA_REGLAS
from database.dependencias._dep_registros import TABLA_MODELOS_REGISTRO, TABLA_REGISTROS, TABLA_REGISTROS_DOCUMENTOS
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

    dimension = PROVEEDORES_EMBEDDING_SOPORTADOS[args.proveedor_embedding]
    tablas = [
        construir_tabla_configuracion(args.proveedor_embedding),
        TABLA_DOCUMENTOS,
        TABLA_DOCUMENTOS_PENDIENTES,
        TABLA_VERSIONES,
        TABLA_HISTORIAL_EDICIONES,
        construir_tabla_chunks(dimension),
        TABLA_CREDENCIALES,
        TABLA_CREDENCIALES_CAMPOS,
        TABLA_SOLICITUDES_CREDENCIAL,
        TABLA_ESTILOS,
        TABLA_ESTILOS_IMAGENES,
        TABLA_TIPOS_DOCUMENTO,
        TABLA_NOTAS,
        TABLA_NOTAS_RELACIONES,
        TABLA_GRUPOS,
        TABLA_DOCUMENTOS_GRUPOS,
        TABLA_ENTIDADES,
        TABLA_DOCUMENTOS_ENTIDADES,
        TABLA_ENVIOS,
        TABLA_CHAT_CONVERSACIONES,
        TABLA_SCRIPTS,
        TABLA_DOCUMENTOS_SCRIPTS,
        TABLA_ENLACES,
        TABLA_PREGUNTAS_PENDIENTES,
        TABLA_USO_ENLACES,
        TABLA_APRENDIZAJES,
        TABLA_REGLAS,
        TABLA_MODELOS_REGISTRO,
        TABLA_REGISTROS,
        TABLA_REGISTROS_DOCUMENTOS,
    ]

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


if __name__ == "__main__":
    main()
