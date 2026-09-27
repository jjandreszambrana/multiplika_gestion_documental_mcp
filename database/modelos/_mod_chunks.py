"""CRUD de gd_chunks y búsqueda semántica — ver docs/gestion-documental.md
→ "Fase 3". Los chunks solo existen para versiones buscables (vigentes, o
todas si el documento tiene todas_versiones_buscables=true)."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_chunks import TABLA_CHUNKS
from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_versiones import TABLA_VERSIONES
from ._mod_embeddings import chunkear_por_encabezados, generar_embeddings


class ChunksCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_CHUNKS, config)

    async def eliminar_de_version(self, id_version: int) -> None:
        db = AsyncDatabase(**self.config)
        await db.query(f'DELETE FROM "{TABLA_CHUNKS.nombre}" WHERE id_version = %s', (id_version,))

    async def buscar_semantico(
        self, embedding_pregunta: list[float], limite: int = 5, solo_compartidos: bool = False
    ) -> list[dict]:
        db = AsyncDatabase(**self.config)
        vector_sql = "[" + ",".join(str(x) for x in embedding_pregunta) + "]"
        sql = f"""
            SELECT v.id AS id_version, v.id_documento, v.fecha_documento,
                   d.nombre, d.tipo_documento, c.texto AS fragmento,
                   1 - (c.embedding <=> %s) AS relevancia
            FROM "{TABLA_CHUNKS.nombre}" c
            JOIN "{TABLA_VERSIONES.nombre}" v ON v.id = c.id_version
            JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = v.id_documento
            WHERE (v.vigente = true OR d.todas_versiones_buscables = true) AND d.archivado = false
              {"AND d.reservado = false" if solo_compartidos else ""}
            ORDER BY c.embedding <=> %s
            LIMIT %s
        """
        return await db.query(sql, (vector_sql, vector_sql, limite))


async def reindexar_version(
    config: dict, proveedor_embedding: str, api_key: str, id_version: int, markdown: str
) -> int:
    """Recalcula los chunks de una versión a partir de su markdown actual
    (borra los que hubiera antes) — usado tanto al guardar una versión
    nueva como al corregir una existente. Devuelve cuántos chunks quedaron."""
    chunks = ChunksCRUD(config)
    await chunks.eliminar_de_version(id_version)

    textos = chunkear_por_encabezados(markdown)
    if not textos:
        return 0
    vectores = await generar_embeddings(proveedor_embedding, api_key, textos)

    db = AsyncDatabase(**config)
    db.add_tabla(TABLA_CHUNKS)
    for orden, (texto, vector) in enumerate(zip(textos, vectores)):
        await chunks.insert({"id_version": id_version, "orden": orden, "texto": texto, "embedding": vector}, db=db)
    return len(textos)


async def limpiar_chunks_no_buscables(config: dict, id_documento: int) -> None:
    """Borra los chunks de versiones de `id_documento` que ya no son
    buscables (no vigentes, y el documento no guarda todo su histórico
    buscable) — se quedarían huérfanos de sentido tras una nueva versión."""
    db = AsyncDatabase(**config)
    sql = f"""
        DELETE FROM "{TABLA_CHUNKS.nombre}" WHERE id_version IN (
            SELECT v.id FROM "{TABLA_VERSIONES.nombre}" v
            JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = v.id_documento
            WHERE v.id_documento = %s AND v.vigente = false AND d.todas_versiones_buscables = false
        )
    """
    await db.query(sql, (id_documento,))
