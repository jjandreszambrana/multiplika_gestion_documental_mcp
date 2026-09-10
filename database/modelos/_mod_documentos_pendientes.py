"""CRUD de gd_documentos_pendientes — ver docs/gestion-documental.md →
"Documentos pendientes"."""

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_documentos_pendientes import TABLA_DOCUMENTOS_PENDIENTES


class DocumentosPendientesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_DOCUMENTOS_PENDIENTES, config)

    async def listar_metadatos(self) -> list[dict]:
        """Como listar(), sin el binario — para el listado (panel o IA)."""
        filas, _ = await self.listar(limit=200, orden="fecha_alta ASC")
        return [{k: v for k, v in fila.items() if k != "archivo"} for fila in filas]

    async def crear(self, archivo: bytes, tipo_mime: str, nombre_original: str, origen: str) -> int:
        return await self.insert({
            "archivo": archivo, "tipo_mime": tipo_mime,
            "nombre_original": nombre_original, "origen": origen,
        })
