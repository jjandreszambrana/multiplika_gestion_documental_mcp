"""Propuestas del asesor contable (gd_conta_propuestas) — ver
docs/contabilidad/planificacion.md (fase 4) y memoria-anual.md.

La IA propone y el contable decide. Aceptar un asiento o una
reclasificación no escribe nada en el SIF: deja anotado que el contable lo
pasa él. Aceptar un apartado de la memoria sí lo guarda en el SIF, con la
clave del contable (ver `aceptar`)."""

import json

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_contabilidad import ESTADOS_PROPUESTA, NOMBRE_TABLA_CONTA_PROPUESTAS as _T, TIPOS_PROPUESTA
from ._mod_conta_analisis import asiento_valido
from ._repeticiones import ahora_madrid

LIMITE_LISTADO = 200


def _publica(fila: dict) -> dict:
    datos = dict(fila)
    datos["detalle"] = json.loads(datos["detalle"]) if datos.get("detalle") else None
    return datos


async def crear(
    config: dict, id_empresa: int, tipo: str, titulo: str, justificacion: str | None = None,
    detalle: dict | None = None, id_tema: int | None = None, id_documento: int | None = None,
    origen: str = "ia", creado_por: str | None = None,
) -> dict:
    if tipo not in TIPOS_PROPUESTA:
        raise ValueError(f"Tipo de propuesta no válido: {tipo} (vale {', '.join(TIPOS_PROPUESTA)})")
    if tipo in ("asiento", "reclasificacion"):
        detalle = asiento_valido(detalle or {})
    filas = await AsyncDatabase(**config).query(
        f'INSERT INTO "{_T}" (id_empresa, tipo, titulo, detalle, justificacion, id_tema, id_documento, origen, creado_por) '
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
        (id_empresa, tipo, titulo[:255], json.dumps(detalle, ensure_ascii=False) if detalle else None,
         justificacion, id_tema, id_documento, origen, creado_por),
    )
    return _publica(filas[0])


async def aviso_sin_repetir(config: dict, id_empresa: int, titulo: str, justificacion: str, detalle: dict) -> bool:
    """Para la revisión automática: no crea un aviso igual a otro que siga
    pendiente en esa empresa. True si lo ha creado."""
    db = AsyncDatabase(**config)
    existe = await db.query(
        f"SELECT id FROM \"{_T}\" WHERE id_empresa = %s AND tipo = 'aviso' AND titulo = %s AND estado = 'pendiente'",
        (id_empresa, titulo),
    )
    if existe:
        await db.query(f'UPDATE "{_T}" SET detalle = %s WHERE id = %s', (json.dumps(detalle, ensure_ascii=False), existe[0]["id"]))
        return False
    await crear(config, id_empresa, "aviso", titulo, justificacion, detalle, origen="revision", creado_por="Revisión automática")
    return True


async def listar(config: dict, ids_empresa: list[int], estado: str | None = "pendiente", id_empresa: int | None = None) -> list[dict]:
    """Solo de las empresas que el usuario puede ver (`ids_empresa`)."""
    ids = [id_empresa] if id_empresa is not None else ids_empresa
    if id_empresa is not None and id_empresa not in ids_empresa:
        return []
    condiciones, valores = ["id_empresa = ANY(%s)"], [ids]
    if estado:
        condiciones.append("estado = %s")
        valores.append(estado)
    filas = await AsyncDatabase(**config).query(
        f'SELECT * FROM "{_T}" WHERE {" AND ".join(condiciones)} ORDER BY fecha_alta DESC LIMIT {LIMITE_LISTADO}',
        tuple(valores),
    )
    return [_publica(f) for f in filas]


async def obtener(config: dict, id_propuesta: int) -> dict | None:
    filas = await AsyncDatabase(**config).query(f'SELECT * FROM "{_T}" WHERE id = %s', (id_propuesta,))
    return _publica(filas[0]) if filas else None


async def resolver(config: dict, id_propuesta: int, estado: str, id_usuario: int | None, motivo: str | None = None) -> dict:
    if estado not in ESTADOS_PROPUESTA or estado == "pendiente":
        raise ValueError("Una propuesta se acepta o se descarta")
    filas = await AsyncDatabase(**config).query(
        f"UPDATE \"{_T}\" SET estado = %s, motivo_descarte = %s, revisado_por = %s, fecha_revision = %s "
        "WHERE id = %s AND estado = 'pendiente' RETURNING *",
        (estado, motivo if estado == "descartada" else None, id_usuario, ahora_madrid(), id_propuesta),
    )
    if not filas:
        raise LookupError("Esa propuesta no existe o ya estaba resuelta")
    return _publica(filas[0])
