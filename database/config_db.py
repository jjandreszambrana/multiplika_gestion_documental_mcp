"""Resolución de conexión a la base de datos de este proyecto.

Placeholder de desarrollo local: en producción, este archivo lo aporta el
repo core (multiplika_mcp/database/config_db.py) al ensamblar el árbol final
con sync.py — resuelve el alias contra mcpc_proyectos y descifra la
contraseña real. Aquí, para poder probar el esquema sin el core (ver
guia_nuevo_proyecto.md), se lee la conexión de variables de entorno.
"""

import os


def get_db_name(alias: str) -> str:
    return f"mcpp_{alias}"


def get_db_config(alias: str) -> dict:
    return {
        "host": os.environ.get("GD_DB_HOST", "127.0.0.1"),
        "port": int(os.environ.get("GD_DB_PORT", "5432")),
        "user": os.environ.get("GD_DB_USER", "postgres"),
        "password": os.environ.get("GD_DB_PASSWORD", ""),
        "db": os.environ.get("GD_DB_NAME", get_db_name(alias)),
    }


async def get_anthropic_api_key(id_proyecto: int) -> str | None:
    """En producción la da el núcleo (clave de Anthropic del tenant); aquí, el entorno."""
    return os.environ.get("GD_ANTHROPIC_API_KEY") or None


async def get_anthropic_modelo(id_proyecto: int) -> str:
    return os.environ.get("GD_ANTHROPIC_MODELO", "claude-sonnet-5")
