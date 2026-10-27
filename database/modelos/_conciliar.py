"""Emparejado de los movimientos de un extracto con las facturas pendientes de
cobro o de pago — ver docs/planificacion/conciliacion-bancaria.md (fase 2).
Sin base de datos ni SIF: movimientos y candidatas entran como datos, para
poder probarlo suelto. Solo propone; decide el contable.

Un abono (importe positivo) se busca entre los cobros pendientes (facturas
emitidas) y un cargo (negativo) entre los pagos pendientes (recibidas).

- exacto: una sola candidata con el mismo importe pendiente y con pista en
  el concepto (número de factura, NIF o nombre del tercero).
- dudoso: mismo importe sin pista, varias candidatas, un pago que cubre
  varias facturas del mismo tercero, o el tercero cuadra pero el importe no.
- sin_emparejar: no hay nada parecido."""

import re
import unicodedata
from decimal import Decimal
from itertools import combinations

MAX_PARA_SUMAR = 12   # facturas del mismo tercero que se prueban en combinación
MAX_EN_SUMA = 6       # facturas máximas en un solo pago
MAX_PROPUESTAS = 5
SIN_VALOR = {"SOCIEDAD", "LIMITADA", "ANONIMA", "COMERCIAL", "SERVICIOS", "GRUPO", "EMPRESA"}
CENTAVO = Decimal("0.01")


def plano(texto) -> str:
    texto = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]", "", texto.upper())


def _palabras(texto) -> set[str]:
    texto = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return set(re.findall(r"[A-Z0-9]+", texto.upper()))


def _pistas(candidata: dict, texto_plano: str, palabras: set[str]) -> list[str]:
    pistas = []
    factura = plano(candidata.get("numero_factura"))
    if len(factura) >= 3 and factura in texto_plano:
        pistas.append("número de factura")
    nif = plano(candidata.get("nif"))
    if len(nif) >= 8 and nif in texto_plano:
        pistas.append("NIF")
    significativas = [p for p in re.findall(r"[A-Z0-9]+", _plano_con_espacios(candidata.get("nombre")))
                      if len(p) >= 4 and p not in SIN_VALOR]
    if significativas and all(p in palabras for p in significativas[:2]):
        pistas.append("nombre")
    return pistas


def _plano_con_espacios(texto) -> str:
    return unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode().upper()


def resumen(c: dict, extra: dict | None = None) -> dict:
    return {
        "sentido": c["sentido"], "id": c["id"], "id_factura": c.get("id_factura"), "numero_factura": c.get("numero_factura"),
        "tercero": c.get("nombre"), "nif": c.get("nif"), "fecha_vencimiento": c.get("fecha_vencimiento"),
        "pendiente": str(c["pendiente"]), **(extra or {}),
    }


def _clave(c: dict) -> tuple:
    return (c["sentido"], c["id"])


def _suma_exacta(candidatas: list[dict], objetivo: Decimal) -> list[dict] | None:
    base = sorted(candidatas, key=lambda c: c.get("fecha_vencimiento") or "")[:MAX_PARA_SUMAR]
    for n in range(2, min(MAX_EN_SUMA, len(base)) + 1):
        for grupo in combinations(base, n):
            if abs(sum((c["pendiente"] for c in grupo), Decimal(0)) - objetivo) < CENTAVO:
                return list(grupo)
    return None


def _proponer(estado: str, confianza: float, motivo: str, candidatas: list[dict]) -> dict:
    return {"estado": estado, "propuesta": {
        "motivo": motivo, "confianza": confianza, "candidatas": [resumen(c, extra) for c, extra in candidatas[:MAX_PROPUESTAS]],
    }}


def _uno(movimiento: dict, candidatas: list[dict], usadas: set) -> dict:
    importe = movimiento["importe"]
    cuantia = abs(importe)
    sentido = "cobro" if importe > 0 else "pago"
    posibles = [c for c in candidatas if c["sentido"] == sentido]
    texto = " ".join(str(movimiento.get(k) or "") for k in ("concepto", "referencia1", "referencia2", "numero_documento"))
    texto_plano, palabras = plano(texto), _palabras(texto)
    pistas = {_clave(c): _pistas(c, texto_plano, palabras) for c in posibles}
    con_pista = [c for c in posibles if pistas[_clave(c)]]
    mismo_importe = [c for c in posibles if abs(c["pendiente"] - cuantia) < CENTAVO]

    def con(c):
        return (c, {"pistas": pistas[_clave(c)]} if pistas[_clave(c)] else {})

    acertadas = [c for c in mismo_importe if pistas[_clave(c)]]
    if len(acertadas) == 1:
        c = acertadas[0]
        if _clave(c) in usadas:
            return _proponer("dudoso", 0.4, "Encaja, pero esa factura ya se ha propuesto para otro movimiento", [con(c)])
        return _proponer("exacto", 0.95, f"Mismo importe y coincide el {' y el '.join(pistas[_clave(c)])}", [con(c)])
    if len(acertadas) > 1:
        return _proponer("dudoso", 0.5, "Varias facturas con el mismo importe y el mismo tercero", [con(c) for c in acertadas])
    if mismo_importe:
        motivo = "Mismo importe, pero el concepto no dice de qué factura es" if len(mismo_importe) == 1 else \
            f"{len(mismo_importe)} facturas con ese importe y el concepto no dice cuál"
        return _proponer("dudoso", 0.5 if len(mismo_importe) == 1 else 0.3, motivo, [con(c) for c in mismo_importe])
    if con_pista:
        suma = _suma_exacta(con_pista, cuantia)
        if suma:
            return _proponer("dudoso", 0.7, f"Cubre {len(suma)} facturas del mismo tercero", [con(c) for c in suma])
        return _proponer(
            "dudoso", 0.3, "Parece de este tercero, pero el importe no coincide (pago parcial, comisión o diferencia)",
            [(c, {"pistas": pistas[_clave(c)], "diferencia": str(cuantia - c["pendiente"])}) for c in con_pista],
        )
    return {"estado": "sin_emparejar", "propuesta": None}


def emparejar(movimientos: list[dict], candidatas: list[dict]) -> list[dict]:
    """Una respuesta por movimiento y en el mismo orden: `estado` y `propuesta`.
    Las candidatas llevan `sentido` (cobro/pago), `id`, `id_factura`,
    `numero_factura`, `nif`, `nombre`, `fecha_vencimiento` y `pendiente`
    (Decimal, positivo). Una factura propuesta como exacta a un movimiento no
    vuelve a salir como exacta a otro."""
    usadas: set = set()
    respuestas = []
    for m in movimientos:
        r = _uno(m, candidatas, usadas)
        if r["estado"] == "exacto":
            usadas.add(_clave_candidata(r))
        respuestas.append(r)
    return respuestas


def _clave_candidata(respuesta: dict) -> tuple:
    c = respuesta["propuesta"]["candidatas"][0]
    return (c["sentido"], c["id"])
