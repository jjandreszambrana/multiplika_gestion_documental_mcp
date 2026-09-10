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

    async def obtener_proveedor_embedding(self) -> str:
        fila = await self.obtener(1)
        return fila["proveedor_embedding"] if fila else "mistral:mistral-embed"

    async def obtener_email_avisos(self) -> str | None:
        fila = await self.obtener(1)
        return fila["email_avisos"] if fila else None

    async def actualizar_email_avisos(self, email: str | None) -> None:
        await self.update(1, {"email_avisos": email})

    async def obtener_email_ingesta(self) -> str | None:
        fila = await self.obtener(1)
        return fila["email_ingesta"] if fila else None

    async def actualizar_email_ingesta(self, parte_local: str | None) -> None:
        await self.update(1, {"email_ingesta": parte_local})
