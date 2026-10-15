"""Orden y Excel de un listado de registros de datos — compartido entre el
panel (botón "Excel" de "Registros de datos") y la IA. El PDF vive en
_mod_pdf.py (pdf_de_registros) porque comparte el render con los
documentos; el orden se aplica aquí para que el PDF, el Excel y la tabla
del panel salgan igual."""

import io
import json

#: Columnas fijas por las que se puede ordenar, además de cualquier campo
#: del esquema (por su nombre).
ORDENES_FIJOS = ["fecha", "conforme", "creado_por"]


def _clave(valor):
    """Vacíos al final (también al ordenar al revés, ver ordenar_registros),
    números como números y lo demás como texto sin mayúsculas."""
    if isinstance(valor, bool):
        return (0, int(valor), "")
    if isinstance(valor, (int, float)):
        return (0, valor, "")
    return (1, 0, str(valor).lower())


def ordenar_registros(registros: list[dict], orden: str | None, descendente: bool = True) -> list[dict]:
    """Sin `orden`, se quedan como vienen de la base (fecha más reciente
    primero). Los que no tienen valor en esa columna van siempre al final."""
    if not orden:
        return registros

    def valor(r):
        if orden == "fecha":
            return f"{r['fecha']} {r.get('hora') or ''}"
        if orden in ORDENES_FIJOS:
            return r.get(orden)
        return r["valores"].get(orden)

    con = [r for r in registros if valor(r) not in (None, "", [])]
    sin = [r for r in registros if valor(r) in (None, "", [])]
    return sorted(con, key=lambda r: _clave(valor(r)), reverse=descendente) + sin


def _celda(valor, definicion: dict | None = None):
    """Números, fechas y textos tal cual (para que se puedan sumar en el
    Excel); listas y objetos, en una línea de texto con las leyendas."""
    if valor is None or isinstance(valor, (bool, int, float, str)):
        return ("Sí" if valor else "No") if isinstance(valor, bool) else valor
    if isinstance(valor, list):
        propiedades = ((definicion or {}).get("items") or {}).get("properties") or {}
        return " | ".join(
            "; ".join(f"{(propiedades.get(k) or {}).get('title') or k}: {v}" for k, v in x.items())
            if isinstance(x, dict) else str(x)
            for x in valor
        )
    if isinstance(valor, dict):
        return "; ".join(f"{k}: {v}" for k, v in valor.items())
    return str(valor)


def excel_de_registros(modelo: dict, registros: list[dict]) -> bytes:
    """Una hoja con una fila por registro, en el orden recibido. Columnas:
    las del esquema de `modelo` (la versión vigente) con sus leyendas, más
    las fijas del registro."""
    import openpyxl
    from openpyxl.styles import Font

    esquema = json.loads(modelo["esquema"]) if isinstance(modelo["esquema"], str) else modelo["esquema"]
    propiedades = esquema.get("properties") or {}

    libro = openpyxl.Workbook()
    hoja = libro.active
    hoja.title = modelo["nombre"][:31]
    hoja.append(
        ["Fecha", "Hora"] + [(d or {}).get("title") or c for c, d in propiedades.items()]
        + ["Conformidad", "Observaciones", "Anotado por", "Versión del modelo"]
    )
    for celda in hoja[1]:
        celda.font = Font(bold=True)
    for r in registros:
        hoja.append(
            [r["fecha"], str(r["hora"])[:5] if r.get("hora") else None]
            + [_celda(r["valores"].get(c), d) for c, d in propiedades.items()]
            + [
                None if r["conforme"] is None else ("Conforme" if r["conforme"] else "No conforme"),
                r["observaciones"], r["creado_por"], r.get("version_modelo"),
            ]
        )
    for celda in hoja["A"][1:]:
        celda.number_format = "DD/MM/YYYY"
    hoja.freeze_panes = "A2"

    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()
