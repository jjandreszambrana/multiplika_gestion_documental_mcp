"""CRUD de gd_estilos y gd_estilos_imagenes — ver docs/gestion-documental.md
→ "Tabla de estilos"."""

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_estilos import TABLA_ESTILOS, TABLA_ESTILOS_IMAGENES


class EstilosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_ESTILOS, config)

    async def listar_tipos(self) -> list[dict]:
        filas, _ = await self.listar(limit=200, orden="nombre_tipo ASC")
        return filas

    async def obtener_por_tipo(self, nombre_tipo: str) -> dict | None:
        filas, _ = await self.listar(filtros={"nombre_tipo": {"op": "=", "valor": nombre_tipo}}, limit=1)
        return filas[0] if filas else None


class EstilosImagenesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_ESTILOS_IMAGENES, config)

    async def listar_de_estilo(self, id_estilo: int) -> list[dict]:
        filas, _ = await self.listar(
            filtros={"id_estilo": {"op": "=", "valor": id_estilo}}, limit=100, orden="id ASC",
        )
        return filas

    async def listar_metadatos_de_estilo(self, id_estilo: int) -> list[dict]:
        """Como listar_de_estilo(), sin el binario — para listarlas en el panel."""
        filas = await self.listar_de_estilo(id_estilo)
        return [{k: v for k, v in fila.items() if k != "imagen"} for fila in filas]
