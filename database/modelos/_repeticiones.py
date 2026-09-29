"""Cuándo salta una programación — ver docs/gestion-documental.md →
"Programaciones y notificaciones". Sin base de datos: solo fechas, para
poder probarlo suelto.

La regla se guarda en JSON (gd_programaciones.regla_repeticion):

    {"tipo": "semanal", "fecha": "2026-10-05", "hora": "09:00",
     "cada_dias": null, "dias_semana": [1, 4], "hasta": "2026-12-31"}

- `tipo`: una_vez | cada_dias | semanal | mensual | anual.
- `fecha`: el día en que salta (una_vez) o desde el que empieza a
  repetirse. En mensual, su día del mes es el que se repite; en anual,
  su día y su mes. Si el mes no tiene ese día (31 en abril, 29 de
  febrero), salta el último día del mes.
- `hora`: "HH:MM", hora de Madrid.
- `cada_dias`: solo en cada_dias (1 = todos los días).
- `dias_semana`: solo en semanal, 1 = lunes … 7 = domingo; vacío = el
  día de la semana de `fecha`.
- `hasta`: último día en que puede saltar, opcional.

Todas las fechas y horas son de reloj de Madrid, sin zona: así "a las
9:00" es a las 9:00 también después del cambio de hora."""

import calendar
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

ZONA = ZoneInfo("Europe/Madrid")
TIPOS = ["una_vez", "cada_dias", "semanal", "mensual", "anual"]
NOMBRES_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
_NOMBRES_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
# Suficiente para cualquier regla válida: el caso más largo es un 29 de
# febrero anual (cada 4 años, a veces 8).
_DIAS_MAXIMOS_BUSQUEDA = 366 * 9


def ahora_madrid() -> datetime:
    """La hora de reloj de Madrid, sin zona — la misma que se guarda."""
    return datetime.now(ZONA).replace(tzinfo=None, microsecond=0)


def _fecha(valor, campo: str) -> date:
    try:
        return date.fromisoformat(str(valor))
    except ValueError:
        raise ValueError(f"'{campo}' debe ser una fecha AAAA-MM-DD (llegó {valor!r})") from None


def _hora(valor) -> time:
    try:
        return datetime.strptime(str(valor)[:5].rstrip(":"), "%H:%M").time()
    except ValueError:
        raise ValueError(f"'hora' debe ser HH:MM (llegó {valor!r})") from None


def validar_regla(regla: dict) -> dict:
    """Comprueba la regla y la devuelve limpia (solo los campos que usa
    su tipo). Lanza ValueError con un mensaje que se puede enseñar tal cual."""
    tipo = regla.get("tipo")
    if tipo not in TIPOS:
        raise ValueError(f"'tipo' debe ser uno de: {', '.join(TIPOS)}")
    limpia = {
        "tipo": tipo,
        "fecha": _fecha(regla.get("fecha"), "fecha").isoformat(),
        "hora": _hora(regla.get("hora") or "09:00").strftime("%H:%M"),
        "cada_dias": None,
        "dias_semana": [],
        "hasta": None,
    }
    if tipo == "cada_dias":
        cada = 1 if regla.get("cada_dias") is None else regla["cada_dias"]
        if not isinstance(cada, int) or not 1 <= cada <= 365:
            raise ValueError("'cada_dias' debe ser un número entre 1 y 365")
        limpia["cada_dias"] = cada
    if tipo == "semanal":
        dias = regla.get("dias_semana") or []
        if any(not isinstance(d, int) or not 1 <= d <= 7 for d in dias):
            raise ValueError("'dias_semana' son números del 1 (lunes) al 7 (domingo)")
        limpia["dias_semana"] = sorted(set(dias)) or [date.fromisoformat(limpia["fecha"]).isoweekday()]
    if tipo != "una_vez" and regla.get("hasta"):
        hasta = _fecha(regla["hasta"], "hasta")
        if hasta < date.fromisoformat(limpia["fecha"]):
            raise ValueError("'hasta' no puede ser anterior a 'fecha'")
        limpia["hasta"] = hasta.isoformat()
    return limpia


def _dia_del_mes(anio: int, mes: int, dia: int) -> int:
    return min(dia, calendar.monthrange(anio, mes)[1])


def _toca(regla: dict, dia: date, inicio: date) -> bool:
    tipo = regla["tipo"]
    if tipo == "una_vez":
        return dia == inicio
    if tipo == "cada_dias":
        return (dia - inicio).days % regla["cada_dias"] == 0
    if tipo == "semanal":
        return dia.isoweekday() in regla["dias_semana"]
    if tipo == "mensual":
        return dia.day == _dia_del_mes(dia.year, dia.month, inicio.day)
    # anual
    return dia.month == inicio.month and dia.day == _dia_del_mes(dia.year, dia.month, inicio.day)


def siguiente_ejecucion(regla: dict, despues_de: datetime) -> datetime | None:
    """La primera vez que salta estrictamente después de `despues_de`, o
    None si ya no hay más. Si el servidor estuvo parado, esto salta las
    que se perdieron: al volver se avisa una vez, no una por cada día."""
    inicio = date.fromisoformat(regla["fecha"])
    hora = time.fromisoformat(regla["hora"])
    hasta = date.fromisoformat(regla["hasta"]) if regla.get("hasta") else None
    dia = max(inicio, despues_de.date())
    for _ in range(_DIAS_MAXIMOS_BUSQUEDA):
        if hasta and dia > hasta:
            return None
        momento = datetime.combine(dia, hora)
        if momento > despues_de and _toca(regla, dia, inicio):
            return momento
        if regla["tipo"] == "una_vez" and dia >= inicio:
            return None
        dia += timedelta(days=1)
    return None


def describir_regla(regla: dict) -> str:
    """En palabras: "Cada lunes y jueves a las 09:00, hasta el 31/12/2026"."""
    inicio = date.fromisoformat(regla["fecha"])
    hora = regla["hora"]
    tipo = regla["tipo"]
    if tipo == "una_vez":
        texto = f"El {inicio:%d/%m/%Y} a las {hora}"
    elif tipo == "cada_dias":
        cada = regla["cada_dias"]
        texto = f"Todos los días a las {hora}" if cada == 1 else f"Cada {cada} días a las {hora}"
        texto += f", desde el {inicio:%d/%m/%Y}"
    elif tipo == "semanal":
        nombres = [NOMBRES_DIAS[d - 1] for d in regla["dias_semana"]]
        dias = nombres[0] if len(nombres) == 1 else f"{', '.join(nombres[:-1])} y {nombres[-1]}"
        texto = f"Cada {dias} a las {hora}"
    elif tipo == "mensual":
        texto = f"El día {inicio.day} de cada mes a las {hora}"
        if inicio.day > 28:
            texto += " (o el último día, si el mes es más corto)"
    else:
        texto = f"Cada {inicio.day} de {_NOMBRES_MESES[inicio.month - 1]} a las {hora}"
    if regla.get("hasta"):
        texto += f", hasta el {date.fromisoformat(regla['hasta']):%d/%m/%Y}"
    return texto
