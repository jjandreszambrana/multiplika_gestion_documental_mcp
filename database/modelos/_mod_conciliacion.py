"""Extractos bancarios y su conciliación (gd_conciliaciones y
gd_conciliacion_movimientos) — ver docs/planificacion/conciliacion-bancaria.md.

Esta fase solo guarda el extracto y lo enseña. El emparejado con las
facturas del SIF llega después. La GD no escribe en el SIF: el contable
decide sobre cada movimiento."""

import hashlib
import json
from decimal import Decimal

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_conciliacion import NOMBRE_TABLA_CONCILIACION_MOVIMIENTOS as _TM, NOMBRE_TABLA_CONCILIACIONES as _T
from . import _conciliar, _mod_contabilidad_sif as conta_sif, _norma43

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


LIMITE_SIF = 5000
ESTADOS_ABIERTOS = ("sin_emparejar", "exacto", "dudoso")


def _decimal(valor) -> Decimal:
    return Decimal(str(valor or 0))


async def _cobros_pendientes(config: dict, id_usuario: int | None, id_empresa: int) -> list[dict]:
    r = await conta_sif.pedir(config, id_usuario, id_empresa, "/ventas/gestion_cobros/recibos/listar",
                              {"offset": 0, "limit": LIMITE_SIF, "estado_calculado": "pendientes", "solo_vencidos": False})
    return [
        {"sentido": "cobro", "id": f["id_recibo"], "id_factura": f.get("id_factura"), "numero_factura": f.get("numero_factura"),
         "nif": f.get("NIF_receptor"), "nombre": f.get("receptor_nombre"), "fecha_vencimiento": f.get("fecha_vencimiento"),
         "pendiente": _decimal(f.get("importe_pendiente"))}
        for f in r.get("registros") or [] if _decimal(f.get("importe_pendiente")) > 0
    ]


async def _pagos_pendientes(config: dict, id_usuario: int | None, id_empresa: int) -> list[dict]:
    filas = []
    for id_estado in (0, 2):  # pendiente y parcial
        r = await conta_sif.pedir(config, id_usuario, id_empresa, "/compras/gestion_pagos/vencimientos/listar",
                                  {"offset": 0, "limit": LIMITE_SIF, "id_estado": id_estado})
        filas += r.get("registros") or []
    return [
        {"sentido": "pago", "id": f["id"], "id_factura": f.get("id_factura"), "numero_factura": f.get("numero_factura"),
         "nif": f.get("NIF_emisor"), "nombre": f.get("NombreRazon_emisor"), "fecha_vencimiento": f.get("fecha_vencimiento"),
         "pendiente": _decimal(f.get("importe_pendiente"))}
        for f in filas if _decimal(f.get("importe_pendiente")) > 0
    ]


async def emparejar(config: dict, id_usuario: int | None, id_conciliacion: int) -> dict:
    """Busca para cada movimiento aún abierto las facturas del SIF que le
    corresponden y lo deja anotado como propuesta. No escribe en el SIF ni
    toca lo que el contable ya confirmó o descartó. Si el SIF no da una de
    las dos listas (p. ej. los pagos aún no existen allí), sigue con la otra
    y lo cuenta en `avisos`."""
    extracto = await obtener(config, id_conciliacion)
    if not extracto:
        raise LookupError("Ese extracto no existe")
    id_empresa, avisos, candidatas = extracto["id_empresa"], [], []
    for nombre, pedir in (("cobros", _cobros_pendientes), ("pagos", _pagos_pendientes)):
        try:
            candidatas += await pedir(config, id_usuario, id_empresa)
        except (ValueError, LookupError) as e:
            avisos.append(f"No se han podido consultar los {nombre} pendientes del SIF: {e}")
    if not candidatas and avisos:
        raise ValueError(avisos[0])
    abiertos = [m for m in await movimientos(config, id_conciliacion) if m["estado"] in ESTADOS_ABIERTOS]
    resultados = _conciliar.emparejar(abiertos, candidatas)
    db = AsyncDatabase(**config)
    resumen = {"exacto": 0, "dudoso": 0, "sin_emparejar": 0}
    for m, r in zip(abiertos, resultados):
        resumen[r["estado"]] += 1
        await db.query(
            f'UPDATE "{_TM}" SET estado = %s, propuesta = %s WHERE id = %s',
            (r["estado"], json.dumps(r["propuesta"], ensure_ascii=False) if r["propuesta"] else None, m["id"]),
        )
    return {"revisados": len(abiertos), **resumen, "avisos": avisos}
