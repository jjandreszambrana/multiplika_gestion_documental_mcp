"""CRUD y búsqueda por metadatos de gd_documentos (ver docs/gestion-documental.md
→ "Tools MCP", buscar_documentos)."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_versiones import TABLA_VERSIONES


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
        al ingerir. Por defecto no incluye documentos archivados.

        Incluye el estado de la versión vigente (borrador, incumplimientos,
        revisado_manualmente) vía LEFT JOIN — el panel los muestra como
        badges en el listado sin tener que pedir cada documento aparte."""
        condiciones = []
        params = []
        if referencia:
            condiciones.append("d.nombre LIKE %s")
            params.append(f"%{referencia}%")
        if tipo_documento:
            condiciones.append("d.tipo_documento = %s")
            params.append(tipo_documento)
        if not incluir_archivados:
            condiciones.append("d.archivado = false")
        if fecha_desde and fecha_hasta:
            condiciones.append("d.fecha_alta BETWEEN %s AND %s")
            params += [fecha_desde, f"{fecha_hasta} 23:59:59"]
        elif fecha_desde:
            condiciones.append("d.fecha_alta >= %s")
            params.append(fecha_desde)
        elif fecha_hasta:
            condiciones.append("d.fecha_alta <= %s")
            params.append(f"{fecha_hasta} 23:59:59")
        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT d.*, v.id AS id_version, v.borrador, v.incumplimientos, v.revisado_manualmente
            FROM "{TABLA_DOCUMENTOS.nombre}" d
            LEFT JOIN "{TABLA_VERSIONES.nombre}" v ON v.id_documento = d.id AND v.vigente = true
            {where}
            ORDER BY d.fecha_alta DESC
            LIMIT %s
        """
        params.append(limite)
        return await db.query(sql, tuple(params))

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
