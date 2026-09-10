"""CRUD y búsqueda por metadatos de gd_documentos (ver docs/gestion-documental.md
→ "Tools MCP", buscar_documentos)."""

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS


class DocumentosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_DOCUMENTOS, config)

    async def buscar(
        self,
        referencia: str | None = None,
        tipo_documento: str | None = None,
        limite: int = 20,
        incluir_archivados: bool = False,
        fecha_desde: str | None = None,
        fecha_hasta: str | None = None,
    ) -> list[dict]:
        """Búsqueda por metadatos (nombre, tipo, fecha de alta), no por
        contenido — para exploración del cliente y para evitar duplicados
        al ingerir. Por defecto no incluye documentos archivados."""
        filtros = {}
        if referencia:
            filtros["nombre"] = {"op": "like", "valor": f"%{referencia}%"}
        if tipo_documento:
            filtros["tipo_documento"] = {"op": "=", "valor": tipo_documento}
        if not incluir_archivados:
            filtros["archivado"] = {"op": "=", "valor": False}
        if fecha_desde and fecha_hasta:
            filtros["fecha_alta"] = {"op": "between", "valor": [fecha_desde, f"{fecha_hasta} 23:59:59"]}
        elif fecha_desde:
            filtros["fecha_alta"] = {"op": ">=", "valor": fecha_desde}
        elif fecha_hasta:
            filtros["fecha_alta"] = {"op": "<=", "valor": f"{fecha_hasta} 23:59:59"}
        filas, _ = await self.listar(filtros=filtros, limit=limite, orden="fecha_alta DESC")
        return filas

    async def archivar(self, id_documento: int) -> dict | None:
        """Marca un documento como archivado: sigue guardado, pero
        desaparece de las búsquedas hasta desarchivarlo."""
        documento = await self.obtener(id_documento)
        if not documento:
            return None
        await self.update(id_documento, {"archivado": True})
        return await self.obtener(id_documento)

    async def desarchivar(self, id_documento: int) -> dict | None:
        documento = await self.obtener(id_documento)
        if not documento:
            return None
        await self.update(id_documento, {"archivado": False})
        return await self.obtener(id_documento)
