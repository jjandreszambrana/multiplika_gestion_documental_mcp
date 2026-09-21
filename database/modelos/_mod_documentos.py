"""CRUD y búsqueda por metadatos de gd_documentos (ver docs/gestion-documental.md
→ "Tools MCP", buscar_documentos)."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_registros import TABLA_REGISTROS
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
        revisado_manualmente) y el recuento de registros de seguimiento
        (total_registros, incidencias_abiertas) vía LEFT JOIN — el panel
        los muestra como badges en el listado sin tener que pedir cada
        documento aparte."""
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
            SELECT d.*, v.id AS id_version, v.borrador, v.incumplimientos, v.revisado_manualmente,
                   COALESCE(reg.total, 0) AS total_registros,
                   COALESCE(reg.abiertas, 0) AS incidencias_abiertas
            FROM "{TABLA_DOCUMENTOS.nombre}" d
            LEFT JOIN "{TABLA_VERSIONES.nombre}" v ON v.id_documento = d.id AND v.vigente = true
            LEFT JOIN (
                SELECT id_documento, COUNT(*) AS total,
                       COUNT(*) FILTER (WHERE tipo = 'incidencia' AND estado = 'abierta') AS abiertas
                FROM "{TABLA_REGISTROS.nombre}"
                GROUP BY id_documento
            ) reg ON reg.id_documento = d.id
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

    async def actualizar_metadatos(
        self, id_documento: int, tipo_documento: str, ambito: str | None
    ) -> dict | None:
        """Edición manual desde el panel (ver docs/gestion-documental.md →
        "Edición desde el panel") — tipo_documento y ambito viven en el
        documento, no en la versión, así que no generan historial de
        edición (eso es solo para el texto)."""
        documento = await self.obtener(id_documento)
        if not documento:
            return None
        await self.update(id_documento, {"tipo_documento": tipo_documento, "ambito": ambito})
        return await self.obtener(id_documento)

    async def asignar_estilo(self, id_documento: int, id_estilo: int | None) -> dict | None:
        """Vincula el documento a un estilo de informe (None quita el vínculo)."""
        if not await self.obtener(id_documento):
            return None
        await self.update(id_documento, {"id_estilo": id_estilo})
        return await self.obtener(id_documento)

    async def listar_guia_de_estilo(self, id_estilo: int) -> list[dict]:
        """Documentos no archivados vinculados a un estilo de informe."""
        filas, _ = await self.listar(
            filtros={
                "id_estilo": {"op": "=", "valor": id_estilo},
                "archivado": {"op": "=", "valor": False},
            },
            limit=50, orden="nombre ASC",
        )
        return filas
