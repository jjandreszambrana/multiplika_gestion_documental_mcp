"""CRUD de gd_scripts — ver docs/gestion-documental.md → "Scripts
reutilizables"."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_scripts import TABLA_DOCUMENTOS_SCRIPTS, TABLA_SCRIPTS

_CAMPOS_EDITABLES = ["titulo", "descripcion", "lenguaje", "codigo", "etiquetas"]
_CAMPOS_CREABLES = _CAMPOS_EDITABLES + ["creado_por"]


class ScriptsCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_SCRIPTS, config)

    async def buscar(
        self, q: str | None = None, lenguaje: str | None = None,
        incluir_archivados: bool = False, limite: int = 200,
    ) -> list[dict]:
        """`q` busca por título, descripción o etiquetas (parcial, sin
        distinguir mayúsculas) — para que la IA pueda preguntar "¿ya hay
        algo para X?" antes de escribir un script de cero."""
        condiciones = []
        params = []
        if q:
            condiciones.append("(titulo ILIKE %s OR descripcion ILIKE %s OR etiquetas ILIKE %s)")
            params += [f"%{q}%", f"%{q}%", f"%{q}%"]
        if lenguaje:
            condiciones.append("lenguaje = %s")
            params.append(lenguaje)
        if not incluir_archivados:
            condiciones.append("archivado = false")
        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT * FROM "{TABLA_SCRIPTS.nombre}"
            {where}
            ORDER BY veces_usado DESC, fecha_alta DESC
            LIMIT %s
        """
        params.append(limite)
        return await db.query(sql, tuple(params))

    async def crear(self, datos: dict) -> int:
        return await self.insert({k: v for k, v in datos.items() if k in _CAMPOS_CREABLES})

    async def actualizar_campos(self, id_script: int, datos: dict) -> dict | None:
        if not await self.obtener(id_script):
            return None
        cambios = {k: v for k, v in datos.items() if k in _CAMPOS_EDITABLES and v is not None}
        if cambios:
            await self.update(id_script, cambios)
        return await self.obtener(id_script)

    async def marcar_uso(self, id_script: int) -> dict | None:
        if not await self.obtener(id_script):
            return None
        db = AsyncDatabase(**self.config)
        await db.query(
            f'UPDATE "{TABLA_SCRIPTS.nombre}" SET veces_usado = veces_usado + 1, '
            f"fecha_ultimo_uso = CURRENT_TIMESTAMP WHERE id = %s",
            (id_script,),
        )
        return await self.obtener(id_script)

    async def archivar(self, id_script: int) -> dict | None:
        if not await self.obtener(id_script):
            return None
        await self.update(id_script, {"archivado": True})
        return await self.obtener(id_script)

    async def desarchivar(self, id_script: int) -> dict | None:
        if not await self.obtener(id_script):
            return None
        await self.update(id_script, {"archivado": False})
        return await self.obtener(id_script)


class DocumentosScriptsCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_DOCUMENTOS_SCRIPTS, config)

    async def asignar(self, id_documento: int, id_script: int) -> int:
        """No falla si ya estaba asignado (índice único (id_documento, id_script))."""
        existente = await self._obtener_relacion(id_documento, id_script)
        if existente:
            return existente["id"]
        return await self.insert({"id_documento": id_documento, "id_script": id_script})

    async def quitar(self, id_documento: int, id_script: int) -> bool:
        existente = await self._obtener_relacion(id_documento, id_script)
        if not existente:
            return False
        await self.eliminar(existente["id"])
        return True

    async def _obtener_relacion(self, id_documento: int, id_script: int) -> dict | None:
        filas, _ = await self.listar(
            filtros={
                "id_documento": {"op": "=", "valor": id_documento},
                "id_script": {"op": "=", "valor": id_script},
            },
            limit=1,
        )
        return filas[0] if filas else None

    async def listar_scripts_de_documento(self, id_documento: int) -> list[dict]:
        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT s.*
            FROM "{TABLA_SCRIPTS.nombre}" s
            JOIN "{TABLA_DOCUMENTOS_SCRIPTS.nombre}" ds ON ds.id_script = s.id
            WHERE ds.id_documento = %s
            ORDER BY s.titulo ASC
        """
        return await db.query(sql, (id_documento,))

    async def listar_documentos_de_script(self, id_script: int, incluir_archivados: bool = False) -> list[dict]:
        db = AsyncDatabase(**self.config)
        condicion_archivado = "" if incluir_archivados else "AND d.archivado = false"
        sql = f"""
            SELECT d.id, d.nombre, d.tipo_documento, d.archivado, ds.fecha_asignacion
            FROM "{TABLA_DOCUMENTOS.nombre}" d
            JOIN "{TABLA_DOCUMENTOS_SCRIPTS.nombre}" ds ON ds.id_documento = d.id
            WHERE ds.id_script = %s {condicion_archivado}
            ORDER BY ds.fecha_asignacion DESC
        """
        return await db.query(sql, (id_script,))
