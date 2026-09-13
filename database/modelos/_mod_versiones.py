"""CRUD de gd_versiones, búsqueda fulltext y la lógica de guardado
(documento nuevo vs. nueva versión de uno existente — ver
docs/gestion-documental.md → "Pipeline de ingesta")."""

from datetime import datetime, timezone

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_documentos import TABLA_DOCUMENTOS
from ..dependencias._dep_historial_ediciones import TABLA_HISTORIAL_EDICIONES
from ..dependencias._dep_versiones import PATRON_SIGLAS, TABLA_VERSIONES
from ._mod_documentos import DocumentosCRUD
from ._mod_historial_ediciones import HistorialEdicionesCRUD
from ._mod_tipos_documento import TiposDocumentoCRUD


class VersionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_VERSIONES, config)

    async def obtener_vigente(self, id_documento: int, db=None, conexion=None) -> dict | None:
        filas, _ = await self.listar(
            filtros={
                "id_documento": {"op": "=", "valor": id_documento},
                "vigente": {"op": "=", "valor": True},
            },
            limit=1,
            db=db,
            conexion=conexion,
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

    async def confirmar(self, id_documento: int, id_version: int | None = None) -> dict | None:
        """Da por bueno un borrador (ver guardar_documento): pasa
        `borrador` a false sin tocar el contenido. A partir de aquí queda
        fijo en el histórico — un guardar_documento_gd posterior sobre
        este documento ya crea una versión nueva de verdad, en vez de
        seguir sobrescribiendo esta."""
        version = await self.obtener_completo(id_documento, id_version)
        if not version:
            return None
        await self.update(version["id"], {"borrador": False})
        return await self.obtener(version["id"])

    async def actualizar_incumplimientos(
        self, id_documento: int, incumplimientos: str | None, id_version: int | None = None
    ) -> dict | None:
        """Ver gd_versiones.incumplimientos — la IA la llama tras
        evaluar el documento contra el formato_requerido/normativa_aplicable
        de su tipo (o tras corregirlo, para dejarlo en NULL si ya cumple)."""
        version = await self.obtener_completo(id_documento, id_version)
        if not version:
            return None
        await self.update(version["id"], {"incumplimientos": incumplimientos})
        return await self.obtener(version["id"])

    async def guardar_borrador(self, id_version: int, markdown: str, id_usuario: int) -> dict | None:
        """Guardado intermedio desde el editor del panel (ver
        docs/gestion-documental.md → "Edición desde el panel"): pisa
        'tmp' sin tocar markdown_actual ni generar historial. Se puede
        llamar tantas veces como se quiera mientras se edita."""
        version = await self.obtener(id_version)
        if not version:
            return None
        await self.update(
            id_version,
            {"tmp": markdown, "tmp_id_usuario": id_usuario, "tmp_fecha": datetime.now(timezone.utc)},
        )
        return await self.obtener(id_version)

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

    async def listar_por_caducar(self, dias: int = 30) -> list[dict]:
        """Versiones vigentes (de documentos no archivados) con
        `fecha_caducidad` dentro de los próximos `dias` días (incluye ya
        vencidas) — para que la IA pueda responder si se le pregunta, y
        para el aviso proactivo por email (ver scripts/avisar_caducidades.py)."""
        db = AsyncDatabase(**self.config)
        sql = f"""
            SELECT v.id AS id_version, v.id_documento, v.fecha_caducidad, v.aviso_caducidad_enviado,
                   d.nombre, d.tipo_documento
            FROM "{TABLA_VERSIONES.nombre}" v
            JOIN "{TABLA_DOCUMENTOS.nombre}" d ON d.id = v.id_documento
            WHERE v.vigente = true AND d.archivado = false
              AND v.fecha_caducidad IS NOT NULL
              AND v.fecha_caducidad <= CURRENT_DATE + %s::int
            ORDER BY v.fecha_caducidad ASC
        """
        return await db.query(sql, (dias,))

    async def marcar_aviso_caducidad_enviado(self, id_version: int) -> None:
        await self.update(id_version, {"aviso_caducidad_enviado": True})

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
    fecha_caducidad: str | None = None,
    url_origen: str | None = None,
    ambito: str | None = None,
    borrador: bool = False,
    incumplimientos: str | None = None,
) -> dict:
    """Documento nuevo (crea `gd_documentos` + primera versión) o nueva
    versión de uno existente (desmarca la vigente anterior e inserta la
    nueva), en una única transacción — ver docs/gestion-documental.md →
    "Correcciones, escenario A".

    Excepción: si la versión vigente de `id_documento_existente` sigue
    siendo un borrador (ver "Borrador" en docs/gestion-documental.md), no
    se crea una versión nueva — se sobrescribe esa misma fila (incluido
    `markdown_original`) y se actualiza su `borrador` al valor recibido
    aquí, para poder confirmarlo en el mismo guardado."""
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
            vigente = await versiones.obtener_vigente(id_documento, db=db, conexion=cx)

            if vigente is not None and vigente["borrador"]:
                await versiones.update(
                    vigente["id"],
                    {
                        "markdown_original": markdown,
                        "markdown_actual": markdown,
                        "fecha_documento": fecha_documento,
                        "fecha_caducidad": fecha_caducidad,
                        "url_origen": url_origen,
                        "revisado_manualmente": False,
                        "borrador": borrador,
                        "incumplimientos": incumplimientos,
                    },
                    db=db,
                    conexion=cx,
                )
                return {"id_documento": id_documento, "id_version": vigente["id"]}

            await db.query(
                f'UPDATE "{TABLA_VERSIONES.nombre}" SET vigente = false WHERE id_documento = %s',
                (id_documento,),
                conexion=cx,
            )
        else:
            await TiposDocumentoCRUD(config).asegurar_existe(tipo_documento)
            id_documento = await documentos.insert(
                {
                    "nombre": nombre,
                    "tipo_documento": tipo_documento,
                    "todas_versiones_buscables": todas_versiones_buscables,
                    "ambito": ambito,
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
                "fecha_caducidad": fecha_caducidad,
                "url_origen": url_origen,
                "borrador": borrador,
                "incumplimientos": incumplimientos,
            },
            db=db,
            conexion=cx,
        )

    return {"id_documento": id_documento, "id_version": id_version}


async def confirmar_edicion(config: dict, id_version: int, id_usuario: int) -> dict | None:
    """Cierra la sesión de edición del panel (ver
    docs/gestion-documental.md → "Edición desde el panel"): registra en
    gd_historial_ediciones cómo estaba markdown_actual justo antes, lo
    reemplaza por el contenido de 'tmp' y limpia 'tmp'. None si la
    versión no existe o no tenía ningún borrador pendiente que confirmar."""
    db = AsyncDatabase(**config)
    db.add_tabla(TABLA_VERSIONES)
    db.add_tabla(TABLA_HISTORIAL_EDICIONES)
    versiones = VersionesCRUD(config)
    historial = HistorialEdicionesCRUD(config)

    async with db.transaccion() as cx:
        version = await versiones.obtener(id_version, db=db, conexion=cx)
        if not version or not version["tmp"]:
            return None

        await historial.insert(
            {"id_version": id_version, "id_usuario": id_usuario, "markdown_anterior": version["markdown_actual"]},
            db=db,
            conexion=cx,
        )
        await versiones.update(
            id_version,
            {
                "markdown_actual": version["tmp"],
                "tmp": None,
                "tmp_id_usuario": None,
                "tmp_fecha": None,
                "revisado_manualmente": True,
            },
            db=db,
            conexion=cx,
        )

    return await versiones.obtener(id_version)


async def revertir_edicion(config: dict, id_version: int, id_registro_historial: int, id_usuario: int) -> dict | None:
    """Vuelve markdown_actual al estado guardado en un registro del
    historial (ver confirmar_edicion). El propio revertir queda también
    registrado en el historial, como cualquier otra confirmación — así
    nunca se pierde nada, ni siquiera el estado justo antes de revertir.
    None si la versión o el registro no existen, o el registro no
    pertenece a esa versión."""
    db = AsyncDatabase(**config)
    db.add_tabla(TABLA_VERSIONES)
    db.add_tabla(TABLA_HISTORIAL_EDICIONES)
    versiones = VersionesCRUD(config)
    historial = HistorialEdicionesCRUD(config)

    async with db.transaccion() as cx:
        version = await versiones.obtener(id_version, db=db, conexion=cx)
        registro = await historial.obtener(id_registro_historial, db=db, conexion=cx)
        if not version or not registro or registro["id_version"] != id_version:
            return None

        await historial.insert(
            {"id_version": id_version, "id_usuario": id_usuario, "markdown_anterior": version["markdown_actual"]},
            db=db,
            conexion=cx,
        )
        await versiones.update(
            id_version,
            {"markdown_actual": registro["markdown_anterior"], "revisado_manualmente": True},
            db=db,
            conexion=cx,
        )

    return await versiones.obtener(id_version)
