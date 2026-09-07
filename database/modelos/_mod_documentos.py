"""CRUD y búsqueda por metadatos de gd_documentos (ver docs/gestion-documental.md
→ "Tools MCP", buscar_documentos)."""

from mtpk_postgres import AsyncCrudBase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS


class DocumentosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_DOCUMENTOS, config)

    async def buscar(
        self, referencia: str | None = None, tipo_documento: str | None = None, limite: int = 20
    ) -> list[dict]:
        """Búsqueda por metadatos (nombre, tipo), no por contenido — para
        exploración del cliente y para evitar duplicados al ingerir."""
        filtros = {}
        if referencia:
            filtros["nombre"] = {"op": "like", "valor": f"%{referencia}%"}
        if tipo_documento:
            filtros["tipo_documento"] = {"op": "=", "valor": tipo_documento}
        filas, _ = await self.listar(filtros=filtros, limit=limite, orden="fecha_alta DESC")
        return filas
