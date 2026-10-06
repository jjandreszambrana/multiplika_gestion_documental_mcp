"""Datos del ERP en la GD: clientes y facturas que llegan de Multiplika SIF
(_mod_sif.py) o de un Excel/CSV exportado de cualquier otro ERP — ver
docs/gestion-documental.md → "CRM".

Lo común a las dos vías está aquí: cómo se cruza un cliente con
gd_entidades (código, luego NIF, luego nombre exacto), cómo se guarda una
factura (por origen + número + fecha: volver a importar no duplica) y el
resumen económico de cada entidad. La importación desde Excel va también
aquí: leer el fichero, proponer qué columna es cada campo, enseñar qué
pasaría (simulándolo en una transacción que se deshace) y aplicarlo.

Lanza ValueError / LookupError con mensajes que se pueden enseñar tal cual."""

import csv
import hashlib
import io
import json
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_entidades import NOMBRE_TABLA_ENTIDADES as _T_ENT
from ..dependencias._dep_erp import (
    NOMBRE_TABLA_FACTURAS as _T_FAC,
    NOMBRE_TABLA_IMPORTACIONES as _T_IMP,
    NOMBRE_TABLA_MAPEOS as _T_MAP,
    OBJETOS_IMPORTACION,
)
from ._repeticiones import ahora_madrid

MAX_FILAS = 50000
MAX_ERRORES_ENSENADOS = 50
FORMATOS_FECHA = ["dd/mm/aaaa", "mm/dd/aaaa", "aaaa-mm-dd"]

_CAMPOS_CLIENTE = ["codigo", "nombre", "nif", "direccion", "localidad", "provincia", "codigo_postal", "pais", "telefono", "email"]

#: objeto -> [(campo, etiqueta, obligatorio, sinónimos de cabecera)]
CAMPOS = {
    "clientes": [
        ("codigo", "Código", False, ["codigo", "cod", "codcli", "cod cliente", "codigo cliente", "id cliente", "cliente"]),
        ("nombre", "Nombre o razón social", True, ["nombre", "razon social", "nombre fiscal", "denominacion", "nomcli", "nombre cliente"]),
        ("nif", "NIF/CIF", False, ["nif", "cif", "nif cif", "dni", "nif/cif", "cif/nif", "nifcli"]),
        ("direccion", "Dirección", False, ["direccion", "domicilio", "dirección", "calle"]),
        ("localidad", "Localidad", False, ["localidad", "poblacion", "ciudad", "municipio"]),
        ("provincia", "Provincia", False, ["provincia"]),
        ("codigo_postal", "Código postal", False, ["codigo postal", "cp", "c.p.", "cod postal", "postal"]),
        ("pais", "País", False, ["pais"]),
        ("telefono", "Teléfono", False, ["telefono", "tel", "tlf", "movil", "telefono 1"]),
        ("email", "Email", False, ["email", "e-mail", "correo", "mail", "correo electronico"]),
    ],
    "facturas": [
        ("numero", "Número de factura", True, ["numero", "num factura", "n factura", "factura", "numero factura", "nº factura", "num", "documento"]),
        ("fecha", "Fecha", True, ["fecha", "fecha factura", "fecha expedicion", "fecha emision", "f. factura", "fec"]),
        ("codigo_cliente", "Código del cliente", False, ["codigo cliente", "cod cliente", "codcli", "cliente codigo", "cod"]),
        ("nif_cliente", "NIF del cliente", False, ["nif", "cif", "nif cliente", "cif cliente", "nif/cif"]),
        ("nombre_cliente", "Nombre del cliente", False, ["cliente", "nombre cliente", "razon social", "nombre"]),
        ("base", "Base imponible", False, ["base", "base imponible", "importe neto", "neto", "subtotal"]),
        ("total", "Total", True, ["total", "total factura", "importe total", "importe"]),
        ("pendiente_cobro", "Pendiente de cobro", False, ["pendiente", "pendiente cobro", "pendiente de cobro", "saldo", "importe pendiente"]),
    ],
    "cobros": [
        ("numero", "Número de factura", True, ["numero", "factura", "num factura", "numero factura", "nº factura", "documento"]),
        ("fecha", "Fecha de la factura", False, ["fecha factura", "fecha", "f. factura"]),
        ("pendiente_cobro", "Pendiente de cobro", True, ["pendiente", "pendiente cobro", "pendiente de cobro", "saldo", "importe pendiente"]),
    ],
}


# ---------- Utilidades ----------

def _sin_acentos(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def _clave_cabecera(texto) -> str:
    texto = _sin_acentos(str(texto or "").lower())
    return " ".join(re.sub(r"[^a-z0-9/º.]+", " ", texto).replace(".", " ").split())


def normalizar_nif(valor) -> str | None:
    nif = re.sub(r"[^A-Za-z0-9]", "", str(valor or "")).upper()
    return nif or None


def _texto(valor, maximo: int = 255) -> str | None:
    if valor is None:
        return None
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)  # un código 123 que Excel guardó como 123.0
    texto = " ".join(str(valor).split())
    return texto[:maximo] or None


def leer_importe(valor) -> Decimal | None:
    """12.000,50 / 12,000.50 / 12000.5 / 1.234 € → Decimal. None si vacío."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, (int, float, Decimal)):
        return Decimal(str(valor)).quantize(Decimal("0.01"))
    texto = re.sub(r"[^\d,.\-]", "", str(valor))
    if not texto or texto in "-.,":
        raise ValueError(f"importe no válido: «{valor}»")
    if "," in texto and "." in texto:
        decimal = "," if texto.rfind(",") > texto.rfind(".") else "."
        texto = texto.replace("." if decimal == "," else ",", "").replace(",", ".")
    elif "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(\.\d{3})+", texto):
        texto = texto.replace(".", "")  # 1.234 = mil doscientos treinta y cuatro
    try:
        return Decimal(texto).quantize(Decimal("0.01"))
    except InvalidOperation as e:
        raise ValueError(f"importe no válido: «{valor}»") from e


def leer_fecha(valor, formato: str = "dd/mm/aaaa") -> date | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()[:19]
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", texto)
    if m:
        a, mes, d = m.groups()
    else:
        m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})", texto)
        if not m:
            raise ValueError(f"fecha no válida: «{valor}»")
        x, y, a = m.groups()
        d, mes = (y, x) if formato == "mm/dd/aaaa" else (x, y)
        if len(a) == 2:
            a = f"20{a}"
    try:
        return date(int(a), int(mes), int(d))
    except ValueError as e:
        raise ValueError(f"fecha no válida: «{valor}»") from e


# ---------- Cruce con gd_entidades y guardado ----------

async def buscar_entidad(db: AsyncDatabase, cx, codigo: str | None, nif: str | None, nombre: str | None) -> dict | None:
    """Por código; si no, por NIF; si no, por nombre exacto (sin mayúsculas
    ni espacios de más)."""
    for condicion, valor in (("codigo = %s", codigo), ("UPPER(REGEXP_REPLACE(nif, '[^A-Za-z0-9]', '', 'g')) = %s", nif),
                             ("LOWER(TRIM(nombre)) = LOWER(TRIM(%s))", nombre)):
        if valor:
            filas = await db.query(f'SELECT * FROM "{_T_ENT}" WHERE {condicion} ORDER BY id LIMIT 1', (valor,), conexion=cx)
            if filas:
                return filas[0]
    return None


async def guardar_cliente(db: AsyncDatabase, cx, datos: dict, ahora: datetime, crear_sin_nif: bool = False) -> tuple[str, int]:
    """("creado" | "actualizado", id). Los campos que vienen vacíos no
    borran lo que ya hay. Sin código ni NIF solo se actualiza una entidad
    con el mismo nombre exacto; crearla así, solo con `crear_sin_nif`."""
    limpio = {k: _texto(datos.get(k)) for k in _CAMPOS_CLIENTE}
    limpio["nif"] = normalizar_nif(limpio["nif"])
    if not limpio["nombre"]:
        raise ValueError("falta el nombre")
    existente = await buscar_entidad(db, cx, limpio["codigo"], limpio["nif"], limpio["nombre"])
    if existente and limpio["codigo"] and existente["codigo"] and existente["codigo"] != limpio["codigo"]:
        existente = None if existente["codigo"] else existente  # mismo NIF con otro código: es otra ficha del ERP
    if existente:
        cambios = {k: v for k, v in limpio.items() if v and v != existente.get(k)}
        if "codigo" in cambios and existente["codigo"]:
            cambios.pop("codigo")
        if cambios.get("codigo") and await db.query(f'SELECT 1 FROM "{_T_ENT}" WHERE codigo = %s', (cambios["codigo"],), conexion=cx):
            cambios.pop("codigo")
        cambios.update({"baja_erp": False, "fecha_sync_erp": ahora})
        asignaciones = ", ".join(f"{k} = %s" for k in cambios)
        await db.query(f'UPDATE "{_T_ENT}" SET {asignaciones} WHERE id = %s', (*cambios.values(), existente["id"]), conexion=cx)
        return "actualizado", existente["id"]
    if not limpio["codigo"] and not limpio["nif"] and not crear_sin_nif:
        raise ValueError(f"«{limpio['nombre']}» no tiene código ni NIF y no hay ninguna entidad con ese nombre: créala a mano")
    valores = {k: v for k, v in limpio.items() if v}
    valores.update({"tipo": "cliente", "baja_erp": False, "fecha_sync_erp": ahora})
    await db.query(
        f'INSERT INTO "{_T_ENT}" ({", ".join(valores)}) VALUES ({", ".join(["%s"] * len(valores))}) RETURNING id',
        tuple(valores.values()), conexion=cx,
    )
    return "creado", db.ultimo_insert_id


async def guardar_factura(
    db: AsyncDatabase, cx, origen: str, datos: dict, ahora: datetime, id_conexion: int | None = None,
) -> tuple[str, int | None]:
    """("creada" | "actualizada", id_entidad). Se cruza con su cliente por
    código o NIF; si no existe y trae NIF y nombre, se da de alta."""
    numero = _texto(datos.get("numero"), 100)
    if not numero:
        raise ValueError("falta el número de factura")
    fecha = leer_fecha(datos.get("fecha")) if not isinstance(datos.get("fecha"), date) else datos["fecha"]
    if not fecha:
        raise ValueError("falta la fecha")
    total = datos["total"] if isinstance(datos.get("total"), Decimal) else leer_importe(datos.get("total"))
    if total is None:
        raise ValueError("falta el total")
    nif = normalizar_nif(datos.get("nif_cliente"))
    codigo = _texto(datos.get("codigo_cliente"), 100)
    nombre = _texto(datos.get("nombre_cliente"))
    entidad = await buscar_entidad(db, cx, codigo, nif, None)
    if not entidad and (nif or codigo) and nombre:
        _, id_entidad = await guardar_cliente(db, cx, {"codigo": codigo, "nif": nif, "nombre": nombre}, ahora)
    else:
        id_entidad = entidad["id"] if entidad else None
    valores = {
        "origen": origen, "id_conexion": id_conexion, "id_externo": _texto(datos.get("id_externo"), 100),
        "numero": numero, "fecha": fecha, "id_entidad": id_entidad, "nif_cliente": nif, "nombre_cliente": nombre,
        "base": datos["base"] if isinstance(datos.get("base"), Decimal) else leer_importe(datos.get("base")),
        "total": total,
        "pendiente_cobro": datos["pendiente_cobro"] if isinstance(datos.get("pendiente_cobro"), Decimal)
        else leer_importe(datos.get("pendiente_cobro")),
        "anulada": bool(datos.get("anulada")), "fecha_actualizacion": ahora,
    }
    actualizar = ", ".join(f"{k} = EXCLUDED.{k}" for k in valores if k not in ("origen", "numero", "fecha"))
    await db.query(
        f'INSERT INTO "{_T_FAC}" ({", ".join(valores)}) VALUES ({", ".join(["%s"] * len(valores))}) '
        f"ON CONFLICT (origen, numero, fecha) DO UPDATE SET {actualizar} RETURNING (xmax = 0)",
        tuple(valores.values()), conexion=cx,
    )
    return ("creada" if db.ultimo_insert_id else "actualizada"), id_entidad


async def guardar_cobro(db: AsyncDatabase, cx, origen: str, datos: dict, ahora: datetime) -> str:
    numero = _texto(datos.get("numero"), 100)
    if not numero:
        raise ValueError("falta el número de factura")
    pendiente = leer_importe(datos.get("pendiente_cobro"))
    if pendiente is None:
        raise ValueError("falta el importe pendiente")
    condicion, params = "origen = %s AND numero = %s", [origen, numero]
    if datos.get("fecha"):
        condicion += " AND fecha = %s"
        params.append(leer_fecha(datos["fecha"]))
    filas = await db.query(f'SELECT id FROM "{_T_FAC}" WHERE {condicion}', tuple(params), conexion=cx)
    if not filas:
        raise ValueError(f"no hay ninguna factura {numero}: importa antes las facturas")
    if len(filas) > 1:
        raise ValueError(f"hay varias facturas {numero}: el fichero tiene que traer también su fecha")
    await db.query(
        f'UPDATE "{_T_FAC}" SET pendiente_cobro = %s, fecha_actualizacion = %s WHERE id = %s', (pendiente, ahora, filas[0]["id"]),
        conexion=cx,
    )
    return "actualizada"


# ---------- Lo que se enseña de cada entidad ----------

async def resumen_economico(config: dict, id_entidad: int) -> dict | None:
    """Facturado este año y el anterior (base imponible; el total si no se
    sabe la base), pendiente de cobro y de cuándo son los datos. None si no
    hay ninguna factura suya."""
    hoy = ahora_madrid().date()
    filas = await AsyncDatabase(**config).query(
        f"""
        SELECT COUNT(*) AS facturas,
               COALESCE(SUM(COALESCE(base, total)) FILTER (WHERE EXTRACT(YEAR FROM fecha) = %s), 0) AS facturado_anio,
               COALESCE(SUM(COALESCE(base, total)) FILTER (WHERE EXTRACT(YEAR FROM fecha) = %s), 0) AS facturado_anio_anterior,
               COUNT(*) FILTER (WHERE base IS NULL) AS sin_base,
               COALESCE(SUM(total) FILTER (WHERE EXTRACT(YEAR FROM fecha) = %s), 0) AS total_anio,
               SUM(pendiente_cobro) AS pendiente_cobro,
               COUNT(pendiente_cobro) AS con_pendiente_conocido,
               MAX(fecha) AS fecha_ultima_factura, MAX(fecha_actualizacion) AS fecha_datos,
               STRING_AGG(DISTINCT origen, ',') AS origenes
        FROM "{_T_FAC}" WHERE id_entidad = %s AND NOT anulada
        """,
        (hoy.year, hoy.year - 1, hoy.year, id_entidad),
    )
    f = filas[0]
    if not f["facturas"]:
        return None
    return {
        "facturas": f["facturas"], "anio": hoy.year,
        "facturado_anio": float(f["facturado_anio"]), "facturado_anio_anterior": float(f["facturado_anio_anterior"]),
        "total_anio": float(f["total_anio"]),
        "pendiente_cobro": float(f["pendiente_cobro"]) if f["con_pendiente_conocido"] else None,
        "fecha_ultima_factura": f["fecha_ultima_factura"], "fecha_datos": f["fecha_datos"],
        "origenes": (f["origenes"] or "").split(","),
        # Las de SIF no traen la base: entonces lo facturado va con impuestos
        "incluye_impuestos": bool(f["sin_base"]),
    }


async def facturas_entidad(config: dict, id_entidad: int, solo_pendientes: bool = False, limite: int = 50) -> list[dict]:
    condicion = " AND pendiente_cobro > 0" if solo_pendientes else ""
    filas = await AsyncDatabase(**config).query(
        f'SELECT id, origen, numero, fecha, base, total, pendiente_cobro, anulada, fecha_actualizacion '
        f'FROM "{_T_FAC}" WHERE id_entidad = %s{condicion} ORDER BY fecha DESC, numero DESC LIMIT %s',
        (id_entidad, max(1, min(int(limite), 500))),
    )
    for f in filas:
        for k in ("base", "total", "pendiente_cobro"):
            f[k] = float(f[k]) if f[k] is not None else None
    return filas


# ---------- Importación desde Excel/CSV ----------

def _celda(valor):
    if isinstance(valor, str):
        valor = valor.strip()
        return valor or None
    return valor


def leer_tabla(contenido: bytes, nombre: str) -> list[list]:
    """Las filas del fichero (la primera hoja si es Excel), sin filas vacías."""
    extension = nombre.lower().rsplit(".", 1)[-1] if "." in nombre else ""
    if extension in ("xlsx", "xlsm"):
        try:
            import openpyxl
        except ImportError as e:  # pragma: no cover - depende del servidor
            raise ValueError("Este servidor no puede leer Excel todavía (falta openpyxl): usa CSV") from e
        try:
            libro = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
        except Exception as e:
            raise ValueError(f"No se puede abrir «{nombre}» como Excel: {e}") from e
        hoja = libro.worksheets[0]
        filas = [[_celda(c) for c in fila] for fila in hoja.iter_rows(values_only=True)]
        libro.close()
    elif extension in ("csv", "txt"):
        for codificacion in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                texto = contenido.decode(codificacion)
                break
            except UnicodeDecodeError:
                continue
        try:
            dialecto = csv.Sniffer().sniff(texto[:5000], delimiters=";,\t|")
        except csv.Error:
            dialecto = csv.excel
            dialecto.delimiter = ";" if texto[:5000].count(";") > texto[:5000].count(",") else ","
        filas = [[_celda(c) for c in fila] for fila in csv.reader(io.StringIO(texto), dialecto)]
    elif extension == "xls":
        raise ValueError("Los .xls antiguos no se pueden leer: ábrelo y guárdalo como .xlsx o .csv")
    else:
        raise ValueError(f"«{nombre}» no es un Excel (.xlsx) ni un CSV")
    filas = [f for f in filas if any(c is not None for c in f)]
    if len(filas) > MAX_FILAS + 20:
        raise ValueError(f"El fichero tiene más de {MAX_FILAS} filas: pártelo en varios")
    return filas


def _separar_cabecera(filas: list[list]) -> tuple[list[str], list[list]]:
    """La cabecera es la primera fila (de las 15 primeras) con al menos dos
    textos: los ERPs suelen poner antes el título del listado."""
    for i, fila in enumerate(filas[:15]):
        textos = [c for c in fila if isinstance(c, str)]
        if len(textos) >= 2 and len(textos) >= len([c for c in fila if c is not None]) * 0.6:
            cabeceras = [_texto(c) or f"Columna {j + 1}" for j, c in enumerate(fila)]
            return cabeceras, filas[i + 1:]
    raise ValueError("No encuentro la fila de cabeceras (los nombres de las columnas) en las primeras 15 filas")


def huella(cabeceras: list[str]) -> str:
    return hashlib.sha1("|".join(_clave_cabecera(c) for c in cabeceras).encode()).hexdigest()


def proponer_mapeo(objeto: str, cabeceras: list[str]) -> dict[str, int]:
    """campo -> índice de columna. Primero coincidencias exactas con los
    sinónimos y luego parciales; cada columna se usa una sola vez."""
    claves = [_clave_cabecera(c) for c in cabeceras]
    mapeo, usadas = {}, set()
    for exacta in (True, False):
        for campo, _, _, sinonimos in CAMPOS[objeto]:
            if campo in mapeo:
                continue
            for sinonimo in sinonimos:
                s = _clave_cabecera(sinonimo)
                for i, clave in enumerate(claves):
                    if i in usadas or not clave:
                        continue
                    if clave == s if exacta else (len(s) > 3 and s in clave):
                        mapeo[campo] = i
                        usadas.add(i)
                        break
                if campo in mapeo:
                    break
    return mapeo


def _comprobar_objeto(objeto: str) -> None:
    if objeto not in OBJETOS_IMPORTACION:
        raise ValueError(f"Qué se importa no válido: '{objeto}' (clientes, facturas o cobros)")


def _limpiar_mapeo(objeto: str, mapeo: dict, num_columnas: int) -> dict[str, int]:
    validos = {c for c, *_ in CAMPOS[objeto]}
    limpio = {}
    for campo, indice in (mapeo or {}).items():
        if campo not in validos:
            raise ValueError(f"Campo desconocido en el mapeo: '{campo}'")
        if indice is None or indice == "":
            continue
        indice = int(indice)
        if not 0 <= indice < num_columnas:
            raise ValueError(f"La columna {indice} de «{campo}» no existe en el fichero")
        limpio[campo] = indice
    return limpio


def _fila_a_datos(objeto: str, fila: list, mapeo: dict[str, int], formato_fecha: str) -> dict:
    datos = {campo: (fila[i] if i < len(fila) else None) for campo, i in mapeo.items()}
    if objeto in ("facturas", "cobros") and datos.get("fecha") is not None:
        datos["fecha"] = leer_fecha(datos["fecha"], formato_fecha)
    for campo in ("base", "total", "pendiente_cobro"):
        if campo in datos and objeto != "clientes":
            datos[campo] = leer_importe(datos[campo])
    return datos


class _Simulacion(Exception):
    def __init__(self, resumen: dict):
        self.resumen = resumen


async def _procesar(
    db: AsyncDatabase, cx, objeto: str, filas: list[list], mapeo: dict[str, int], formato_fecha: str,
    todos_los_clientes: bool, ahora: datetime,
) -> dict:
    """Aplica las filas dentro de la transacción `cx`. Una fila que falla no
    para las demás: se apunta en errores (con su número de fila del fichero)."""
    cuenta = {"creados": 0, "actualizados": 0, "sin_cliente": 0}
    errores, vistos = [], set()
    # Abre ya la transacción: si no, el primer cx.transaction() de abajo sería
    # una transacción propia que se confirma al salir, y no un savepoint
    await db.query("SELECT 1", conexion=cx)
    for n, fila in enumerate(filas, start=1):
        try:
            async with cx.transaction():  # savepoint: si la fila falla, solo se deshace ella
                datos = _fila_a_datos(objeto, fila, mapeo, formato_fecha)
                if objeto == "clientes":
                    resultado, id_entidad = await guardar_cliente(db, cx, datos, ahora)
                    vistos.add(id_entidad)
                elif objeto == "facturas":
                    resultado, id_entidad = await guardar_factura(db, cx, "excel", datos, ahora)
                    if not id_entidad:
                        cuenta["sin_cliente"] += 1
                else:
                    resultado = await guardar_cobro(db, cx, "excel", datos, ahora)
            cuenta["creados" if resultado.startswith("cread") else "actualizados"] += 1
        except ValueError as e:
            errores.append({"fila": n, "error": str(e)})
        except Exception as e:  # p.ej. un dato que no cabe en la columna
            errores.append({"fila": n, "error": f"no se pudo guardar: {str(e).splitlines()[0][:200]}"})
    bajas = 0
    if objeto == "clientes" and todos_los_clientes and vistos:
        bajas = await db.query(
            f'UPDATE "{_T_ENT}" SET baja_erp = true WHERE fecha_sync_erp IS NOT NULL AND NOT baja_erp '
            f'AND id <> ALL(%s)', (list(vistos),), conexion=cx,
        ) or 0
    return {**cuenta, "bajas": bajas, "filas": len(filas), "con_error": len(errores), "errores": errores[:MAX_ERRORES_ENSENADOS]}


async def _importacion(db: AsyncDatabase, id_importacion: int) -> dict:
    filas = await db.query(f'SELECT * FROM "{_T_IMP}" WHERE id = %s', (id_importacion,))
    if not filas:
        raise LookupError(f"No existe ninguna importación con id {id_importacion}")
    return filas[0]


async def crear_importacion(
    config: dict, objeto: str, nombre_fichero: str, contenido: bytes, quien: str, todos_los_clientes: bool = False,
) -> dict:
    """Guarda el fichero para revisarlo y devuelve lo mismo que vista_importacion."""
    _comprobar_objeto(objeto)
    _separar_cabecera(leer_tabla(contenido, nombre_fichero))  # que se pueda leer, antes de guardarlo
    db = AsyncDatabase(**config)
    await db.query(
        f'INSERT INTO "{_T_IMP}" (objeto, nombre_fichero, archivo, todos_los_clientes, estado, quien, fecha) '
        "VALUES (%s, %s, %s, %s, 'pendiente', %s, %s) RETURNING id",
        (objeto, nombre_fichero[:255], contenido, bool(todos_los_clientes and objeto == "clientes"), quien[:255], ahora_madrid()),
    )
    return await vista_importacion(config, db.ultimo_insert_id)


async def _preparar(db: AsyncDatabase, imp: dict, mapeo: dict | None, formato_fecha: str | None):
    if imp["estado"] != "pendiente":
        raise ValueError(f"Esta importación ya está {imp['estado']}")
    cabeceras, filas = _separar_cabecera(leer_tabla(bytes(imp["archivo"]), imp["nombre_fichero"]))
    guardado = await db.query(
        f'SELECT * FROM "{_T_MAP}" WHERE objeto = %s AND huella_cabeceras = %s', (imp["objeto"], huella(cabeceras)),
    )
    guardado = guardado[0] if guardado else None
    if mapeo is not None:
        mapeo = _limpiar_mapeo(imp["objeto"], mapeo, len(cabeceras))
    elif guardado:
        mapeo = {k: int(v) for k, v in json.loads(guardado["columnas"]).items()}
    else:
        mapeo = proponer_mapeo(imp["objeto"], cabeceras)
    formato_fecha = formato_fecha or (guardado["formato_fecha"] if guardado else FORMATOS_FECHA[0])
    if formato_fecha not in FORMATOS_FECHA:
        raise ValueError(f"Formato de fecha no válido: '{formato_fecha}' ({', '.join(FORMATOS_FECHA)})")
    return cabeceras, filas, mapeo, formato_fecha, guardado


async def vista_importacion(config: dict, id_importacion: int, mapeo: dict | None = None, formato_fecha: str | None = None) -> dict:
    """Las cabeceras, 10 filas de muestra, qué columna es cada campo (la
    que se pasa, la guardada para ese formato de fichero o la propuesta) y
    qué pasaría al aplicarla: se simula de verdad y se deshace."""
    db = AsyncDatabase(**config)
    imp = await _importacion(db, id_importacion)
    cabeceras, filas, mapeo, formato_fecha, guardado = await _preparar(db, imp, mapeo, formato_fecha)
    faltan = [etiqueta for campo, etiqueta, obligatorio, _ in CAMPOS[imp["objeto"]] if obligatorio and campo not in mapeo]
    if imp["objeto"] == "facturas" and not {"codigo_cliente", "nif_cliente", "nombre_cliente"} & set(mapeo):
        faltan.append("algo que diga de qué cliente es (código, NIF o nombre)")
    prevision = None
    if not faltan:
        try:
            async with db.transaccion() as cx:
                raise _Simulacion(await _procesar(
                    db, cx, imp["objeto"], filas, mapeo, formato_fecha, imp["todos_los_clientes"], ahora_madrid(),
                ))
        except _Simulacion as s:
            prevision = s.resumen
    return {
        "id": imp["id"], "objeto": imp["objeto"], "nombre_fichero": imp["nombre_fichero"], "estado": imp["estado"],
        "todos_los_clientes": imp["todos_los_clientes"], "cabeceras": cabeceras,
        "muestras": [[_serializable(c) for c in f] for f in filas[:10]], "total_filas": len(filas),
        "campos": [{"campo": c, "etiqueta": e, "obligatorio": o} for c, e, o, _ in CAMPOS[imp["objeto"]]],
        "mapeo": mapeo, "formato_fecha": formato_fecha, "formatos_fecha": FORMATOS_FECHA,
        "mapeo_guardado": bool(guardado), "faltan": faltan, "prevision": prevision,
    }


def _serializable(valor):
    if isinstance(valor, (datetime, date)):
        return valor.isoformat()[:10] if isinstance(valor, datetime) and not valor.time() else valor.isoformat()
    if isinstance(valor, Decimal):
        return float(valor)
    return valor


async def aplicar_importacion(
    config: dict, id_importacion: int, quien: str, mapeo: dict | None = None, formato_fecha: str | None = None,
) -> dict:
    """La aplica (las filas con error se saltan y se cuentan), recuerda el
    mapeo para la próxima vez y vacía el fichero guardado."""
    db = AsyncDatabase(**config)
    imp = await _importacion(db, id_importacion)
    cabeceras, filas, mapeo, formato_fecha, _ = await _preparar(db, imp, mapeo, formato_fecha)
    vista = await vista_importacion(config, id_importacion, mapeo, formato_fecha)
    if vista["faltan"]:
        raise ValueError(f"Falta decir qué columna es: {', '.join(vista['faltan'])}")
    ahora = ahora_madrid()
    async with db.transaccion() as cx:
        resumen = await _procesar(db, cx, imp["objeto"], filas, mapeo, formato_fecha, imp["todos_los_clientes"], ahora)
        await db.query(
            f'INSERT INTO "{_T_MAP}" (objeto, huella_cabeceras, cabeceras, columnas, formato_fecha, fecha) '
            "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (objeto, huella_cabeceras) DO UPDATE SET "
            "columnas = EXCLUDED.columnas, formato_fecha = EXCLUDED.formato_fecha, fecha = EXCLUDED.fecha",
            (imp["objeto"], huella(cabeceras), json.dumps(cabeceras, ensure_ascii=False), json.dumps(mapeo), formato_fecha, ahora),
            conexion=cx,
        )
        await db.query(
            f"UPDATE \"{_T_IMP}\" SET estado = 'aplicada', archivo = NULL, resumen = %s, fecha_aplicada = %s, quien = %s "
            "WHERE id = %s",
            (json.dumps(resumen, ensure_ascii=False), ahora, quien[:255], id_importacion), conexion=cx,
        )
    return {"id": id_importacion, "objeto": imp["objeto"], **resumen}


async def descartar_importacion(config: dict, id_importacion: int) -> None:
    db = AsyncDatabase(**config)
    imp = await _importacion(db, id_importacion)
    if imp["estado"] != "pendiente":
        raise ValueError(f"Esta importación ya está {imp['estado']}")
    await db.query(f"UPDATE \"{_T_IMP}\" SET estado = 'descartada', archivo = NULL WHERE id = %s", (id_importacion,))


async def listar_importaciones(config: dict, limite: int = 30) -> list[dict]:
    filas = await AsyncDatabase(**config).query(
        f'SELECT id, objeto, nombre_fichero, estado, todos_los_clientes, resumen, quien, fecha, fecha_aplicada '
        f'FROM "{_T_IMP}" ORDER BY fecha DESC LIMIT %s', (max(1, min(int(limite), 200)),),
    )
    for f in filas:
        f["resumen"] = json.loads(f["resumen"]) if f["resumen"] else None
    return filas


async def fecha_ultima_importacion(config: dict) -> datetime | None:
    filas = await AsyncDatabase(**config).query(
        f"SELECT MAX(fecha_aplicada) AS f FROM \"{_T_IMP}\" WHERE estado = 'aplicada'"
    )
    return filas[0]["f"]
