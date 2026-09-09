"""CRUD de gd_versiones, búsqueda fulltext y la lógica de guardado
(documento nuevo vs. nueva versión de uno existente — ver
docs/gestion-documental.md → "Pipeline de ingesta")."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_versiones import PATRON_SIGLAS, TABLA_VERSIONES
from ._mod_documentos import DocumentosCRUD


class VersionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_VERSIONES, config)

    async def obtener_vigente(self, id_documento: int) -> dict | None:
        filas, _ = await self.listar(
            filtros={
                "id_documento": {"op": "=", "valor": id_documento},
                "vigente": {"op": "=", "valor": True},
            },
            limit=1,
        )
        return filas[0] if filas else None

    async def obtener_completo(self, id_documento: int, id_version: int | None = None) -> dict | None:
        """La versión vigente de `id_documento` (por defecto) o la versión
        concreta `id_version`, siempre que pertenezca a ese documento."""
        if id_version is None:
            return await self.obtener_vigente(id_documento)
        fila = await self.obtener(id_version)
        if fila and fila["id_documento"] != id_documento:
            return None
        return fila

    async def corregir(
        self, id_documento: int, markdown_corregido: str, id_version: int | None = None
    ) -> dict | None:
        """Corrige el markdown mal generado por la IA (escenario B de
        docs/gestion-documental.md → "Correcciones"): edita
        `markdown_actual` de la versión indicada (o la vigente, por
        defecto) SIN tocar `markdown_original` ni crear una versión nueva
        — es el mismo documento, solo se arregla un error de lectura.
        Marca `revisado_manualmente=true`. Sin revisión de nadie del
        equipo: quien corrige es siempre el propio cliente (decisión de
        producto, 2026-09-08)."""
        version = await self.obtener_completo(id_documento, id_version)
        if not version:
            return None
        await self.update(version["id"], {"markdown_actual": markdown_corregido, "revisado_manualmente": True})
        return await self.obtener(version["id"])

    async def listar_buscables(self) -> list[dict]:
        """Todas las versiones actualmente buscables (vigentes, o todas
        las de un documento con todas_versiones_buscables=true, y el
        documento no archivado) — usado por el backfill al activar el modo
        semántico."""
        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT v.id, v.markdown_actual
            FROM "{TABLA_VERSIONES.nombre}" v
            JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = v.id_documento
            WHERE (v.vigente = true OR d.todas_versiones_buscables = true) AND d.archivado = false
        """
        return await db.query(sql)

    async def buscar_fulltext(self, pregunta: str, limite: int = 5) -> list[dict]:
        """Fragmentos de las versiones buscables (vigentes, o todas si el
        documento tiene todas_versiones_buscables=true) que casan con
        `pregunta`, con los metadatos del documento para citar la fuente.

        `pregunta` pasa por el mismo PATRON_SIGLAS que tsvector_actual
        antes de convertirse en tsquery, para que "SL" y "S.L." casen
        igual (ver _dep_versiones.py)."""
        db = AsyncDatabase(**self.config)
        tsquery = f"plainto_tsquery('spanish_unaccent', regexp_replace(%s, '{PATRON_SIGLAS}', '', 'g'))"
        sql = f"""
            SELECT v.id AS id_version, v.id_documento, v.fecha_documento,
                   d.nombre, d.tipo_documento,
                   ts_headline('spanish_unaccent', v.markdown_actual, {tsquery}) AS fragmento,
                   ts_rank(v.tsvector_actual, {tsquery}) AS relevancia
            FROM "{TABLA_VERSIONES.nombre}" v
            JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = v.id_documento
            WHERE v.tsvector_actual @@ {tsquery}
              AND (v.vigente = true OR d.todas_versiones_buscables = true)
              AND d.archivado = false
            ORDER BY relevancia DESC
            LIMIT %s
        """
        return await db.query(sql, (pregunta, pregunta, pregunta, limite))


async def guardar_documento(
    config: dict,
    nombre: str,
    tipo_documento: str,
    markdown: str,
    fecha_documento: str,
    id_documento_existente: int | None = None,
    todas_versiones_buscables: bool = False,
) -> dict:
    """Documento nuevo (crea `gd_documentos` + primera versión) o nueva
    versión de uno existente (desmarca la vigente anterior e inserta la
    nueva), en una única transacción — ver docs/gestion-documental.md →
    "Correcciones, escenario A"."""
    db = AsyncDatabase(**config)
    db.add_tabla(TABLA_DOCUMENTOS)
    db.add_tabla(TABLA_VERSIONES)
    documentos = DocumentosCRUD(config)
    versiones = VersionesCRUD(config)

    async with db.transaccion() as cx:
        if id_documento_existente is not None:
            documento = await documentos.obtener(id_documento_existente, db=db, conexion=cx)
            if not documento:
                raise ValueError(f"No existe ningún documento con id {id_documento_existente}")
            id_documento = id_documento_existente
            await db.query(
                f'UPDATE "{TABLA_VERSIONES.nombre}" SET vigente = false WHERE id_documento = %s',
                (id_documento,),
                conexion=cx,
            )
        else:
            id_documento = await documentos.insert(
                {
                    "nombre": nombre,
                    "tipo_documento": tipo_documento,
                    "todas_versiones_buscables": todas_versiones_buscables,
                },
                db=db,
                conexion=cx,
            )

        id_version = await versiones.insert(
            {
                "id_documento": id_documento,
                "markdown_original": markdown,
                "markdown_actual": markdown,
                "fecha_documento": fecha_documento,
            },
            db=db,
            conexion=cx,
        )

    return {"id_documento": id_documento, "id_version": id_version}
