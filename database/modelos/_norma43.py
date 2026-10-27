"""Lector de extractos bancarios en Norma 43 (AEB, cuaderno 43) — ver
docs/planificacion/conciliacion-bancaria.md. Sin base de datos: solo texto
a datos, para poder probarlo suelto.

Registros de 80 caracteres, por posición fija:

- 11: cabecera de cuenta (banco, oficina, cuenta, fechas, saldo inicial).
- 22: un movimiento (fechas, concepto, importe, referencias).
- 23: texto libre del movimiento anterior (hasta cinco por movimiento).
- 24: equivalencia de divisa (se ignora).
- 33: final de cuenta (totales y saldo final).
- 88: final de fichero.

Un fichero puede traer varias cuentas. Los importes son enteros con dos
decimales implícitos; el signo viene aparte (1 = debe/cargo → negativo,
2 = haber/abono → positivo). Los bancos no siempre rellenan igual, así que
se tolera lo que se puede (líneas cortas, 24 y 88 ausentes) y se falla con
un mensaje claro cuando el fichero no es un Norma 43."""

from datetime import date
from decimal import Decimal

LONGITUD = 80
DEBE, HABER = "1", "2"
CODIGOS_DIVISA = {"978": "EUR", "840": "USD", "826": "GBP"}


class ErrorNorma43(ValueError):
    pass


def decodificar(contenido: bytes) -> str:
    """UTF-8 y, si no vale, Windows-1252 (lo habitual en los bancos)."""
    for codificacion in ("utf-8-sig", "cp1252"):
        try:
            return contenido.decode(codificacion)
        except UnicodeDecodeError:
            continue
    return contenido.decode("latin-1")


def _importe(texto: str, clave: str, descripcion: str) -> Decimal:
    texto = texto.strip()
    if not texto.isdigit():
        raise ErrorNorma43(f"{descripcion} no es un número: «{texto}»")
    if clave not in (DEBE, HABER):
        raise ErrorNorma43(f"{descripcion}: la clave debe/haber «{clave}» no vale")
    valor = Decimal(int(texto)) / 100
    return -valor if clave == DEBE else valor


def _fecha(texto: str, descripcion: str) -> date:
    """AAMMDD. Los años de dos cifras se toman como 20AA."""
    if len(texto) != 6 or not texto.isdigit():
        raise ErrorNorma43(f"{descripcion} no es una fecha AAMMDD: «{texto}»")
    try:
        return date(2000 + int(texto[:2]), int(texto[2:4]), int(texto[4:6]))
    except ValueError as e:
        raise ErrorNorma43(f"{descripcion} no es una fecha válida: «{texto}»") from e


def _numero(texto: str) -> int:
    texto = texto.strip()
    return int(texto) if texto.isdigit() else 0


def _importe_sin_signo(texto: str) -> Decimal:
    texto = texto.strip()
    return Decimal(int(texto)) / 100 if texto.isdigit() else Decimal(0)


def _cuenta_nueva(linea: str) -> dict:
    return {
        "banco": linea[2:6], "oficina": linea[6:10], "cuenta": linea[10:20],
        "fecha_desde": _fecha(linea[20:26], "La fecha inicial"),
        "fecha_hasta": _fecha(linea[26:32], "La fecha final"),
        "saldo_inicial": _importe(linea[33:47], linea[32], "El saldo inicial"),
        "divisa": CODIGOS_DIVISA.get(linea[47:50], linea[47:50]),
        "titular": linea[51:71].strip() or None,
        "saldo_final": None, "total_debe": None, "total_haber": None,
        "movimientos": [],
    }


def _movimiento_nuevo(linea: str, orden: int) -> dict:
    return {
        "orden": orden,
        "fecha_operacion": _fecha(linea[10:16], "La fecha de operación"),
        "fecha_valor": _fecha(linea[16:22], "La fecha valor"),
        "concepto_comun": linea[22:24],
        "concepto_propio": linea[24:27],
        "importe": _importe(linea[28:42], linea[27], "El importe"),
        "numero_documento": linea[42:52].strip() or None,
        "referencia1": linea[52:64].strip() or None,
        "referencia2": linea[64:80].strip() or None,
        "concepto": "",
    }


def _cerrar_cuenta(cuenta: dict, linea: str) -> None:
    cuenta["total_debe"] = _importe_sin_signo(linea[25:39])
    cuenta["total_haber"] = _importe_sin_signo(linea[43:57])
    cuenta["saldo_final"] = _importe(linea[59:73], linea[58], "El saldo final")
    cuenta["apuntes_debe"] = _numero(linea[20:25])
    cuenta["apuntes_haber"] = _numero(linea[39:44])


def leer(contenido: bytes | str) -> list[dict]:
    """Devuelve una entrada por cuenta del fichero, con sus movimientos y un
    `cuadra` que dice si saldo inicial + movimientos = saldo final."""
    texto = decodificar(contenido) if isinstance(contenido, bytes) else contenido
    cuentas: list[dict] = []
    cuenta: dict | None = None
    movimiento: dict | None = None
    for numero, bruta in enumerate(texto.splitlines(), start=1):
        if not bruta.strip():
            continue
        linea = bruta.rstrip("\r\n").ljust(LONGITUD)
        tipo = linea[:2]
        try:
            if tipo == "11":
                cuenta, movimiento = _cuenta_nueva(linea), None
                cuentas.append(cuenta)
            elif tipo == "22":
                if cuenta is None:
                    raise ErrorNorma43("hay un movimiento antes de la cabecera de la cuenta")
                movimiento = _movimiento_nuevo(linea, len(cuenta["movimientos"]) + 1)
                cuenta["movimientos"].append(movimiento)
            elif tipo == "23":
                if movimiento is None:
                    raise ErrorNorma43("hay un texto complementario sin movimiento")
                extra = " ".join(parte.strip() for parte in (linea[4:42], linea[42:80]) if parte.strip())
                movimiento["concepto"] = f"{movimiento['concepto']} {extra}".strip()
            elif tipo == "33":
                if cuenta is None:
                    raise ErrorNorma43("hay un final de cuenta sin cabecera")
                _cerrar_cuenta(cuenta, linea)
                cuenta, movimiento = None, None
            elif tipo in ("24", "88"):
                continue
            else:
                raise ErrorNorma43(f"registro desconocido «{tipo}»")
        except ErrorNorma43 as e:
            raise ErrorNorma43(f"Línea {numero}: {e}") from e
    if not cuentas:
        raise ErrorNorma43("El fichero no tiene ninguna cuenta: no parece un Norma 43")
    for c in cuentas:
        if c["saldo_final"] is None:
            raise ErrorNorma43(f"La cuenta {c['banco']}-{c['oficina']}-{c['cuenta']} no tiene registro de final")
        c["cuadra"] = c["saldo_inicial"] + sum((m["importe"] for m in c["movimientos"]), Decimal(0)) == c["saldo_final"]
    return cuentas
