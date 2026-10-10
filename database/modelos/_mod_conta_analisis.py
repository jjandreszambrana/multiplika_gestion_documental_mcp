"""Cuentas del asesor contable que hace el programa, no la IA — ver
docs/contabilidad/planificacion.md (fases 3 y 4). Así un ratio o un aviso
sale igual en todas las conversaciones; la IA solo los interpreta.

- `analisis_financiero`: ratios desde el balance y la cuenta de pérdidas
  y ganancias del SIF (`/informes/balance` y `/informes/perdidas_y_ganancias`,
  epígrafes del PGC 2007: los `nodo` de
  multiplika_sif/lib/contabilidad/planes/estructura_balances_pgc_2007.json).
- `saldos_anomalos`: lo que mira la revisión automática en sumas y saldos
  (saldo = debe - haber: deudor positivo)."""

DIAS_ANIO = 365
LIMITE_CUENTAS_AVISO = 10
TOLERANCIA_SALDO = 0.01


def _saldos(filas: list[dict]) -> dict[str, float]:
    return {f["nodo"]: float(f.get("saldo") or 0) for f in filas if f.get("nodo")}


def _div(a: float | None, b: float | None, por: float = 1) -> float | None:
    if a is None or not b:
        return None
    return round(a / b * por, 2)


def analisis_financiero(balance: dict, pyg: dict) -> dict:
    a = _saldos(balance.get("activo") or []) | _saldos(balance.get("pasivo") or [])
    r = _saldos(pyg.get("epigrafes") or [])
    ac, pc, pnc, pn = a.get("AC", 0), a.get("PC", 0), a.get("PNC", 0), a.get("PN", 0)
    pasivo_exigible = pnc + pc
    total_activo = float(balance.get("total_activo") or 0)
    cifra = r.get("A1-1", 0)
    explotacion = r.get("A1", 0)
    # Amortización, aprovisionamientos y servicios exteriores vienen con signo
    # negativo (son gastos en la cuenta de pérdidas y ganancias).
    ebitda = explotacion - r.get("A1-8", 0)
    compras = -(r.get("A1-4", 0) + r.get("A1-7-1", 0))
    resultado = float(pyg.get("resultado") or r.get("A5", 0))

    def ratio(valor, formula):
        return {"valor": valor, "formula": formula}

    return {
        "ejercicio": balance.get("ejercicio"),
        "magnitudes": {
            "activo_corriente": ac, "pasivo_corriente": pc, "patrimonio_neto": pn, "pasivo_no_corriente": pnc,
            "total_activo": total_activo, "cifra_negocios": cifra, "resultado_explotacion": explotacion,
            "ebitda": round(ebitda, 2), "resultado_ejercicio": resultado,
        },
        "liquidez": {
            "fondo_maniobra": ratio(round(ac - pc, 2), "Activo corriente − pasivo corriente"),
            "liquidez_general": ratio(_div(ac, pc), "Activo corriente / pasivo corriente"),
            "prueba_acida": ratio(_div(ac - a.get("ACII", 0), pc), "(Activo corriente − existencias) / pasivo corriente"),
            "tesoreria": ratio(_div(a.get("ACVII", 0), pc), "Efectivo / pasivo corriente"),
        },
        "solvencia": {
            "endeudamiento": ratio(_div(pasivo_exigible, pn), "(Pasivo no corriente + corriente) / patrimonio neto"),
            "autonomia": ratio(_div(pn, pasivo_exigible), "Patrimonio neto / pasivo exigible"),
            "garantia": ratio(_div(total_activo, pasivo_exigible), "Activo total / pasivo exigible"),
        },
        "rentabilidad": {
            "roa": ratio(_div(explotacion, total_activo, 100), "Resultado de explotación / activo total (%)"),
            "roe": ratio(_div(resultado, pn, 100), "Resultado del ejercicio / patrimonio neto (%)"),
            "margen_explotacion": ratio(_div(explotacion, cifra, 100), "Resultado de explotación / cifra de negocios (%)"),
            "margen_ebitda": ratio(_div(ebitda, cifra, 100), "EBITDA / cifra de negocios (%)"),
        },
        "plazos": {
            "periodo_medio_cobro": ratio(_div(a.get("ACIII1", 0), cifra, DIAS_ANIO),
                                         "Clientes / cifra de negocios × 365 (días; sin IVA en la cifra, aproximado)"),
            "periodo_medio_pago": ratio(_div(a.get("PCV", 0), compras, DIAS_ANIO),
                                        "Acreedores comerciales / (aprovisionamientos + servicios exteriores) × 365 (días, aproximado)"),
        },
        "aviso": "Ratios calculados con el balance y la cuenta de pérdidas y ganancias del SIF. Las referencias de "
                 "qué valor es bueno dependen del sector: ver el tema de ratios de la biblioteca.",
    }


def saldos_anomalos(lineas: list[dict]) -> list[dict]:
    """Avisos de la revisión automática, a partir de sumas y saldos cuenta a
    cuenta (`nivel: 0`). Cada aviso: título, justificación y cuentas.
    `signo` de cada regla: 1 avisa del saldo deudor, -1 del acreedor, 0 de
    cualquier saldo."""
    def cuentas(prefijos: tuple, signo: int) -> list[dict]:
        return [
            {"cuenta": l["cuenta"], "descripcion": l.get("descripcion"), "saldo": round(float(l["saldo"]), 2)}
            for l in lineas
            if str(l.get("cuenta", "")).startswith(prefijos)
            and (abs(float(l.get("saldo") or 0)) if signo == 0 else signo * float(l.get("saldo") or 0)) > TOLERANCIA_SALDO
        ][:LIMITE_CUENTAS_AVISO]

    reglas = [
        (("570",), -1, "Caja con saldo acreedor",
         "Una caja no puede tener saldo acreedor: falta apuntar un cobro o sobra un pago."),
        (("572",), -1, "Bancos con saldo acreedor",
         "Un banco en negativo suele ser una póliza de crédito apuntada en la 572 (va en la 5201) o un cobro sin apuntar."),
        (("430",), -1, "Clientes con saldo acreedor",
         "Puede ser un anticipo (va en la 438), un cobro duplicado o una factura sin registrar."),
        (("400", "410"), 1, "Proveedores o acreedores con saldo deudor",
         "Puede ser un anticipo (va en la 407), un pago duplicado o una factura sin registrar."),
        (("555",), 0, "Partidas pendientes de aplicación sin cerrar", "La 555 debe quedar a cero: hay cobros o pagos sin identificar."),
    ]
    avisos = []
    for prefijos, signo, titulo, justificacion in reglas:
        encontradas = cuentas(prefijos, signo)
        if encontradas:
            avisos.append({"titulo": titulo, "justificacion": justificacion, "cuentas": encontradas})
    return avisos


def asiento_valido(detalle: dict) -> dict:
    """Comprueba un asiento propuesto y lo devuelve normalizado. Lanza
    ValueError si no cuadra o está mal formado."""
    apuntes = detalle.get("apuntes") or []
    if len(apuntes) < 2:
        raise ValueError("Un asiento necesita al menos dos apuntes")
    debe = haber = 0.0
    normalizados = []
    for a in apuntes:
        cuenta = str(a.get("cuenta") or "").strip()
        d, h = round(float(a.get("debe") or 0), 2), round(float(a.get("haber") or 0), 2)
        if not cuenta.isdigit():
            raise ValueError(f"Cuenta no válida en un apunte: «{cuenta}»")
        if d < 0 or h < 0 or bool(d) == bool(h):
            raise ValueError(f"El apunte de la cuenta {cuenta} debe llevar importe en el debe o en el haber, no en los dos")
        debe, haber = debe + d, haber + h
        normalizados.append({"cuenta": cuenta, "concepto": a.get("concepto"), "debe": d, "haber": h})
    if abs(debe - haber) > TOLERANCIA_SALDO:
        raise ValueError(f"El asiento no cuadra: debe {debe:.2f} y haber {haber:.2f}")
    return {"fecha": detalle.get("fecha"), "concepto": detalle.get("concepto"), "apuntes": normalizados,
            "total": round(debe, 2)}


# ---------- Informes del SIF, compactados para la IA ----------
# Lo mismo que devuelve el SIF, pero sin cuentas a cero ni campos vacíos y en
# forma de tabla (columnas una vez, filas como listas): unas sumas y saldos
# cuenta a cuenta pasan de ~12.000 tokens a ~3.000-4.000.

COLUMNAS_INFORME = {
    "sumas_y_saldos": ("lineas", ["cuenta", "descripcion", "saldo_anterior", "debe", "haber", "saldo"]),
    "mayor": ("apuntes", ["fecha", "asiento", "concepto", "documento", "debe", "haber", "saldo"]),
    "diario": ("apuntes", ["fecha", "asiento", "cuenta", "concepto", "documento", "debe", "haber"]),
    "libros_iva": ("renglones", None),
}
CAMPOS_IMPORTE = ("saldo_anterior", "debe", "haber", "saldo")


def _a_tabla(filas: list[dict], columnas: list[str] | None) -> dict:
    if not filas:
        return {"columnas": columnas or [], "filas": []}
    columnas = columnas or [c for c in filas[0] if any(f.get(c) not in (None, "", 0, 0.0) for f in filas)]
    return {"columnas": columnas, "filas": [[f.get(c) for c in columnas] for f in filas]}


def _sin_vacios(datos: dict) -> dict:
    return {k: v for k, v in datos.items() if v not in (None, "", [], {})}


def compactar_informe(informe: str, datos: dict) -> dict:
    if informe in ("balance", "perdidas_y_ganancias"):
        resultado = dict(datos)
        for clave in ("activo", "pasivo", "epigrafes"):
            if isinstance(datos.get(clave), list):
                filas = [f for f in datos[clave] if abs(float(f.get("saldo") or 0)) > TOLERANCIA_SALDO]
                resultado[clave] = _a_tabla(filas, ["nodo", "titulo", "cuenta", "nivel", "saldo"])
        return _sin_vacios(resultado)
    if informe in COLUMNAS_INFORME:
        clave, columnas = COLUMNAS_INFORME[informe]
        lista = datos.get(clave)
        if not isinstance(lista, list):
            clave = next((k for k, v in datos.items() if isinstance(v, list)), None)
            lista = datos.get(clave) if clave else None
        if lista is None:
            return _sin_vacios(datos)
        if informe == "sumas_y_saldos":
            lista = [l for l in lista if any(abs(float(l.get(c) or 0)) > TOLERANCIA_SALDO for c in CAMPOS_IMPORTE)]
        return _sin_vacios({**datos, clave: _a_tabla(lista, columnas)})
    return _sin_vacios(datos)
