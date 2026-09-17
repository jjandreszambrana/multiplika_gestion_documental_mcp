"""CRUD de gd_grupos/gd_documentos_grupos — ver docs/gestion-documental.md
→ "Grupos de documentos"."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_grupos import TABLA_DOCUMENTOS_GRUPOS, TABLA_GRUPOS


class GruposCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_GRUPOS, config)

    async def listar_todos(self) -> list[dict]:
        filas, _ = await self.listar(limit=500, orden="nombre ASC")
        return filas

    async def obtener_por_nombre(self, nombre: str) -> dict | None:
        filas, _ = await self.listar(filtros={"nombre": {"op": "=", "valor": nombre}}, limit=1)
        return filas[0] if filas else None

    async def crear(self, nombre: str, proposito: str) -> int:
        return await self.insert({"nombre": nombre, "proposito": proposito})

    async def actualizar(self, id_grupo: int, nombre: str | None, proposito: str | None) -> dict | None:
        if not await self.obtener(id_grupo):
            return None
        datos = {}
        if nombre is not None:
            datos["nombre"] = nombre
        if proposito is not None:
            datos["proposito"] = proposito
        if datos:
            await self.update(id_grupo, datos)
        return await self.obtener(id_grupo)


class DocumentosGruposCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_DOCUMENTOS_GRUPOS, config)

    async def asignar(self, id_documento: int, id_grupo: int) -> int:
        """No falla si ya estaba asignado — deja la asignación existente
        tal cual (índice único (id_documento, id_grupo))."""
        existente = await self._obtener_relacion(id_documento, id_grupo)
        if existente:
            return existente["id"]
        return await self.insert({"id_documento": id_documento, "id_grupo": id_grupo})

    async def quitar(self, id_documento: int, id_grupo: int) -> bool:
        existente = await self._obtener_relacion(id_documento, id_grupo)
        if not existente:
            return False
        await self.eliminar(existente["id"])
        return True

    async def _obtener_relacion(self, id_documento: int, id_grupo: int) -> dict | None:
        filas, _ = await self.listar(
            filtros={
                "id_documento": {"op": "=", "valor": id_documento},
                "id_grupo": {"op": "=", "valor": id_grupo},
            },
            limit=1,
        )
        return filas[0] if filas else None

    async def listar_grupos_de_documento(self, id_documento: int) -> list[dict]:
        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT g.id, g.nombre, g.proposito
            FROM "{TABLA_GRUPOS.nombre}" g
            JOIN "{TABLA_DOCUMENTOS_GRUPOS.nombre}" dg ON dg.id_grupo = g.id
            WHERE dg.id_documento = %s
            ORDER BY g.nombre ASC
        """
        return await db.query(sql, (id_documento,))

    async def listar_documentos_de_grupo(self, id_grupo: int, incluir_archivados: bool = False) -> list[dict]:
        db = AsyncDatabase(**self.config)
        condicion_archivado = "" if incluir_archivados else "AND d.archivado = false"
        sql = f"""
            SELECT d.id, d.nombre, d.tipo_documento, d.archivado, dg.fecha_asignacion
            FROM "{TABLA_DOCUMENTOS.nombre}" d
            JOIN "{TABLA_DOCUMENTOS_GRUPOS.nombre}" dg ON dg.id_documento = d.id
            WHERE dg.id_grupo = %s {condicion_archivado}
            ORDER BY dg.fecha_asignacion DESC
        """
        return await db.query(sql, (id_grupo,))

    async def contar_por_grupo(self) -> dict[int, int]:
        """{id_grupo: nº de documentos} — para mostrar el recuento en el
        listado de grupos sin pedir cada uno aparte."""
        db = AsyncDatabase(**self.config)
        filas = await db.query(f'SELECT id_grupo, COUNT(*) AS total FROM "{TABLA_DOCUMENTOS_GRUPOS.nombre}" GROUP BY id_grupo')
        return {f["id_grupo"]: f["total"] for f in filas}
