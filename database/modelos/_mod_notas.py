"""CRUD de gd_notas/gd_notas_relaciones — comentarios, anotaciones,
observaciones, incidencias y sus resoluciones sobre un documento (ver
docs/gestion-documental.md → "Notas de seguimiento")."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_notas import (
    TABLA_NOTAS,
    TABLA_NOTAS_RELACIONES,
    TIPOS_NOTA_CREABLES,
)


class NotasCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_NOTAS, config)

    async def listar_de_documento(self, id_documento: int, tipo: str | None = None) -> list[dict]:
        filtros = {"id_documento": {"op": "=", "valor": id_documento}}
        if tipo:
            filtros["tipo"] = {"op": "=", "valor": tipo}
        filas, _ = await self.listar(filtros=filtros, limit=1000, orden="fecha_creacion ASC")
        return filas

    async def actualizar_responsable(
        self, id_nota: int, responsable: str | None, responsable_email: str | None = None
    ) -> dict | None:
        """Cambiar el responsable (o su email) reinicia
        `aviso_responsable_enviado` a false — así el nuevo responsable (o
        el mismo, si se reconfirma) vuelve a entrar en la próxima pasada
        de avisar_incidencias.py, en vez de quedar silenciado para
        siempre por un aviso mandado a otra persona."""
        if not await self.obtener(id_nota):
            return None
        await self.update(
            id_nota,
            {"responsable": responsable, "responsable_email": responsable_email, "aviso_responsable_enviado": False},
        )
        return await self.obtener(id_nota)


class NotasRelacionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_NOTAS_RELACIONES, config)

    async def crear(self, id_origen: int, id_destino: int, tipo_relacion: str | None, db=None, conexion=None) -> int:
        return await self.insert(
            {"id_nota_origen": id_origen, "id_nota_destino": id_destino, "tipo_relacion": tipo_relacion},
            db=db, conexion=conexion,
        )

    async def listar_de_notas(self, ids_notas: list[int]) -> list[dict]:
        """Todas las relaciones donde alguna de `ids_notas` participa,
        como origen o como destino — una sola consulta para componer la
        lista completa de un documento (ver listar_notas_documento)."""
        if not ids_notas:
            return []
        db = AsyncDatabase(**self.config)
        marcadores = ", ".join(["%s"] * len(ids_notas))
        sql = f"""
            SELECT * FROM "{TABLA_NOTAS_RELACIONES.nombre}"
            WHERE id_nota_origen IN ({marcadores}) OR id_nota_destino IN ({marcadores})
        """
        return await db.query(sql, tuple(ids_notas) + tuple(ids_notas))


async def crear_nota(
    config: dict,
    id_documento: int,
    tipo: str,
    texto: str,
    creado_por: str,
    id_version_origen: int | None = None,
    responsable: str | None = None,
    responsable_email: str | None = None,
    id_relacionado: int | None = None,
    tipo_relacion: str | None = None,
) -> int:
    """Crea una nota y, si se indica `id_relacionado`, la enlaza con ella
    en el mismo paso (p.ej. "este comentario está relacionado con esa
    incidencia"). Para resolver una incidencia usa resolver_incidencia(),
    no esto — tipo='resolucion' está bloqueado aquí a propósito."""
    if tipo not in TIPOS_NOTA_CREABLES:
        raise ValueError(
            f"Tipo de nota no válido: '{tipo}' (válidos: {', '.join(TIPOS_NOTA_CREABLES)})"
        )
    notas = NotasCRUD(config)
    id_nota = await notas.insert({
        "id_documento": id_documento,
        "tipo": tipo,
        "texto": texto,
        "creado_por": creado_por,
        "id_version_origen": id_version_origen,
        "responsable": responsable,
        "responsable_email": responsable_email,
        "estado": "abierta" if tipo == "incidencia" else None,
    })
    if id_relacionado is not None:
        await NotasRelacionesCRUD(config).crear(id_nota, id_relacionado, tipo_relacion)
    return id_nota


async def resolver_incidencia(config: dict, id_incidencia: int, texto_resolucion: str, creado_por: str) -> dict:
    """Crea la nota de resolución, la enlaza con la incidencia
    (tipo_relacion='resuelve') y marca la incidencia como resuelta, todo
    en una transacción — así una incidencia resuelta siempre tiene su
    resolución enlazada, nunca una sin la otra."""
    db = AsyncDatabase(**config)
    db.add_tabla(TABLA_NOTAS)
    db.add_tabla(TABLA_NOTAS_RELACIONES)
    notas = NotasCRUD(config)
    relaciones = NotasRelacionesCRUD(config)

    async with db.transaccion() as cx:
        incidencia = await notas.obtener(id_incidencia, db=db, conexion=cx)
        if not incidencia or incidencia["tipo"] != "incidencia":
            raise ValueError(f"No existe ninguna incidencia con id {id_incidencia}")
        if incidencia["estado"] == "resuelta":
            raise ValueError("Esta incidencia ya está resuelta")

        id_resolucion = await notas.insert(
            {
                "id_documento": incidencia["id_documento"],
                "tipo": "resolucion",
                "texto": texto_resolucion,
                "creado_por": creado_por,
            },
            db=db, conexion=cx,
        )
        await relaciones.crear(id_resolucion, id_incidencia, "resuelve", db=db, conexion=cx)
        await notas.update(id_incidencia, {"estado": "resuelta"}, db=db, conexion=cx)

    return {"id_incidencia": id_incidencia, "id_resolucion": id_resolucion}


async def listar_notas_documento(config: dict, id_documento: int, tipo: str | None = None) -> list[dict]:
    """Notas del documento con sus relaciones ya compuestas (evita N+1
    consultas) — usado tanto por la tool MCP como por el panel."""
    notas = await NotasCRUD(config).listar_de_documento(id_documento, tipo)
    ids = [n["id"] for n in notas]
    relaciones = await NotasRelacionesCRUD(config).listar_de_notas(ids)

    por_nota: dict[int, list[dict]] = {id_: [] for id_ in ids}
    for rel in relaciones:
        if rel["id_nota_origen"] in por_nota:
            por_nota[rel["id_nota_origen"]].append({
                "id_relacionado": rel["id_nota_destino"],
                "tipo_relacion": rel["tipo_relacion"],
                "direccion": "hacia",
            })
        if rel["id_nota_destino"] in por_nota:
            por_nota[rel["id_nota_destino"]].append({
                "id_relacionado": rel["id_nota_origen"],
                "tipo_relacion": rel["tipo_relacion"],
                "direccion": "desde",
            })

    return [{**nota, "relaciones": por_nota[nota["id"]]} for nota in notas]
