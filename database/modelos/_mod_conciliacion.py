"""Extractos bancarios y su conciliación (gd_conciliaciones y
gd_conciliacion_movimientos) — ver docs/planificacion/conciliacion-bancaria.md.

Esta fase solo guarda el extracto y lo enseña. El emparejado con las
facturas del SIF llega después. La GD no escribe en el SIF: el contable
decide sobre cada movimiento."""

import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_conciliacion import (
    NOMBRE_TABLA_CONCILIACION_MOVIMIENTOS as _TM, NOMBRE_TABLA_CONCILIACIONES as _T, NOMBRE_TABLA_CUENTAS_BANCARIAS as _TC,
)
from ._repeticiones import ahora_madrid
from . import _conciliar, _conciliar_cuenta, _mod_conta_borradores as conta_borradores, _mod_conta_propuestas as conta_propuestas, _mod_contabilidad_sif as conta_sif, _norma43

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
    subidos para esa empresa no se repiten: salen en `repetidos`. Los
    movimientos que ya estaban en otro extracto de la misma cuenta (los
    extractos se pueden solapar) no se guardan dos veces: `solapados`."""
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
            f'INSERT INTO "{_TC}" (id_empresa, banco, oficina, cuenta) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING',
            (id_empresa, c["banco"], c["oficina"], c["cuenta"]),
        )
        guardados = await db.query(
            f'SELECT m.* FROM "{_TM}" m JOIN "{_T}" e ON e.id = m.id_conciliacion '
            "WHERE e.id_empresa = %s AND e.banco = %s AND e.oficina = %s AND e.cuenta = %s",
            (id_empresa, c["banco"], c["oficina"], c["cuenta"]),
        )
        nuevos, solapados = _conciliar_cuenta.quitar_solapados(c["movimientos"], guardados)
        await db.query(
            f'INSERT INTO "{_T}" (id_empresa, banco, oficina, cuenta, titular, divisa, fecha_desde, fecha_hasta, '
            "saldo_inicial, saldo_final, cuadra, huella, creado_por) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (id_empresa, c["banco"], c["oficina"], c["cuenta"], c["titular"], c["divisa"], c["fecha_desde"], c["fecha_hasta"],
             c["saldo_inicial"], c["saldo_final"], c["cuadra"], huella, creado_por),
        )
        id_conciliacion = db.ultimo_insert_id
        for m in nuevos:
            await db.query(
                f'INSERT INTO "{_TM}" (id_conciliacion, orden, fecha_operacion, fecha_valor, importe, concepto_comun, '
                "concepto_propio, numero_documento, referencia1, referencia2, concepto) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (id_conciliacion, m["orden"], m["fecha_operacion"], m["fecha_valor"], m["importe"], m["concepto_comun"],
                 m["concepto_propio"], m["numero_documento"], m["referencia1"], m["referencia2"], m["concepto"] or None),
            )
        creados.append({**await obtener(config, id_conciliacion), "solapados": solapados})
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
LIMITE_PAGINA_MAYOR = 1000
LIMITE_CANDIDATAS = 50
ESTADOS_ABIERTOS = ("sin_emparejar", "exacto", "dudoso", "asentado", "asiento_propuesto")


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


async def _cuenta(config: dict, id_cuenta: int) -> dict:
    filas = await AsyncDatabase(**config).query(f'SELECT * FROM "{_TC}" WHERE id = %s', (id_cuenta,))
    if not filas:
        raise LookupError("Esa cuenta bancaria no existe")
    return filas[0]


async def cuenta_de_extracto(config: dict, id_conciliacion: int) -> dict:
    extracto = await obtener(config, id_conciliacion)
    if not extracto:
        raise LookupError("Ese extracto no existe")
    filas = await AsyncDatabase(**config).query(
        f'SELECT * FROM "{_TC}" WHERE id_empresa = %s AND banco = %s AND oficina = %s AND cuenta = %s',
        (extracto["id_empresa"], extracto["banco"], extracto["oficina"], extracto["cuenta"]),
    )
    if not filas:
        raise LookupError("Esa cuenta bancaria no existe")
    return filas[0]


async def _extractos_de(config: dict, cuenta: dict) -> list[dict]:
    return await AsyncDatabase(**config).query(
        f'SELECT * FROM "{_T}" WHERE id_empresa = %s AND banco = %s AND oficina = %s AND cuenta = %s ORDER BY fecha_desde, id',
        (cuenta["id_empresa"], cuenta["banco"], cuenta["oficina"], cuenta["cuenta"]),
    )


async def movimientos_cuenta(config: dict, id_cuenta: int, estado: str | None = None) -> list[dict]:
    """Todos los movimientos de la cuenta bancaria, de todos sus extractos y sin
    repetidos, por orden de fecha: la cuenta del banco reproducida."""
    cuenta = await _cuenta(config, id_cuenta)
    condiciones, valores = ["e.id_empresa = %s", "e.banco = %s", "e.oficina = %s", "e.cuenta = %s"], [
        cuenta["id_empresa"], cuenta["banco"], cuenta["oficina"], cuenta["cuenta"]]
    if estado:
        condiciones.append("m.estado = %s")
        valores.append(estado)
    filas = await AsyncDatabase(**config).query(
        f'SELECT m.* FROM "{_TM}" m JOIN "{_T}" e ON e.id = m.id_conciliacion WHERE {" AND ".join(condiciones)} '
        f"ORDER BY m.fecha_operacion, m.id_conciliacion, m.orden LIMIT {LIMITE_MOVIMIENTOS}", tuple(valores),
    )
    for f in filas:
        for campo in ("propuesta", "decision"):
            f[campo] = json.loads(f[campo]) if f.get(campo) else None
    return filas


async def cuentas(config: dict, ids_empresa: list[int], id_empresa: int | None = None) -> list[dict]:
    """Cuentas bancarias de las empresas visibles, con el periodo que cubren sus
    extractos, cómo van sus movimientos y los huecos que se ven."""
    if id_empresa is not None and id_empresa not in ids_empresa:
        return []
    db = AsyncDatabase(**config)
    await db.query(  # extractos subidos antes de que existieran las cuentas
        f'INSERT INTO "{_TC}" (id_empresa, banco, oficina, cuenta) '
        f'SELECT DISTINCT id_empresa, banco, oficina, cuenta FROM "{_T}" WHERE id_empresa = ANY(%s) ON CONFLICT DO NOTHING',
        ([id_empresa] if id_empresa is not None else ids_empresa,),
    )
    filas = await db.query(f'SELECT * FROM "{_TC}" WHERE id_empresa = ANY(%s) ORDER BY id_empresa, banco, oficina, cuenta',
                           ([id_empresa] if id_empresa is not None else ids_empresa,))
    for c in filas:
        extractos = await _extractos_de(config, c)
        movs = await movimientos_cuenta(config, c["id"])
        c["extractos"] = len(extractos)
        c["fecha_desde"] = min((e["fecha_desde"] for e in extractos), default=None)
        c["fecha_hasta"] = max((e["fecha_hasta"] for e in extractos), default=None)
        c["saldo_final"] = extractos[-1]["saldo_final"] if extractos else None
        c["movimientos"] = len(movs)
        c["por_estado"] = {e: sum(1 for m in movs if m["estado"] == e) for e in {m["estado"] for m in movs}}
        c["huecos"] = _conciliar_cuenta.huecos(extractos, movs)
    return filas


async def subcuentas_banco(config: dict, id_usuario: int | None, id_cuenta: int) -> list[dict]:
    """Las subcuentas 572 que admiten apuntes en el plan de la empresa, para elegir una."""
    cuenta = await _cuenta(config, id_cuenta)
    extractos = await _extractos_de(config, cuenta)
    ejercicio = max((e["fecha_hasta"] for e in extractos), default=date.today()).year
    r = await conta_sif.pedir(config, id_usuario, cuenta["id_empresa"], "/contabilidad/plan/listar",
                              {"ejercicio": ejercicio, "texto": "572", "solo_auxiliares": True, "limit": 2000})
    return [{"codigo": c["codigo"], "descripcion": c.get("descripcion") or ""}
            for c in r.get("cuentas") or [] if str(c["codigo"]).startswith("572")]


async def asociar_subcuenta(config: dict, id_cuenta: int, subcuenta: str | None) -> dict:
    """Elige la subcuenta 572 de la cuenta bancaria; queda asociada para siempre."""
    subcuenta = (subcuenta or "").strip()
    if subcuenta and not (subcuenta.isdigit() and subcuenta.startswith("572")):
        raise ValueError("La subcuenta del banco tiene que ser una 572 (solo números)")
    await _cuenta(config, id_cuenta)
    await AsyncDatabase(**config).query(f'UPDATE "{_TC}" SET subcuenta = %s WHERE id = %s', (subcuenta or None, id_cuenta))
    return await _cuenta(config, id_cuenta)


async def _informe(config: dict, id_usuario: int | None, id_empresa: int, ruta: str, desde: date, hasta: date, cuenta: str | None = None) -> list[dict]:
    """Apuntes (firmes y en borrador) del mayor de una cuenta, o del diario si no
    se da cuenta, entre dos fechas: un ejercicio cada vez y de página en página."""
    apuntes = []
    for ejercicio in range(desde.year, hasta.year + 1):
        d, h = max(desde, date(ejercicio, 1, 1)), min(hasta, date(ejercicio, 12, 31))
        offset = 0
        while True:
            cuerpo = {"ejercicio": ejercicio, "desde": d.isoformat(), "hasta": h.isoformat(), "offset": offset,
                      "limit": LIMITE_PAGINA_MAYOR, "incluir_borradores": True}
            if cuenta:
                cuerpo["cuenta"] = cuenta
            r = await conta_sif.pedir(config, id_usuario, id_empresa, ruta, cuerpo)
            pagina = r.get("apuntes") or []
            apuntes += [{**a, "ejercicio": ejercicio} for a in pagina]
            offset += len(pagina)
            if not pagina or offset >= int(r.get("total") or 0):
                break
    return apuntes


async def comparar(config: dict, id_usuario: int | None, id_cuenta: int, desde_mov: date | None = None, hasta_mov: date | None = None) -> dict:
    """Compara los movimientos de la cuenta bancaria con el mayor de su subcuenta 572.
    Los que ya están en contabilidad quedan `asentado` (con el apunte); a los que
    faltan se les buscan facturas pendientes del SIF (`exacto`, `dudoso` o
    `sin_emparejar`). No escribe en el SIF ni toca lo que el contable ya confirmó
    o descartó. Devuelve también los apuntes del mayor que no están en el banco.
    `desde_mov`/`hasta_mov` limitan los movimientos que se revisan (por fecha de
    operación); sin ellos, todos."""
    cuenta = await _cuenta(config, id_cuenta)
    if not cuenta["subcuenta"]:
        raise ValueError("Antes de comparar, elige la subcuenta 572 de esta cuenta bancaria")
    extractos = await _extractos_de(config, cuenta)
    if not extractos:
        raise ValueError("Esta cuenta bancaria no tiene extractos")
    desde, hasta = min(e["fecha_desde"] for e in extractos), max(e["fecha_hasta"] for e in extractos)
    margen = timedelta(days=_conciliar_cuenta.DIAS_DE_MARGEN)
    todos = await movimientos_cuenta(config, id_cuenta)
    apuntes = await _informe(config, id_usuario, cuenta["id_empresa"], "/contabilidad/informes/mayor", desde - margen, hasta + margen, cuenta["subcuenta"])
    asentados, sin_banco = _conciliar_cuenta.cruzar([m for m in todos if m["estado"] != "descartado"], apuntes)
    sin_banco = [a for a in sin_banco if a.get("fecha") and desde <= date.fromisoformat(str(a["fecha"])[:10]) <= hasta]
    def en_periodo(f) -> bool:
        d = date.fromisoformat(str(f)[:10])
        return (desde_mov is None or d >= desde_mov) and (hasta_mov is None or d <= hasta_mov)

    sin_banco = [a for a in sin_banco if en_periodo(a["fecha"])]
    abiertos = [m for m in todos if m["estado"] in ESTADOS_ABIERTOS and en_periodo(m["fecha_operacion"])]
    db = AsyncDatabase(**config)
    resumen = {"asentado": 0, "exacto": 0, "dudoso": 0, "sin_emparejar": 0}
    for m in abiertos:
        if m["id"] in asentados:
            resumen["asentado"] += 1
            await db.query(f'UPDATE "{_TM}" SET estado = %s, propuesta = %s WHERE id = %s',
                           ("asentado", json.dumps({"apunte": asentados[m["id"]]}, ensure_ascii=False, default=str), m["id"]))
    pendientes = [m for m in abiertos if m["id"] not in asentados]
    avisos = await _proponer_facturas(config, id_usuario, cuenta["id_empresa"], pendientes, resumen)
    sin_nada = [m for m in pendientes if m.get("_estado") == "sin_emparejar"]
    resumen["asiento_propuesto"] = 0
    if sin_nada:
        try:
            diario = await _informe(config, id_usuario, cuenta["id_empresa"], "/contabilidad/informes/diario", desde - margen, hasta + margen)
            historico = _conciliar_cuenta.aprender(todos, asentados, diario, cuenta["subcuenta"])
            for m in sin_nada:
                p = _conciliar_cuenta.proponer_asiento(m, cuenta["subcuenta"], diario, historico)
                if p:
                    resumen["sin_emparejar"] -= 1
                    resumen["asiento_propuesto"] += 1
                    await db.query(f'UPDATE "{_TM}" SET estado = %s, propuesta = %s WHERE id = %s',
                                   ("asiento_propuesto", json.dumps(p, ensure_ascii=False, default=str), m["id"]))
        except (ValueError, LookupError) as e:
            avisos.append(f"No se han podido buscar asientos en el diario: {e}")
    return {"revisados": len(abiertos), **resumen, "sin_banco": sin_banco, "avisos": avisos}


async def _proponer_facturas(config: dict, id_usuario: int | None, id_empresa: int, pendientes: list[dict], resumen: dict) -> list[str]:
    """A lo que no está en contabilidad le busca una factura pendiente que encaje."""
    avisos, candidatas = [], []
    for nombre, pedir in (("cobros", _cobros_pendientes), ("pagos", _pagos_pendientes)):
        try:
            candidatas += await pedir(config, id_usuario, id_empresa)
        except (ValueError, LookupError) as e:
            avisos.append(f"No se han podido consultar los {nombre} pendientes del SIF: {e}")
    db = AsyncDatabase(**config)
    for m, r in zip(pendientes, _conciliar.emparejar(pendientes, candidatas)):
        resumen[r["estado"]] += 1
        m["_estado"] = r["estado"]
        await db.query(
            f'UPDATE "{_TM}" SET estado = %s, propuesta = %s WHERE id = %s',
            (r["estado"], json.dumps(r["propuesta"], ensure_ascii=False) if r["propuesta"] else None, m["id"]),
        )
    return avisos


async def emparejar(config: dict, id_usuario: int | None, id_conciliacion: int) -> dict:
    """Compara con la contabilidad la cuenta bancaria a la que pertenece el extracto."""
    return await comparar(config, id_usuario, (await cuenta_de_extracto(config, id_conciliacion))["id"])


ACCIONES = ("confirmar", "descartar", "reabrir")


async def resolver(
    config: dict, id_conciliacion: int, id_movimiento: int, accion: str, id_usuario: int | None,
    sin_factura: bool = False, nota: str | None = None, candidatas: list[dict] | None = None,
) -> dict:
    """Lo que decide el contable sobre un movimiento. Confirmar da por buena la
    propuesta (o, con `sin_factura`, dice que no corresponde a ninguna
    factura: comisiones, intereses...); descartar lo aparta; reabrir
    deshace la decisión. No escribe en el SIF."""
    if accion not in ACCIONES:
        raise ValueError(f"Acción no válida: {accion} (vale {', '.join(ACCIONES)})")
    db = AsyncDatabase(**config)
    filas = await db.query(f'SELECT * FROM "{_TM}" WHERE id = %s AND id_conciliacion = %s', (id_movimiento, id_conciliacion))
    if not filas:
        raise LookupError("Ese movimiento no existe")
    propuesta = json.loads(filas[0]["propuesta"]) if filas[0].get("propuesta") else None
    if accion == "reabrir" and filas[0].get("decision"):
        anterior = json.loads(filas[0]["decision"])
        if anterior.get("id_propuesta"):  # pasó a propuestas: se deshace allí y en el Diario
            await conta_borradores.deshacer_desde_movimiento(config, id_usuario, anterior["id_propuesta"])
    if accion == "confirmar":
        if candidatas:
            elegidas = _candidatas_validas(candidatas, Decimal(str(filas[0]["importe"])))
        elif sin_factura:
            elegidas = []
        elif propuesta and propuesta.get("candidatas"):
            elegidas = propuesta["candidatas"]
        else:
            raise ValueError("Ese movimiento no tiene factura propuesta: elige una, confírmalo como «sin factura» o descártalo")
        estado = "confirmado"
        decision = {"accion": "confirmado", "sin_factura": sin_factura and not candidatas, "candidatas": elegidas,
                    "elegidas_a_mano": bool(candidatas)}
    elif accion == "descartar":
        estado, decision = "descartado", {"accion": "descartado"}
    else:
        estado, decision = (
            ("asentado" if propuesta.get("apunte") else "asiento_propuesto" if propuesta.get("asiento") else "dudoso") if propuesta else "sin_emparejar"), None
    await db.query(
        f'UPDATE "{_TM}" SET estado = %s, decision = %s, nota = %s, revisado_por = %s, fecha_revision = %s WHERE id = %s',
        (estado, json.dumps(decision, ensure_ascii=False) if decision else None,
         (nota or None) if accion != "reabrir" else None, id_usuario if accion != "reabrir" else None,
         ahora_madrid() if accion != "reabrir" else None, id_movimiento),
    )
    return (await movimientos_por_id(config, id_movimiento))


async def cuentas_plan(config: dict, id_usuario: int | None, id_conciliacion: int, texto: str) -> list[dict]:
    """Cuentas del plan de la empresa que admiten apuntes, por número o por nombre."""
    extracto = await obtener(config, id_conciliacion)
    if not extracto:
        raise LookupError("Ese extracto no existe")
    r = await conta_sif.pedir(config, id_usuario, extracto["id_empresa"], "/contabilidad/plan/listar",
                              {"ejercicio": extracto["fecha_hasta"].year, "texto": (texto or "").strip() or None,
                               "solo_auxiliares": True, "limit": LIMITE_CANDIDATAS})
    return [{"codigo": c["codigo"], "descripcion": c.get("descripcion") or ""} for c in r.get("cuentas") or []]


async def asiento_con_cuenta(config: dict, id_conciliacion: int, id_movimiento: int, cuenta: str) -> dict:
    """El contable elige la cuenta de la contrapartida: el movimiento queda con
    el asiento propuesto contra esa cuenta, listo para pasarlo a propuestas."""
    cuenta = (cuenta or "").strip()
    if not cuenta.isdigit() or cuenta.startswith("572"):
        raise ValueError("Elige una cuenta del plan que no sea la del propio banco")
    m = await movimientos_por_id(config, id_movimiento)
    if m["id_conciliacion"] != id_conciliacion:
        raise LookupError("Ese movimiento no existe")
    banco = await cuenta_de_extracto(config, id_conciliacion)
    if not banco["subcuenta"]:
        raise ValueError("Antes elige la subcuenta 572 de esta cuenta bancaria")
    p = _conciliar_cuenta.armar_asiento(m, banco["subcuenta"], cuenta, f"Cuenta elegida por el contable: {cuenta}", 1.0, "elegida", [])
    await AsyncDatabase(**config).query(
        f'UPDATE "{_TM}" SET estado = %s, propuesta = %s, decision = NULL, revisado_por = NULL, fecha_revision = NULL WHERE id = %s',
        ("asiento_propuesto", json.dumps(p, ensure_ascii=False, default=str), id_movimiento),
    )
    return await movimientos_por_id(config, id_movimiento)


async def proponer_asiento(config: dict, id_movimiento: int, id_usuario: int | None, creado_por: str | None = None) -> dict:
    """Pasa a la bandeja de propuestas contables el asiento que se le ha propuesto
    a un movimiento. El contable lo revisa allí; la GD no escribe en el SIF."""
    m = await movimientos_por_id(config, id_movimiento)
    asiento = (m.get("propuesta") or {}).get("asiento")
    if not asiento:
        raise ValueError("Ese movimiento no tiene un asiento propuesto")
    db = AsyncDatabase(**config)
    id_empresa = (await db.query(f'SELECT id_empresa FROM "{_T}" WHERE id = %s', (m["id_conciliacion"],)))[0]["id_empresa"]
    p = m["propuesta"]
    # Se reserva el movimiento antes de crear nada: dos peticiones a la vez no pueden crear dos propuestas
    if not await db.query(
        f'UPDATE "{_TM}" SET estado = %s, decision = %s, revisado_por = %s, fecha_revision = %s WHERE id = %s AND estado = %s',
        ("confirmado", json.dumps({"accion": "asiento_propuesto"}), id_usuario, ahora_madrid(), id_movimiento, "asiento_propuesto"),
    ):
        raise ValueError("Ese movimiento ya se ha pasado a propuestas")
    try:
        propuesta = await conta_propuestas.crear(
            config, id_empresa, "asiento", f"Banco: {asiento['concepto']}"[:255], f"{p['motivo']}. Movimiento del extracto del {m['fecha_operacion']} por {m['importe']} €.",
            asiento, creado_por=creado_por or "Conciliación bancaria",
        )
    except Exception:
        await db.query(f'UPDATE "{_TM}" SET estado = %s, decision = NULL, revisado_por = NULL, fecha_revision = NULL WHERE id = %s', ("asiento_propuesto", id_movimiento))
        raise
    await db.query(
        f'UPDATE "{_TM}" SET decision = %s WHERE id = %s',
        (json.dumps({"accion": "asiento_propuesto", "id_propuesta": propuesta["id"]}), id_movimiento),
    )
    return await movimientos_por_id(config, id_movimiento)


async def movimientos_por_id(config: dict, id_movimiento: int) -> dict:
    fila = (await AsyncDatabase(**config).query(f'SELECT * FROM "{_TM}" WHERE id = %s', (id_movimiento,)))[0]
    for campo in ("propuesta", "decision"):
        fila[campo] = json.loads(fila[campo]) if fila.get(campo) else None
    return fila


CAMPOS_CANDIDATA = ("sentido", "id", "id_factura", "numero_factura", "tercero", "nif", "fecha_vencimiento", "pendiente")


def _candidatas_validas(candidatas: list[dict], importe: Decimal) -> list[dict]:
    """Las facturas que elige el contable a mano: se guardan solo los campos
    conocidos y el sentido tiene que ser el del movimiento (un abono se
    cobra, un cargo se paga)."""
    sentido = "cobro" if importe > 0 else "pago"
    limpias = []
    for c in candidatas:
        if c.get("sentido") != sentido or not isinstance(c.get("id"), int):
            raise ValueError(f"Esa factura no corresponde a un movimiento de {'abono' if importe > 0 else 'cargo'}")
        limpias.append({k: c.get(k) for k in CAMPOS_CANDIDATA})
    return limpias


async def candidatas_para(config: dict, id_usuario: int | None, id_conciliacion: int, id_movimiento: int, texto: str | None = None) -> list[dict]:
    """Facturas pendientes del SIF entre las que elegir para un movimiento: de
    cobro si es un abono, de pago si es un cargo. `texto` filtra por número de
    factura, tercero o NIF."""
    extracto = await obtener(config, id_conciliacion)
    mov = next((m for m in await movimientos(config, id_conciliacion) if m["id"] == id_movimiento), None)
    if not extracto or not mov:
        raise LookupError("Ese movimiento no existe")
    pedir = _cobros_pendientes if Decimal(str(mov["importe"])) > 0 else _pagos_pendientes
    filas = await pedir(config, id_usuario, extracto["id_empresa"])
    if texto and texto.strip():
        q = _conciliar.plano(texto)
        filas = [f for f in filas if q in _conciliar.plano(f"{f.get('numero_factura')} {f.get('nombre')} {f.get('nif')}")]
    filas.sort(key=lambda f: str(f.get("fecha_vencimiento") or ""))
    return [{**_conciliar.resumen(f)} for f in filas[:LIMITE_CANDIDATAS]]
