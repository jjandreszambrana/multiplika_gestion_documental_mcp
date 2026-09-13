"""CRUD de gd_tipos_documento — catálogo abierto, no una lista cerrada (ver
docs/gestion-documental.md → "Tipos de documento configurables")."""

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_tipos_documento import TABLA_TIPOS_DOCUMENTO


class TiposDocumentoCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_TIPOS_DOCUMENTO, config)

    async def listar_nombres(self) -> list[dict]:
        filas, _ = await self.listar(limit=200, orden="nombre ASC")
        return filas

    async def crear(self, nombre: str) -> int:
        return await self.insert({"nombre": nombre})

    async def obtener_por_nombre(self, nombre: str) -> dict | None:
        filas, _ = await self.listar(filtros={"nombre": {"op": "=", "valor": nombre}}, limit=1)
        return filas[0] if filas else None

    async def actualizar_requisitos(
        self, id_tipo: int, formato_requerido: str | None, normativa_aplicable: str | None
    ) -> None:
        await self.update(id_tipo, {"formato_requerido": formato_requerido, "normativa_aplicable": normativa_aplicable})

    async def asegurar_existe(self, nombre: str) -> None:
        """Si el tipo no está todavía en el catálogo, lo añade — así se va
        completando solo con el uso, sin que nadie tenga que darlo de alta
        a mano antes de poder usarlo (ver guardar_documento en
        _mod_versiones.py, que llama a esto al guardar cualquier
        documento)."""
        filas, _ = await self.listar(filtros={"nombre": {"op": "=", "valor": nombre}}, limit=1)
        if not filas:
            await self.crear(nombre)
