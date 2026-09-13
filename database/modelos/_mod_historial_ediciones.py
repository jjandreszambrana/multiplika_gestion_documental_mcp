"""CRUD de gd_historial_ediciones — ver docs/gestion-documental.md →
"Edición desde el panel"."""

import difflib

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_historial_ediciones import TABLA_HISTORIAL_EDICIONES


def calcular_diff(texto_antes: str, texto_despues: str) -> list[str]:
    """Diff unificado línea a línea (formato tipo `git diff`), para
    mostrar en el panel qué cambió entre dos estados de un documento."""
    return list(
        difflib.unified_diff(
            texto_antes.splitlines(), texto_despues.splitlines(),
            fromfile="antes", tofile="después", lineterm="",
        )
    )


class HistorialEdicionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_HISTORIAL_EDICIONES, config)

    async def listar_de_version(self, id_version: int) -> list[dict]:
        """Más reciente primero — cada fila es el estado de antes de esa
        confirmación (ver comentario de markdown_anterior en el esquema)."""
        filas, _ = await self.listar(
            filtros={"id_version": {"op": "=", "valor": id_version}},
            orden="fecha DESC",
            limit=1000,
        )
        return filas
