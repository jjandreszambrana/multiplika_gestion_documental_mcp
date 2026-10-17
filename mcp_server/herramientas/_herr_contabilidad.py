"""Herramientas MCP del asesor contable — ver docs/contabilidad/planificacion.md.

- Fase 1: la biblioteca contable (database/biblioteca_contable.py), igual
  para todos los clientes.
- Fases 3, 3 bis y 4: la contabilidad del SIF, con los accesos propios del
  usuario que llama y solo en las empresas que esos accesos ven
  (database/modelos/_mod_contabilidad_sif.py), los ratios calculados en
  código y las propuestas para el contable. Nada de esto escribe en el SIF.

Solo existen para la IA en las GD con el apartado activado
(`gd_configuracion.modulo_contable`), y las del SIF además solo si quien
llama tiene algún acceso suyo al SIF: `ModuloContableMiddleware` oculta y rechaza
las demás, para que sus definiciones no ocupen contexto donde no sirven."""

from collections import defaultdict
from decimal import Decimal
from typing import Literal

from apps.mcp_server.core import mcp_app
from apps.mcp_server.core.dependencias.auth import clave_actual_es_solo_lectura
from fastmcp.exceptions import ToolError
from fastmcp.server.middleware.middleware import Middleware

from ._anotaciones import SOLO_LECTURA
from ._herr_bloc_notas import _contexto
from ..database import biblioteca_contable
from ..database.modelos import _mod_contabilidad_sif as sif
from ..database.modelos._mod_conta_analisis import analisis_financiero, compactar_informe
from ..database.modelos._mod_conta_propuestas import crear as crear_propuesta, listar as listar_propuestas
from ..database.modelos._mod_configuracion import ConfiguracionCRUD

TAG_CONTABILIDAD = "contabilidad"
TAG_SIF = "contabilidad_sif"
LIMITE_APUNTES_IA = 50  # el SIF admite 1000 por página; con 50 basta casi siempre y cuesta mucho menos
Informe = Literal[
    "balance", "perdidas_y_ganancias", "sumas_y_saldos", "mayor", "diario",
    "iva", "retenciones", "cuadre_iva", "libros_iva",
]
RUTA_INFORME = {
    "balance": "/contabilidad/informes/balance", "perdidas_y_ganancias": "/contabilidad/informes/perdidas_y_ganancias",
    "sumas_y_saldos": "/contabilidad/informes/sumas_y_saldos", "mayor": "/contabilidad/informes/mayor",
    "diario": "/contabilidad/informes/diario", "iva": "/contabilidad/fiscal/iva",
    "retenciones": "/contabilidad/fiscal/retenciones", "cuadre_iva": "/contabilidad/fiscal/cuadre_iva",
    "libros_iva": "/contabilidad/fiscal/libros_iva",
}
INFORMES_FISCALES = ("iva", "retenciones", "cuadre_iva", "libros_iva")


async def _estado_modulo() -> tuple[bool, bool]:
    """(apartado activado, quien llama tiene algún acceso suyo al SIF)."""
    config, _, id_usuario, _ = await _contexto()
    activo = await ConfiguracionCRUD(config).obtener_modulo_contable()
    return activo, activo and bool(await sif.accesos_de(config, id_usuario))


def _oculta(tool, activo: bool, conectado: bool) -> bool:
    etiquetas = tool.tags or ()
    return (TAG_CONTABILIDAD in etiquetas and not activo) or (TAG_SIF in etiquetas and not conectado)


class ModuloContableMiddleware(Middleware):
    def __init__(self, instancia):
        self._instancia = instancia

    async def on_list_tools(self, context, call_next):
        herramientas = await call_next(context)
        if not any(t.tags and ({TAG_CONTABILIDAD, TAG_SIF} & set(t.tags)) for t in herramientas):
            return herramientas
        activo, conectado = await _estado_modulo()
        return [t for t in herramientas if not _oculta(t, activo, conectado)]

    async def on_call_tool(self, context, call_next):
        tool = await self._instancia.get_tool(context.message.name)
        if tool.tags and {TAG_CONTABILIDAD, TAG_SIF} & set(tool.tags):
            activo, conectado = await _estado_modulo()
            if _oculta(tool, activo, conectado):
                raise ToolError("El asesor contable no está activado, o no está conectado con el SIF, en esta gestión documental.")
        return await call_next(context)


async def _sif(id_empresa: int, ruta: str, cuerpo: dict) -> dict:
    config, _, id_usuario, _ = await _contexto()
    try:
        return await sif.pedir(config, id_usuario, id_empresa, ruta, {k: v for k, v in cuerpo.items() if v is not None})
    except (ValueError, LookupError) as e:
        raise ToolError(str(e)) from e


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def buscar_temas_contables_gd(texto: str) -> list[dict]:
    """Busca en la biblioteca contable y fiscal de la GD (temas propios con
    ejemplos, basados en el PGC, la normativa del BOE y la doctrina oficial).
    Úsala ANTES de responder cualquier duda contable, fiscal o financiera:
    pon 1-3 palabras clave ("leasing", "prorrata IVA", "cuenta 555") y abre
    el tema que encaje con obtener_tema_contable_gd. Si no sale nada, prueba
    indice_contable_gd. Si la biblioteca no cubre la duda, dilo, responde
    avisando de que no está contrastado y anótala con
    anotar_pregunta_pendiente_gd para que se cubra."""
    return biblioteca_contable.buscar(texto)


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def indice_contable_gd(id_nodo: int | None = None) -> dict:
    """Índice de la biblioteca contable, nivel a nivel: sin `id_nodo`, las
    áreas; con el id de un área, bloque o capítulo, sus hijos (cada uno con
    título y resumen de una línea). Para ir directa a un tema es más rápido
    buscar_temas_contables_gd."""
    resultado = biblioteca_contable.indice(id_nodo)
    if resultado is None:
        raise ToolError(f"No hay ningún área, bloque ni capítulo con id {id_nodo}.")
    return resultado


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def obtener_tema_contable_gd(id_tema: int, seccion: str | None = None) -> dict:
    """Un tema de la biblioteca contable, por partes para no cargar de más:
    sin `seccion` llega su resumen ("En pocas palabras"), sus avisos, fuentes
    y la lista de secciones; si con eso no basta, pide la que necesites
    (p. ej. "Cómo se contabiliza", "Fiscalidad", "Errores frecuentes") o
    "todo" para el tema entero. Al responder con él:
    cita el tema y sus fuentes; di siempre lo que traiga en `avisos` (no
    revisado, posible desactualización, norma cambiada); da las cifras que
    cambian cada año (tipos, límites, plazos) con el año del tema; y si
    propones un asiento o una actuación, preséntalo como propuesta para que
    la valide el contable, nunca como hecho. Si una regla del cliente
    contradice el tema o la norma, adviértelo en vez de aplicarla en
    silencio. Para la letra exacta de una fuente, obtener_norma_contable_gd."""
    resultado = biblioteca_contable.tema_por_partes(id_tema, seccion)
    if resultado is None:
        raise ToolError(f"No hay ningún tema con id {id_tema}.")
    return resultado


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def obtener_norma_contable_gd(id_fuente: str, fecha: str | None = None) -> dict:
    """Texto literal de un artículo del BOE (id como "BOE-A-1992-28740/a95")
    o resumen de una consulta de la DGT, tal como los cita un tema en
    `fuentes`. Ábrela solo cuando haga falta la letra exacta. Con `fecha`
    (AAAA-MM-DD) devuelve la versión vigente ese día, útil para ejercicios
    pasados. Al citarla: "Fuente: Agencia Estatal Boletín Oficial del
    Estado", con su fecha de versión."""
    resultado = biblioteca_contable.fuente(id_fuente, fecha)
    if resultado is None:
        detalle = f" vigente el {fecha}" if fecha else ""
        raise ToolError(f"No se conserva la fuente {id_fuente}{detalle}.")
    return resultado


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def empresas_contables_gd() -> list[dict]:
    """Empresas cuya contabilidad del SIF puede ver quien te habla, con sus
    propios accesos al SIF (id_empresa, nombre, NIF, de qué SIF y su nivel:
    consulta, apuntes, cierre o admin). Úsala para saber qué `id_empresa`
    pasar al resto de herramientas de contabilidad; si solo hay una, es esa."""
    config, _, id_usuario, _ = await _contexto()
    try:
        return await sif.empresas_de(config, id_usuario)
    except (ValueError, LookupError) as e:
        raise ToolError(str(e)) from e


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def informe_contable_gd(
    id_empresa: int, informe: Informe, ejercicio: int,
    desde: str | None = None, hasta: str | None = None, cuenta: str | None = None,
    nivel: int | None = None, periodo: str | None = None, libro: Literal["expedidas", "recibidas"] | None = None,
    offset: int = 0, detalle: Literal["epigrafes", "cuentas", "subcuentas"] | None = None,
) -> dict:
    """Un informe de la contabilidad real de una empresa en el SIF (solo
    lectura, sin borradores):
    - balance / perdidas_y_ganancias: con `hasta` opcional y `detalle`.
    - sumas_y_saldos: `nivel` 1 grupos, 2 subgrupos, 3 cuentas, 0 cuenta a
      cuenta; `desde`/`hasta` acotan el periodo.
    - mayor (necesita `cuenta`) y diario: paginan de 50 en 50 con
      `offset`; los totales son los del periodo entero. Acota con fechas y
      cuenta antes de pedir páginas de más.
    - iva (base del 303), retenciones (111 y 115), cuadre_iva (facturas
      frente a lo contabilizado), libros_iva (con `libro`): necesitan
      `periodo` ("01".."12" o "1T".."4T").
    Fechas AAAA-MM-DD. Las cifras son del SIF: cítalas tal cual. Las
    listas llegan como tabla (`columnas` una vez y `filas`), sin las cuentas
    a cero."""
    if informe in INFORMES_FISCALES:
        if not periodo:
            raise ToolError("Este informe necesita `periodo` (\"01\"..\"12\" o \"1T\"..\"4T\")")
        cuerpo = {"ejercicio": ejercicio, "periodo": periodo}
        if informe == "libros_iva":
            cuerpo |= {"libro": libro or "expedidas", "limite": LIMITE_APUNTES_IA, "desplazamiento": offset}
    else:
        cuerpo = {"ejercicio": ejercicio, "hasta": hasta}
        if informe in ("balance", "perdidas_y_ganancias"):
            cuerpo["detalle"] = detalle
        else:
            cuerpo["desde"] = desde
        if informe == "sumas_y_saldos":
            cuerpo["nivel"] = nivel
        if informe in ("mayor", "diario"):
            if informe == "mayor" and not cuenta:
                raise ToolError("El mayor necesita `cuenta`")
            cuerpo |= {"cuenta": cuenta if informe == "mayor" else None, "offset": offset, "limit": LIMITE_APUNTES_IA}
    return compactar_informe(informe, await _sif(id_empresa, RUTA_INFORME[informe], cuerpo))


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def buscar_cuenta_contable_gd(id_empresa: int, texto: str, ejercicio: int | None = None) -> dict:
    """Busca en el plan de cuentas de la empresa por código (que empiece por
    lo escrito, p. ej. "430") o por título ("teléfono"). Úsala antes de
    proponer un asiento para usar las cuentas y subcuentas que ya tiene la
    empresa."""
    return await _sif(id_empresa, "/contabilidad/plan/listar", {"ejercicio": ejercicio, "texto": texto, "limit": LIMITE_APUNTES_IA})


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def diario_b_gd(
    id_empresa: int, ejercicio: int | None = None, asiento: int | None = None, cuenta: str | None = None,
    desde: str | None = None, hasta: str | None = None, contabilizado: Literal[0, 1] | None = None,
    offset: int = 0,
) -> dict:
    """Líneas del diario B de la empresa en el SIF (solo lo tienen algunos
    SIF; si no existe, dilo y no insistas). Filtra por ejercicio, asiento,
    cuenta (que empiece por lo escrito) y fechas AAAA-MM-DD; `contabilizado`
    1 = del libro, 0 = borradores. Pagina de 50 en 50 con `offset` y trae
    `total`. Solo lectura."""
    return await _sif(id_empresa, "/contabilidad/diario_b/listar", {
        "ejercicio": ejercicio, "asiento": asiento, "cuenta": cuenta, "fecha_desde": desde,
        "fecha_hasta": hasta, "contabilizado": contabilizado, "offset": offset, "limit": LIMITE_APUNTES_IA,
    })


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def equivalencias_cuentas_gd(id_empresa: int, texto: str | None = None, offset: int = 0) -> dict:
    """Equivalencias de cuentas de la empresa en el SIF (cuenta de origen →
    cuenta de destino, con sus títulos y observaciones), las que acompañan al
    diario B. `texto` busca por cuenta o título. Pagina de 50 en 50 con
    `offset` y trae `total`. Solo lectura; si el SIF no las tiene, dilo."""
    return await _sif(id_empresa, f"{RUTA_EQUIVALENCIAS}/listar", {"texto": texto, "offset": offset, "limit": LIMITE_APUNTES_IA})


async def _todas(id_empresa: int, ruta: str, cuerpo: dict, clave: str) -> list[dict]:
    """Todas las filas de un listado del SIF, de 1.000 en 1.000 (su máximo)."""
    filas: list[dict] = []
    while True:
        pagina = await _sif(id_empresa, ruta, {**cuerpo, "offset": len(filas), "limit": 1000})
        filas += pagina[clave]
        if not pagina[clave] or len(filas) >= pagina["total"]:
            return filas


# Marcas del campo `diario` de las líneas del diario B (el SIF admite 30 letras desde 2026-10-17)
DIARIO_APERTURA, DIARIOS_FIN_DE_EJERCICIO = "APERTURA", {"REGULARIZA", "CIERRE"}


# Por cómo empieza la marca: REGULARI, REGULARIZA y REGULARIZACION valen igual.
MARCAS_DIARIO_B = {"APERTURA": "APERTURA", "REGULARI": "REGULARIZA", "CIERRE": "CIERRE"}


def marca_diario_b(diario: str | None) -> str:
    """APERTURA, REGULARIZA o CIERRE si el campo `diario` lo dice; si no, ""."""
    texto = "".join((diario or "").split()).upper()
    return next((marca for inicio, marca in MARCAS_DIARIO_B.items() if texto.startswith(inicio)), "")


def clasificar_asientos(lineas: list[dict], largo: int) -> dict[int, str]:
    """Qué asiento es la apertura, la regularización y el cierre, por lo que
    hacen (no hay otra marca fiable): sirve para cualquier empresa. Si una
    línea trae una de estas marcas en `diario`, manda la marca."""
    por_asiento: dict[int, list[dict]] = defaultdict(list)
    for linea in lineas:
        por_asiento[linea["asiento"]].append(linea)
    marcas: dict[int, str] = {}
    for asiento, ls in por_asiento.items():
        for linea in ls:
            marca = marca_diario_b(linea.get("diario"))
            if marca:
                marcas[asiento] = marca
                break
    if not por_asiento:
        return marcas
    numeros = sorted(por_asiento)
    cuenta = lambda l: l["cuenta"].strip().ljust(largo, "0")
    fecha = lambda l: str(l.get("fecha") or "")[:10]
    # Apertura: el primer asiento, del primer día, solo con cuentas de balance.
    if "APERTURA" not in marcas.values():
        primero = por_asiento[numeros[0]]
        primer_dia = min((fecha(l) for l in lineas if fecha(l)), default="")
        if (all(fecha(l) == primer_dia for l in primero) and all(cuenta(l)[:1] in "12345" for l in primero)
                and any(cuenta(l)[:1] == "1" for l in primero)):
            marcas.setdefault(numeros[0], "APERTURA")
    # Regularización: solo gastos e ingresos (6 y 7) contra la 129.
    if "REGULARIZA" not in marcas.values():
        for asiento in numeros:
            ls = por_asiento[asiento]
            if (asiento not in marcas and all(cuenta(l)[:1] in "67" or cuenta(l).startswith("129") for l in ls)
                    and any(cuenta(l).startswith("129") for l in ls) and any(cuenta(l)[:1] in "67" for l in ls)):
                marcas[asiento] = "REGULARIZA"
    # Cierre: el último asiento, del último día, si deja a cero casi todas
    # (90 %) las cuentas que toca: un cierre mal cuadrado con su apertura
    # deja alguna colgando y sigue siendo el cierre.
    ultimo_dia = max((fecha(l) for l in lineas if fecha(l)), default="")
    if ("CIERRE" not in marcas.values() and numeros[-1] not in marcas
            and all(fecha(l) == ultimo_dia for l in por_asiento[numeros[-1]])):
        saldo: dict[str, Decimal] = defaultdict(Decimal)
        for linea in lineas:
            saldo[cuenta(linea)] += Decimal(str(linea["debe"] or 0)) - Decimal(str(linea["haber"] or 0))
        tocadas = {cuenta(l) for l in por_asiento[numeros[-1]]}
        a_cero = sum(1 for c in tocadas if abs(saldo[c]) < Decimal("0.005"))
        if len(tocadas) > 2 and a_cero >= len(tocadas) * Decimal("0.9"):
            marcas[numeros[-1]] = "CIERRE"
    return marcas


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def diario_b_sumas_y_saldos_gd(
    id_empresa: int, ejercicio: int, desde: str | None = None, hasta: str | None = None,
    contabilizado: Literal[0, 1] | None = None, aplicar_equivalencias: bool = False,
    nivel: Literal[0, 1, 2, 3] = 0, sin_regularizacion_ni_cierre: bool = False,
    solo_sin_equivalencia: bool = False,
) -> dict:
    """Sumas y saldos del diario B por cuenta, calculadas por el programa
    sumando sus líneas (el SIF no lo da hecho). Por cuenta: saldo inicial
    (con signo, debe − haber: el asiento de apertura más lo anterior a
    `desde`), debe y haber del periodo (`desde`..`hasta`, sin la apertura),
    debe y haber acumulados (inicial + periodo) y saldo deudor/acreedor.
    Fechas AAAA-MM-DD; `contabilizado` 1 = del libro, 0 = borradores.
    La apertura, la regularización y el cierre los reconoce el programa por
    lo que hacen (o por la marca APERTURA/REGULARIZA/CIERRE en `diario`, que
    manda); `sin_regularizacion_ni_cierre` descarta esos dos.
    `solo_sin_equivalencia` deja solo las cuentas que no son cuenta de
    origen de ninguna equivalencia (las que faltan por emparejar). Con `aplicar_equivalencias`, lo de cada cuenta de
    origen se suma en su cuenta de destino. `nivel` 0 subcuenta a
    subcuenta, 3 cuentas, 2 subgrupos, 1 grupos (después de las
    equivalencias; los títulos solo salen en subcuentas). Llega como tabla
    (`columnas` y `filas`) con `totales`; cita las cifras tal cual."""
    lineas = await _todas(id_empresa, "/contabilidad/diario_b/listar", {
        "ejercicio": ejercicio, "fecha_hasta": hasta, "contabilizado": contabilizado,
    }, "lineas")
    destino: dict[str, tuple[str, str | None]] = {}
    if aplicar_equivalencias or solo_sin_equivalencia:
        for e in await _todas(id_empresa, f"{RUTA_EQUIVALENCIAS}/listar", {}, "equivalencias"):
            destino[e["cuenta_origen"]] = (e["cuenta_destino"], e.get("titulo_destino"))
    # Por subcuenta, las cuentas cortas (la apertura y el cierre vienen en 4
    # cifras, p. ej. 1130) se completan con ceros: 1130 → 11300000.
    largo = max((len(l["cuenta"].strip()) for l in lineas), default=0)
    clase = clasificar_asientos(lineas, largo)
    cuentas: dict[str, list] = {}  # cuenta → [título, debe inicial, haber inicial, debe periodo, haber periodo]
    sumadas = 0
    for linea in lineas:
        marca = clase.get(linea["asiento"], "")
        if sin_regularizacion_ni_cierre and marca in DIARIOS_FIN_DE_EJERCICIO:
            continue
        fecha = str(linea.get("fecha") or "")[:10]
        if not fecha and (desde or hasta) and marca != DIARIO_APERTURA:
            continue  # sin fecha no se sabe si va antes o después: como en la pantalla
        original = linea["cuenta"].strip()
        equivalencia = destino.get(original) or destino.get(original.ljust(largo, "0"))
        if solo_sin_equivalencia and equivalencia:
            continue
        sumadas += 1
        cuenta, titulo = (equivalencia if aplicar_equivalencias else None) or (original, None)
        cuenta = cuenta.ljust(largo, "0")
        if nivel:
            cuenta, titulo = cuenta[:nivel], None
        fila = cuentas.setdefault(cuenta, [titulo, Decimal(0), Decimal(0), Decimal(0), Decimal(0)])
        inicial = marca == DIARIO_APERTURA or bool(desde and fecha < desde)
        fila[1 if inicial else 3] += Decimal(str(linea["debe"] or 0))
        fila[2 if inicial else 4] += Decimal(str(linea["haber"] or 0))
    filas, totales = [], [Decimal(0)] * 7
    for cuenta, (titulo, di, hi, dp, hp) in sorted(cuentas.items()):
        if not (di or hi or dp or hp):
            continue
        da, ha = di + dp, hi + hp
        valores = [di - hi, dp, hp, da, ha, max(da - ha, 0), max(ha - da, 0)]
        totales = [t + v for t, v in zip(totales, valores)]
        filas.append([cuenta, titulo, *map(float, valores)])
    columnas = ["saldo_inicial", "debe_periodo", "haber_periodo", "debe_acumulado", "haber_acumulado", "saldo_deudor", "saldo_acreedor"]
    return {
        "lineas_sumadas": sumadas, "equivalencias_aplicadas": aplicar_equivalencias, "nivel": nivel,
        "sin_regularizacion_ni_cierre": sin_regularizacion_ni_cierre, "solo_sin_equivalencia": solo_sin_equivalencia,
        "columnas": ["cuenta", "titulo", *columnas], "filas": filas,
        "totales": dict(zip(columnas, map(float, totales))),
    }


# Las equivalencias son ajustes de cuentas, no asientos: la IA las escribe
# directamente en el SIF, sin pasar por Propuestas (decisión del usuario, 2026-10-17).
RUTA_EQUIVALENCIAS = "/contabilidad/diario_equivalencias"


@mcp_app.tool(tags={TAG_CONTABILIDAD, TAG_SIF})
async def crear_equivalencia_cuenta_gd(
    id_empresa: int, cuenta_origen: str, cuenta_destino: str,
    titulo_origen: str | None = None, titulo_destino: str | None = None, observaciones: str | None = None,
) -> dict:
    """Crea en el SIF una equivalencia de cuentas de la empresa (cuenta de
    origen → cuenta de destino). Se guarda al momento, sin propuesta.
    Mira antes con `equivalencias_cuentas_gd` que no exista ya, y con
    `buscar_cuenta_contable_gd` que la cuenta de destino existe."""
    return await _sif(id_empresa, f"{RUTA_EQUIVALENCIAS}/crear", {
        "cuenta_origen": cuenta_origen, "cuenta_destino": cuenta_destino, "titulo_origen": titulo_origen,
        "titulo_destino": titulo_destino, "observaciones": observaciones,
    })


@mcp_app.tool(tags={TAG_CONTABILIDAD, TAG_SIF})
async def corregir_equivalencia_cuenta_gd(
    id_empresa: int, id: int, cuenta_origen: str | None = None, cuenta_destino: str | None = None,
    titulo_origen: str | None = None, titulo_destino: str | None = None, observaciones: str | None = None,
) -> dict:
    """Cambia una equivalencia de cuentas ya guardada (`id` de
    `equivalencias_cuentas_gd`). Pasa solo los campos que cambian."""
    return await _sif(id_empresa, f"{RUTA_EQUIVALENCIAS}/editar", {
        "id": id, "cuenta_origen": cuenta_origen, "cuenta_destino": cuenta_destino, "titulo_origen": titulo_origen,
        "titulo_destino": titulo_destino, "observaciones": observaciones,
    })


@mcp_app.tool(tags={TAG_CONTABILIDAD, TAG_SIF})
async def eliminar_equivalencia_cuenta_gd(id_empresa: int, id: int) -> dict:
    """Borra una equivalencia de cuentas (`id` de `equivalencias_cuentas_gd`).
    No se puede deshacer: confírmalo antes con el usuario."""
    await _sif(id_empresa, f"{RUTA_EQUIVALENCIAS}/eliminar", {"id": id})
    return {"eliminada": id}


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def analisis_financiero_gd(id_empresa: int, ejercicio: int, hasta: str | None = None) -> dict:
    """Ratios de liquidez, solvencia, rentabilidad y plazos de cobro y pago
    de una empresa, calculados por el programa con su balance y su cuenta de
    pérdidas y ganancias del SIF (cada ratio trae su fórmula). No los
    recalcules: interprétalos, con el tema de ratios de la biblioteca."""
    balance = await _sif(id_empresa, RUTA_INFORME["balance"], {"ejercicio": ejercicio, "hasta": hasta})
    pyg = await _sif(id_empresa, RUTA_INFORME["perdidas_y_ganancias"], {"ejercicio": ejercicio, "hasta": hasta})
    return analisis_financiero(balance, pyg)


def _sin_invitado() -> None:
    if clave_actual_es_solo_lectura():
        raise ToolError("Esta clave es de solo lectura: no puede dejar propuestas.")


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def proponer_contable_gd(
    id_empresa: int, tipo: Literal["asiento", "reclasificacion", "aviso"], titulo: str, justificacion: str,
    asiento: dict | None = None, id_tema: int | None = None, id_documento: int | None = None,
) -> dict:
    """Deja una propuesta para que la revise el contable en "Asesor
    contable → Propuestas". No escribe nada en el SIF: el contable la acepta
    y la pasa él.
    - asiento / reclasificacion: `asiento` = {"fecha": "AAAA-MM-DD",
      "concepto": "...", "apuntes": [{"cuenta": "629", "concepto": "...",
      "debe": 100.0, "haber": 0}, ...]}. Tiene que cuadrar; usa cuentas del
      plan de la empresa (buscar_cuenta_contable_gd).
    - aviso: algo que revisar, sin asiento.
    Cita en `justificacion` la norma o el tema (`id_tema`) en que te apoyas,
    y `id_documento` si sale de un documento de la GD (p. ej. una factura).
    Dile al usuario que es una propuesta, no un apunte hecho."""
    _sin_invitado()
    config, _, id_usuario, nombre = await _contexto()
    try:
        if id_empresa not in {e["id_empresa"] for e in await sif.empresas_de(config, id_usuario)}:
            raise LookupError("No tienes acceso a esa empresa desde esta GD")
        return await crear_propuesta(config, id_empresa, tipo, titulo, justificacion, asiento, id_tema, id_documento, creado_por=nombre)
    except (ValueError, LookupError) as e:
        raise ToolError(str(e)) from e


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def listar_propuestas_contables_gd(
    id_empresa: int | None = None, estado: Literal["pendiente", "aceptada", "descartada"] | None = "pendiente",
) -> list[dict]:
    """Propuestas para el contable (las de la IA y los avisos de la revisión
    automática), de una empresa o de todas las que puede ver el usuario."""
    config, _, id_usuario, _ = await _contexto()
    try:
        ids = [e["id_empresa"] for e in await sif.empresas_de(config, id_usuario)]
    except (ValueError, LookupError) as e:
        raise ToolError(str(e)) from e
    return await listar_propuestas(config, ids, estado, id_empresa)


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def catalogo_memoria_gd(modelo: Literal["normal", "abreviado", "pymes"]) -> list[dict]:
    """Apartados de la memoria anual de un modelo (normal, abreviado o pymes;
    las microempresas usan pymes): número, título, si es obligatorio, qué
    cuadros del SIF usa y qué datos pide cada uno y de dónde salen
    (contabilidad, gd o manual). El modelo de la empresa lo dan los límites
    del tema de la biblioteca sobre qué modelo de cuentas presentar."""
    return biblioteca_contable.catalogo_memoria(modelo)


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD})
async def obtener_apartado_memoria_gd(id_apartado: int) -> dict:
    """Un apartado del catálogo de la memoria con su guía de redacción: qué
    contar, en qué orden, cuándo decir que no aplica. Léela antes de
    redactar ese apartado."""
    apartado = biblioteca_contable.apartado_memoria(id_apartado)
    if not apartado:
        raise ToolError(f"No hay ningún apartado de la memoria con id {id_apartado}.")
    return apartado


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def memoria_contable_gd(id_empresa: int, ejercicio: int) -> dict:
    """La memoria de una empresa y ejercicio guardada en el SIF: modelo,
    versión, estado y cada apartado con su texto, estado y datos
    pendientes. Si no existe todavía, dilo: se crea desde el panel."""
    listado = await _sif(id_empresa, "/contabilidad/memoria/listar", {"ejercicio": ejercicio})
    memorias = listado.get("memorias") or listado.get("registros") or []
    if not memorias:
        return {"memoria": None, "aviso": "Esta empresa no tiene memoria de ese ejercicio en el SIF."}
    ultima = max(memorias, key=lambda m: m.get("version") or 0)
    return await _sif(id_empresa, "/contabilidad/memoria/obtener", {"id_memoria": ultima["id"]})


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def datos_memoria_gd(id_empresa: int, ejercicio: int, cuadro: str | None = None) -> dict:
    """Un cuadro numérico de la memoria calculado por el SIF desde la
    contabilidad (p. ej. inmovilizado_material, deudas_plazo,
    desglose_balance), con el año anterior y las cuentas de origen de cada
    fila. Sin `cuadro`, la lista de cuadros disponibles. Las cifras de la
    memoria salen de aquí, nunca calculadas por ti."""
    return await _sif(id_empresa, "/contabilidad/memoria/datos_contables", {"ejercicio": ejercicio, "cuadro": cuadro})


@mcp_app.tool(annotations=SOLO_LECTURA, tags={TAG_CONTABILIDAD, TAG_SIF})
async def proponer_apartado_memoria_gd(
    id_empresa: int, ejercicio: int, id_apartado: int, texto: str,
    datos: list[dict] | None = None, pendientes: list[dict] | None = None,
) -> dict:
    """Deja el borrador de un apartado de la memoria como propuesta para el
    contable (no lo guarda en el SIF: lo guarda él al aceptarlo).
    - `texto`: Markdown, siguiendo la guía del apartado
      (obtener_apartado_memoria_gd) y con las cifras de datos_memoria_gd.
    - `datos`: lo usado, cada uno {"clave", "valor", "origen":
      "contabilidad"|"gd"|"manual", "referencia"} (cuenta, id de documento de
      la GD o quién lo dijo).
    - `pendientes`: lo que falta y solo puede aportar la empresa, cada uno
      {"clave", "descripcion", "formato"}; el panel se lo pide al contable.
    Antes busca en los documentos de la GD (consultar_documentos_gd) los
    datos de tipo gd."""
    _sin_invitado()
    apartado = biblioteca_contable.apartado_memoria(id_apartado)
    if not apartado:
        raise ToolError(f"No hay ningún apartado de la memoria con id {id_apartado}.")
    config, _, id_usuario, nombre = await _contexto()
    detalle = {
        "ejercicio": ejercicio, "modelo": apartado["modelo"], "id_apartado": id_apartado,
        "codigo_apartado": str(id_apartado), "titulo": apartado["titulo"], "texto": texto,
        "datos": datos or [], "pendientes": pendientes or [],
    }
    try:
        if id_empresa not in {e["id_empresa"] for e in await sif.empresas_de(config, id_usuario)}:
            raise LookupError("No tienes acceso a esa empresa desde esta GD")
        return await crear_propuesta(
            config, id_empresa, "memoria", f"Memoria {ejercicio}: {apartado['titulo']}",
            "Borrador de la IA para revisar", detalle, creado_por=nombre,
        )
    except (ValueError, LookupError) as e:
        raise ToolError(str(e)) from e


mcp_app.add_middleware(ModuloContableMiddleware(mcp_app))
