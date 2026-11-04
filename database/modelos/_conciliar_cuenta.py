"""Lo que une los extractos de una misma cuenta bancaria y la compara con su
mayor — ver docs/planificacion/conciliacion-bancaria.md. Sin base de datos ni
SIF: todo entra como datos, para poder probarlo suelto.

- solapados: dos extractos de la misma cuenta pueden repetir días; un
  movimiento que ya está guardado no se vuelve a guardar. Dos movimientos
  idénticos el mismo día son distintos si el banco los trae dos veces.
- huecos: la cuenta corrida (saldo inicial del primer extracto más todos los
  movimientos) tiene que dar el saldo que dice cada extracto.
- cruzar: cada movimiento con el apunte del mayor de su subcuenta 572."""

import re
import unicodedata
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal

CENTAVO = Decimal("0.01")
DIAS_DE_MARGEN = 7  # el banco y la contabilidad no siempre anotan el mismo día
CAMPOS_CLAVE = ("fecha_operacion", "fecha_valor", "importe", "concepto_comun", "concepto_propio",
                "numero_documento", "referencia1", "referencia2", "concepto")


def clave(m: dict) -> tuple:
    return tuple(str(m.get(k) or "") for k in CAMPOS_CLAVE)


def quitar_solapados(nuevos: list[dict], ya_guardados: list[dict]) -> tuple[list[dict], int]:
    """(los que hay que guardar, cuántos ya estaban)."""
    guardados = Counter(clave(m) for m in ya_guardados)
    vistos: Counter = Counter()
    utiles, repetidos = [], 0
    for m in nuevos:
        k = clave(m)
        vistos[k] += 1
        if vistos[k] <= guardados[k]:
            repetidos += 1
        else:
            utiles.append(m)
    return utiles, repetidos


def _dia(valor) -> date:
    return valor if isinstance(valor, date) else date.fromisoformat(str(valor)[:10])


def huecos(extractos: list[dict], movimientos: list[dict]) -> list[str]:
    """Avisos, con fechas, de lo que falta entre los extractos de una cuenta.
    `extractos` con fecha_desde, fecha_hasta, saldo_inicial y saldo_final;
    `movimientos` con fecha_operacion e importe (los ya sin solapes)."""
    if not extractos:
        return []
    orden = sorted(extractos, key=lambda e: (_dia(e["fecha_desde"]), _dia(e["fecha_hasta"])))
    avisos = []
    base = Decimal(str(orden[0]["saldo_inicial"]))
    cubierto_hasta = _dia(orden[0]["fecha_hasta"])
    for e in orden[1:]:
        desde = _dia(e["fecha_desde"])
        if desde > cubierto_hasta + timedelta(days=1):
            avisos.append(f"Faltan extractos entre el {(cubierto_hasta + timedelta(days=1)):%d/%m/%Y} y el {(desde - timedelta(days=1)):%d/%m/%Y}")
        cubierto_hasta = max(cubierto_hasta, _dia(e["fecha_hasta"]))
    fechas = [(_dia(m["fecha_operacion"]), Decimal(str(m["importe"]))) for m in movimientos]
    for e in orden:
        desde, hasta = _dia(e["fecha_desde"]), _dia(e["fecha_hasta"])
        esperado_inicial = base + sum((i for f, i in fechas if f < desde), Decimal(0))
        diferencia = Decimal(str(e["saldo_inicial"])) - esperado_inicial
        if abs(diferencia) >= CENTAVO and e is not orden[0]:
            avisos.append(f"El extracto del {desde:%d/%m/%Y} al {hasta:%d/%m/%Y} empieza con {e['saldo_inicial']} €, pero los anteriores "
                          f"dejan {esperado_inicial} €: faltan movimientos por {diferencia} € antes del {desde:%d/%m/%Y}")
        esperado_final = base + sum((i for f, i in fechas if f <= hasta), Decimal(0))
        diferencia = Decimal(str(e["saldo_final"])) - esperado_final
        if abs(diferencia) >= CENTAVO:
            avisos.append(f"El extracto del {desde:%d/%m/%Y} al {hasta:%d/%m/%Y} termina con {e['saldo_final']} €, pero los movimientos "
                          f"guardados dan {esperado_final} €: faltan movimientos por {diferencia} € hasta el {hasta:%d/%m/%Y}")
    return avisos


def _importe_apunte(a: dict) -> Decimal:
    return Decimal(str(a.get("debe") or 0)) - Decimal(str(a.get("haber") or 0))


def cruzar(movimientos: list[dict], apuntes: list[dict]) -> tuple[dict, list[dict]]:
    """({id_movimiento: apunte}, apuntes del mayor sin movimiento en el banco).
    Un apunte solo vale para un movimiento: mismo importe y la fecha más
    cercana dentro del margen, firmes antes que borradores."""
    libres = {i: a for i, a in enumerate(apuntes)}
    asentados: dict = {}
    for m in sorted(movimientos, key=lambda x: _dia(x["fecha_operacion"])):
        importe = Decimal(str(m["importe"]))
        fechas = {_dia(m["fecha_operacion"]), _dia(m["fecha_valor"])}
        mejor = None
        for i, a in libres.items():
            if abs(_importe_apunte(a) - importe) >= CENTAVO or not a.get("fecha"):
                continue
            distancia = min(abs((_dia(a["fecha"]) - f).days) for f in fechas)
            if distancia > DIAS_DE_MARGEN:
                continue
            puntos = (distancia, bool(a.get("es_borrador")))
            if mejor is None or puntos < mejor[0]:
                mejor = (puntos, i)
        if mejor:
            asentados[m["id"]] = libres.pop(mejor[1])
    return asentados, list(libres.values())


# ---------- Asiento propuesto para lo que no tiene factura ----------

PAGO_A, COBRO_A = ("40", "41"), ("43", "44")  # proveedores y acreedores / clientes y deudores


def _firma(texto) -> str:
    t = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z]", " ", t).split())[:20]


def _palabras(texto) -> set:
    return {p for p in re.findall(r"[A-Z]{4,}", unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().upper())}


def _pendientes_de_cruzar(diario: list[dict], prefijos: tuple, lado: str) -> list[dict]:
    """Apuntes de proveedores (haber) o clientes (debe) cuyo importe nadie ha
    compensado con otro apunte igual en el lado contrario: facturas sin pagar o
    sin cobrar."""
    otro = "debe" if lado == "haber" else "haber"
    grupos: dict = {}
    for a in diario:
        if str(a["cuenta"]).startswith(prefijos) and Decimal(str(a.get(lado) or 0)) > 0:
            grupos.setdefault((a["cuenta"], Decimal(str(a[lado]))), [[], 0])[0].append(a)
    for a in diario:
        k = (a["cuenta"], Decimal(str(a.get(otro) or 0)))
        if k in grupos:
            grupos[k][1] += 1
    abiertos = []
    for lineas, compensados in grupos.values():
        lineas = sorted(lineas, key=lambda x: str(x.get("fecha")))
        abiertos += lineas[compensados:] if compensados else lineas
    return abiertos


def aprender(movimientos: list[dict], asentados: dict, diario: list[dict], subcuenta: str) -> dict:
    """{firma del concepto: cuenta} con la contrapartida que ya se usó para
    movimientos parecidos que sí están asentados."""
    por_asiento: dict = {}
    for a in diario:
        por_asiento.setdefault((a.get("ejercicio"), a["asiento"]), []).append(a)
    usadas: dict = {}
    por_id = {m["id"]: m for m in movimientos}
    for id_mov, ap in asentados.items():
        otras = {l["cuenta"] for l in por_asiento.get((ap.get("ejercicio"), ap["asiento"]), []) if not str(l["cuenta"]).startswith("572")}
        firma = _firma(por_id[id_mov].get("concepto"))
        if len(otras) == 1 and firma:
            usadas.setdefault(firma, Counter())[otras.pop()] += 1
    return {f: c.most_common(1)[0][0] for f, c in usadas.items()}


def proponer_asiento(movimiento: dict, subcuenta: str, diario: list[dict], historico: dict) -> dict | None:
    """Un asiento contra el banco para un movimiento sin factura, o None.
    1) Hay en contabilidad una factura de proveedor o de cliente por ese
       importe sin compensar: el asiento es su pago o su cobro.
    2) Un movimiento parecido ya asentado usó una cuenta: se repite."""
    importe = Decimal(str(movimiento["importe"]))
    cuantia = abs(importe)
    pago = importe < 0
    texto = " ".join(str(movimiento.get(k) or "") for k in ("concepto", "referencia1", "referencia2"))
    fecha = _dia(movimiento["fecha_valor"])
    abiertos = _pendientes_de_cruzar(diario, PAGO_A if pago else COBRO_A, "haber" if pago else "debe")
    candidatas = [a for a in abiertos if abs(Decimal(str(a["haber" if pago else "debe"])) - cuantia) < CENTAVO]
    if candidatas:
        palabras = _palabras(texto)
        candidatas.sort(key=lambda a: (-len(palabras & _palabras(a.get("concepto"))), abs((_dia(a["fecha"]) - fecha).days)))
        mejor = candidatas[0]
        pista = bool(palabras & _palabras(mejor.get("concepto")))
        motivo = (f"En contabilidad hay {'una factura de proveedor' if pago else 'una factura de cliente'} por este importe sin "
                  f"{'pagar' if pago else 'cobrar'} (asiento {mejor['asiento']}, {mejor['cuenta']})")
        confianza = 0.85 if len(candidatas) == 1 else (0.7 if pista else 0.5)
        if len(candidatas) > 1:
            motivo += f"; hay {len(candidatas)} con ese importe y se propone la que más se parece"
        cuenta, origen, refs = mejor["cuenta"], "pendiente_en_contabilidad", candidatas[:3]
    else:
        cuenta = historico.get(_firma(movimiento.get("concepto")))
        if not cuenta:
            return None
        motivo, confianza, origen, refs = f"Movimientos parecidos ya asentados fueron a la cuenta {cuenta}", 0.6, "historico", []
    return armar_asiento(movimiento, subcuenta, cuenta, motivo, confianza, origen, refs)


def armar_asiento(movimiento: dict, subcuenta: str, cuenta: str, motivo: str, confianza: float, origen: str, refs: list) -> dict:
    """El asiento de un movimiento del banco contra la cuenta dada: un pago es
    cuenta al debe y banco al haber; un cobro, al revés."""
    importe = Decimal(str(movimiento["importe"]))
    cuantia, pago = abs(importe), importe < 0
    fecha = _dia(movimiento["fecha_valor"])
    concepto = (movimiento.get("concepto") or movimiento.get("referencia1") or "Movimiento bancario")[:100]
    lineas = [(cuenta, cuantia, 0), (subcuenta, 0, cuantia)] if pago else [(subcuenta, cuantia, 0), (cuenta, 0, cuantia)]
    return {
        "motivo": motivo, "confianza": confianza, "origen": origen,
        "referencias": [{"asiento": a["asiento"], "fecha": str(a["fecha"]), "cuenta": a["cuenta"], "concepto": a.get("concepto")} for a in refs],
        "asiento": {"fecha": fecha.isoformat(), "concepto": concepto, "documento": f"BANCO-{movimiento['id']}", "apuntes": [
            {"cuenta": c, "concepto": concepto, "debe": float(d), "haber": float(h)} for c, d, h in lineas]},
    }
