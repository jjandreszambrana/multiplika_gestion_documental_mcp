"""Extractos bancarios y su conciliación (gd_conciliaciones y
gd_conciliacion_movimientos) — ver docs/planificacion/conciliacion-bancaria.md.

Esta fase solo guarda el extracto y lo enseña. El emparejado con las
facturas del SIF llega después. La GD no escribe en el SIF: el contable
decide sobre cada movimiento."""

import hashlib
import json

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_conciliacion import NOMBRE_TABLA_CONCILIACION_MOVIMIENTOS as _TM, NOMBRE_TABLA_CONCILIACIONES as _T
from . import _norma43

LIMITE_MOVIMIENTOS = 2000


def _huella(cuenta: dict) -> str:
    """Identifica el contenido de una cuenta del extracto, para no subir dos veces el mismo."""
    base = {k: str(cuenta[k]) for k in ("banco", "oficina", "cuenta", "fecha_desde", "fecha_hasta", "saldo_inicial", "saldo_final")}
    base["movimientos"] = [
        [str(m[k]) for k in ("fecha_operacion", "fecha_valor", "importe", "concepto_comun", "concepto_propio", "numero_documento", "referencia1", "referencia2", "concepto")]
        for m in cuenta["movimientos"]
    ]
    return hashlib.sha256(json.dumps(base, sort_keys=True).encode()).hexdigest()


async def subir(config: dict, id_empresa: int, contenido: bytes, creado_por: int | None = None) -> dict:
    """Lee un Norma 43 y guarda cada cuenta como un extracto. Los que ya estaban
    subidos para esa empresa no se repiten: salen en `repetidos`."""
    try:
        cuentas = _norma43.leer(contenido)
    except _norma43.ErrorNorma43 as e:
        raise ValueError(str(e)) from e
    db = AsyncDatabase(**config)
    creados, repetidos = [], []
    for c in cuentas:
        huella = _huella(c)
        if await db.query(f'SELECT id FROM "{_T}" WHERE id_empresa = %s AND huella = %s', (id_empresa, huella)):
            repetidos.append(f"{c['banco']}-{c['oficina']}-{c['cuenta']} ({c['fecha_desde']} a {c['fecha_hasta']})")
            continue
        await db.query(
            f'INSERT INTO "{_T}" (id_empresa, banco, oficina, cuenta, titular, divisa, fecha_desde, fecha_hasta, '
            "saldo_inicial, saldo_final, cuadra, huella, creado_por) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (id_empresa, c["banco"], c["oficina"], c["cuenta"], c["titular"], c["divisa"], c["fecha_desde"], c["fecha_hasta"],
             c["saldo_inicial"], c["saldo_final"], c["cuadra"], huella, creado_por),
        )
        id_conciliacion = db.ultimo_insert_id
        for m in c["movimientos"]:
            await db.query(
                f'INSERT INTO "{_TM}" (id_conciliacion, orden, fecha_operacion, fecha_valor, importe, concepto_comun, '
                "concepto_propio, numero_documento, referencia1, referencia2, concepto) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (id_conciliacion, m["orden"], m["fecha_operacion"], m["fecha_valor"], m["importe"], m["concepto_comun"],
                 m["concepto_propio"], m["numero_documento"], m["referencia1"], m["referencia2"], m["concepto"] or None),
            )
        creados.append(await obtener(config, id_conciliacion))
    return {"creados": creados, "repetidos": repetidos}


async def listar(config: dict, ids_empresa: list[int], id_empresa: int | None = None) -> list[dict]:
    """Solo de las empresas que el usuario puede ver (`ids_empresa`)."""
    if id_empresa is not None and id_empresa not in ids_empresa:
        return []
    ids = [id_empresa] if id_empresa is not None else ids_empresa
    return await AsyncDatabase(**config).query(
        f'SELECT c.*, COUNT(m.id) AS movimientos, '
        "COUNT(m.id) FILTER (WHERE m.estado IN ('confirmado', 'descartado')) AS resueltos "
        f'FROM "{_T}" c LEFT JOIN "{_TM}" m ON m.id_conciliacion = c.id '
        "WHERE c.id_empresa = ANY(%s) GROUP BY c.id ORDER BY c.fecha_hasta DESC, c.id DESC",
        (ids,),
    )


async def obtener(config: dict, id_conciliacion: int) -> dict | None:
    filas = await AsyncDatabase(**config).query(
        f'SELECT c.*, (SELECT COUNT(*) FROM "{_TM}" m WHERE m.id_conciliacion = c.id) AS movimientos, '
        f"(SELECT COUNT(*) FROM \"{_TM}\" m WHERE m.id_conciliacion = c.id AND m.estado IN ('confirmado', 'descartado')) AS resueltos "
        f'FROM "{_T}" c WHERE c.id = %s',
        (id_conciliacion,),
    )
    return filas[0] if filas else None


async def movimientos(config: dict, id_conciliacion: int, estado: str | None = None) -> list[dict]:
    condiciones, valores = ["id_conciliacion = %s"], [id_conciliacion]
    if estado:
        condiciones.append("estado = %s")
        valores.append(estado)
    filas = await AsyncDatabase(**config).query(
        f'SELECT * FROM "{_TM}" WHERE {" AND ".join(condiciones)} ORDER BY orden LIMIT {LIMITE_MOVIMIENTOS}', tuple(valores),
    )
    for f in filas:
        for campo in ("propuesta", "decision"):
            f[campo] = json.loads(f[campo]) if f.get(campo) else None
    return filas


async def eliminar(config: dict, id_conciliacion: int) -> None:
    """Borra el extracto y sus movimientos. No deja borrar uno con movimientos
    ya resueltos: es trabajo del contable."""
    actual = await obtener(config, id_conciliacion)
    if not actual:
        raise LookupError("Ese extracto no existe")
    if actual["resueltos"]:
        raise ValueError("Ese extracto ya tiene movimientos confirmados o descartados: no se puede borrar")
    await AsyncDatabase(**config).query(f'DELETE FROM "{_T}" WHERE id = %s', (id_conciliacion,))
