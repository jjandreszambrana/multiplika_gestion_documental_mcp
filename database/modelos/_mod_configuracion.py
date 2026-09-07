"""CRUD de gd_configuracion (fila única, id=1 — ver
docs/gestion-documental.md → "Configuración de búsqueda")."""

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_configuracion import TABLA_CONFIGURACION


class ConfiguracionCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CONFIGURACION, config)

    async def obtener_modo_busqueda(self) -> str:
        fila = await self.obtener(1)
        return fila["modo_busqueda"] if fila else "fulltext"
