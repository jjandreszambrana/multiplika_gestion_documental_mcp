"""CRUD de gd_registros/gd_registros_relaciones — comentarios,
anotaciones, observaciones, incidencias y sus resoluciones sobre un
documento (ver docs/gestion-documental.md → "Registros de
seguimiento")."""

from mtpk_postgres import AsyncCrudBase
from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_registros import (
    TABLA_REGISTROS,
    TABLA_REGISTROS_RELACIONES,
    TIPOS_REGISTRO_CREABLES,
)


class RegistrosCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_REGISTROS, config)

    async def listar_de_documento(self, id_documento: int, tipo: str | None = None) -> list[dict]:
        filtros = {"id_documento": {"op": "=", "valor": id_documento}}
        if tipo:
            filtros["tipo"] = {"op": "=", "valor": tipo}
        filas, _ = await self.listar(filtros=filtros, limit=1000, orden="fecha_creacion ASC")
        return filas

    async def actualizar_responsable(
        self, id_registro: int, responsable: str | None, responsable_email: str | None = None
    ) -> dict | None:
        """Cambiar el responsable (o su email) reinicia
        `aviso_responsable_enviado` a false — así el nuevo responsable (o
        el mismo, si se reconfirma) vuelve a entrar en la próxima pasada
        de avisar_incidencias.py, en vez de quedar silenciado para
        siempre por un aviso mandado a otra persona."""
        if not await self.obtener(id_registro):
            return None
        await self.update(
            id_registro,
            {"responsable": responsable, "responsable_email": responsable_email, "aviso_responsable_enviado": False},
        )
        return await self.obtener(id_registro)


class RegistrosRelacionesCRUD(AsyncCrudBase):
    def __init__(self, config: dict):
        super().__init__(TABLA_REGISTROS_RELACIONES, config)

    async def crear(self, id_origen: int, id_destino: int, tipo_relacion: str | None, db=None, conexion=None) -> int:
        return await self.insert(
            {"id_registro_origen": id_origen, "id_registro_destino": id_destino, "tipo_relacion": tipo_relacion},
            db=db, conexion=conexion,
        )

    async def listar_de_registros(self, ids_registros: list[int]) -> list[dict]:
        """Todas las relaciones donde alguno de `ids_registros` participa,
        como origen o como destino — una sola consulta para componer la
        lista completa de un documento (ver listar_registros_documento)."""
        if not ids_registros:
            return []
        db = AsyncDatabase(**self.config)
        marcadores = ", ".join(["%s"] * len(ids_registros))
        sql = f"""
            SELECT * FROM "{TABLA_REGISTROS_RELACIONES.nombre}"
            WHERE id_registro_origen IN ({marcadores}) OR id_registro_destino IN ({marcadores})
        """
        return await db.query(sql, tuple(ids_registros) + tuple(ids_registros))


async def crear_registro(
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
    """Crea un registro y, si se indica `id_relacionado`, lo enlaza con
    él en el mismo paso (p.ej. "este comentario está relacionado con esa
    incidencia"). Para resolver una incidencia usa resolver_incidencia(),
    no esto — tipo='resolucion' está bloqueado aquí a propósito."""
    if tipo not in TIPOS_REGISTRO_CREABLES:
        raise ValueError(
            f"Tipo de registro no válido: '{tipo}' (válidos: {', '.join(TIPOS_REGISTRO_CREABLES)})"
        )
    registros = RegistrosCRUD(config)
    id_registro = await registros.insert({
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
        await RegistrosRelacionesCRUD(config).crear(id_registro, id_relacionado, tipo_relacion)
    return id_registro


async def resolver_incidencia(config: dict, id_incidencia: int, texto_resolucion: str, creado_por: str) -> dict:
    """Crea el registro de resolución, lo enlaza con la incidencia
    (tipo_relacion='resuelve') y marca la incidencia como resuelta, todo
    en una transacción — así una incidencia resuelta siempre tiene su
    resolución enlazada, nunca uno sin el otro."""
    db = AsyncDatabase(**config)
    db.add_tabla(TABLA_REGISTROS)
    db.add_tabla(TABLA_REGISTROS_RELACIONES)
    registros = RegistrosCRUD(config)
    relaciones = RegistrosRelacionesCRUD(config)

    async with db.transaccion() as cx:
        incidencia = await registros.obtener(id_incidencia, db=db, conexion=cx)
        if not incidencia or incidencia["tipo"] != "incidencia":
            raise ValueError(f"No existe ninguna incidencia con id {id_incidencia}")
        if incidencia["estado"] == "resuelta":
            raise ValueError("Esta incidencia ya está resuelta")

        id_resolucion = await registros.insert(
            {
                "id_documento": incidencia["id_documento"],
                "tipo": "resolucion",
                "texto": texto_resolucion,
                "creado_por": creado_por,
            },
            db=db, conexion=cx,
        )
        await relaciones.crear(id_resolucion, id_incidencia, "resuelve", db=db, conexion=cx)
        await registros.update(id_incidencia, {"estado": "resuelta"}, db=db, conexion=cx)

    return {"id_incidencia": id_incidencia, "id_resolucion": id_resolucion}


async def listar_registros_documento(config: dict, id_documento: int, tipo: str | None = None) -> list[dict]:
    """Registros del documento con sus relaciones ya compuestas (evita
    N+1 consultas) — usado tanto por la tool MCP como por el panel."""
    registros = await RegistrosCRUD(config).listar_de_documento(id_documento, tipo)
    ids = [r["id"] for r in registros]
    relaciones = await RegistrosRelacionesCRUD(config).listar_de_registros(ids)

    por_registro: dict[int, list[dict]] = {id_: [] for id_ in ids}
    for rel in relaciones:
        if rel["id_registro_origen"] in por_registro:
            por_registro[rel["id_registro_origen"]].append({
                "id_relacionado": rel["id_registro_destino"],
                "tipo_relacion": rel["tipo_relacion"],
                "direccion": "hacia",
            })
        if rel["id_registro_destino"] in por_registro:
            por_registro[rel["id_registro_destino"]].append({
                "id_relacionado": rel["id_registro_origen"],
                "tipo_relacion": rel["tipo_relacion"],
                "direccion": "desde",
            })

    return [{**registro, "relaciones": por_registro[registro["id"]]} for registro in registros]
