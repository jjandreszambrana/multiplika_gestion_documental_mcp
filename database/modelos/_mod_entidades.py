"""CRUD de gd_entidades/gd_documentos_entidades — ver
docs/gestion-documental.md → "Entidades"."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_entidades import TABLA_DOCUMENTOS_ENTIDADES, TABLA_ENTIDADES

_CAMPOS_EDITABLES = [
    "nombre", "tipo", "direccion", "localidad", "provincia", "codigo_postal",
    "pais", "telefono", "email", "observaciones", "codigo", "nif",
]


class EntidadesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_ENTIDADES, config)

    async def buscar(self, q: str | None = None, tipo: str | None = None, limite: int = 200) -> list[dict]:
        filtros = {}
        if tipo:
            filtros["tipo"] = {"op": "=", "valor": tipo}
        if q:
            filtros["nombre"] = {"op": "LIKE", "valor": f"%{q}%"}
        filas, _ = await self.listar(filtros=filtros, limit=limite, orden="nombre ASC")
        return filas

    async def obtener_por_codigo(self, codigo: str) -> dict | None:
        filas, _ = await self.listar(filtros={"codigo": {"op": "=", "valor": codigo}}, limit=1)
        return filas[0] if filas else None

    async def crear(self, datos: dict) -> int:
        return await self.insert({k: v for k, v in datos.items() if k in _CAMPOS_EDITABLES})

    async def actualizar_campos(self, id_entidad: int, datos: dict) -> dict | None:
        if not await self.obtener(id_entidad):
            return None
        cambios = {k: v for k, v in datos.items() if k in _CAMPOS_EDITABLES and v is not None}
        if cambios:
            await self.update(id_entidad, cambios)
        return await self.obtener(id_entidad)


class DocumentosEntidadesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_DOCUMENTOS_ENTIDADES, config)

    async def asignar(self, id_documento: int, id_entidad: int) -> int:
        """No falla si ya estaba asignada (índice único (id_documento, id_entidad))."""
        existente = await self._obtener_relacion(id_documento, id_entidad)
        if existente:
            return existente["id"]
        return await self.insert({"id_documento": id_documento, "id_entidad": id_entidad})

    async def quitar(self, id_documento: int, id_entidad: int) -> bool:
        existente = await self._obtener_relacion(id_documento, id_entidad)
        if not existente:
            return False
        await self.eliminar(existente["id"])
        return True

    async def _obtener_relacion(self, id_documento: int, id_entidad: int) -> dict | None:
        filas, _ = await self.listar(
            filtros={
                "id_documento": {"op": "=", "valor": id_documento},
                "id_entidad": {"op": "=", "valor": id_entidad},
            },
            limit=1,
        )
        return filas[0] if filas else None

    async def listar_entidades_de_documento(self, id_documento: int) -> list[dict]:
        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT e.*
            FROM "{TABLA_ENTIDADES.nombre}" e
            JOIN "{TABLA_DOCUMENTOS_ENTIDADES.nombre}" de ON de.id_entidad = e.id
            WHERE de.id_documento = %s
            ORDER BY e.nombre ASC
        """
        return await db.query(sql, (id_documento,))

    async def listar_documentos_de_entidad(self, id_entidad: int, incluir_archivados: bool = False) -> list[dict]:
        db = AsyncDatabase(**self.config)
        condicion_archivado = "" if incluir_archivados else "AND d.archivado = false"
        sql = f"""
            SELECT d.id, d.nombre, d.tipo_documento, d.archivado, de.fecha_asignacion
            FROM "{TABLA_DOCUMENTOS.nombre}" d
            JOIN "{TABLA_DOCUMENTOS_ENTIDADES.nombre}" de ON de.id_documento = d.id
            WHERE de.id_entidad = %s {condicion_archivado}
            ORDER BY de.fecha_asignacion DESC
        """
        return await db.query(sql, (id_entidad,))
