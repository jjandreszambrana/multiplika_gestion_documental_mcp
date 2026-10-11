"""Herramientas MCP para que la IA monte plantillas de asiento (asientos
predefinidos) del SIF: el contable dice con sus palabras qué asiento quiere
y la IA escribe la plantilla, la prueba en el SIF y se la enseña.

El método, los ejemplos y la ayuda del SIF entran solo cuando se piden
(`guia_plantillas_asiento_gd`), no en cada conversación. Guardar crea la
plantilla RETIRADA: la pone en uso el contable desde sus pantallas, después
de revisarla. Nada de esto cambia una plantilla que ya esté en uso.

Ver docs/contabilidad/plantillas-de-asiento-con-ia.md."""

from fastmcp.exceptions import ToolError

from apps.mcp_server.core import mcp_app

from ._anotaciones import SOLO_LECTURA
from ._herr_bloc_notas import _contexto
from ._herr_contabilidad import TAG_CONTABILIDAD, TAG_SIF, _sif
from ..database.modelos import _mod_contabilidad_sif as sif
from ..database.plantillas_asiento import EJEMPLOS, METODO

TAGS = {TAG_CONTABILIDAD, TAG_SIF}
CLAVE_AYUDA = "plantillas_de_asiento"


async def _sif_con_errores(id_empresa: int, ruta: str, cuerpo: dict) -> tuple[int, dict]:
    config, _, id_usuario, _ = await _contexto()
    try:
        return await sif.pedir_con_errores(config, id_usuario, id_empresa, ruta, cuerpo)
    except (ValueError, LookupError) as e:
        raise ToolError(str(e)) from e


def _errores(datos: dict) -> list[dict]:
    return [{"ruta": e.get("ruta"), "mensaje": e.get("mensaje"), **({"fila": e["fila"]} if e.get("fila") else {})}
            for e in datos.get("errores") or []]


def _asiento_compacto(a: dict) -> dict:
    """Lo que hace falta para enseñárselo al contable, sin lo interno."""
    return {
        "papel": a.get("papel"), "fecha": a.get("fecha"), "concepto": a.get("concepto"), "diario": a.get("diario"),
        "lineas": [
            {"cuenta": l.get("cuenta"), "debe": l.get("debe"), "haber": l.get("haber"), "concepto": l.get("concepto")}
            for l in a.get("lineas") or []
        ],
        "total_debe": a.get("total_debe"), "total_haber": a.get("total_haber"), "cuadra": a.get("cuadra"),
    }


@mcp_app.tool(annotations=SOLO_LECTURA, tags=TAGS)
async def guia_plantillas_asiento_gd(id_empresa: int) -> dict:
    """Léela ANTES de montar o cambiar una plantilla de asiento (asiento
    predefinido) del SIF. Trae el método de trabajo, la ayuda del SIF con la
    forma de la plantilla, el catálogo de funciones y dos ejemplos completos
    que funcionan (una nómina con varios empleados y una periodificación con
    reversión)."""
    ayuda = await _sif(id_empresa, "/contabilidad/ayuda/obtener", {"clave": CLAVE_AYUDA})
    catalogo = await _sif(id_empresa, "/contabilidad/plantillas/catalogo", {})
    return {
        "metodo": METODO,
        "ayuda_del_sif": ayuda.get("texto") or "",
        "catalogo": catalogo,
        "ejemplos": EJEMPLOS,
    }


@mcp_app.tool(annotations=SOLO_LECTURA, tags=TAGS)
async def plantillas_asiento_gd(id_empresa: int, id_plantilla: int | None = None) -> dict:
    """Sin `id_plantilla`: las plantillas de asiento de la empresa, también
    las retiradas. Con él: su definición vigente, para tomarla de base o
    explicar qué hace."""
    if id_plantilla is None:
        return await _sif(id_empresa, "/contabilidad/plantillas/listar", {"incluir_inactivas": True})
    return await _sif(id_empresa, "/contabilidad/plantillas/obtener", {"id": id_plantilla, "version": 0})


@mcp_app.tool(annotations=SOLO_LECTURA, tags=TAGS)
async def probar_plantilla_asiento_gd(id_empresa: int, definicion: dict, datos_ejemplo: dict | None = None) -> dict:
    """Comprueba una plantilla sin guardarla y la calcula en el SIF con datos
    de ejemplo, como si el contable la usara. `datos_ejemplo` va por clave de
    dato: números como texto con punto ("1500.00"), fechas "AAAA-MM-DD", una
    tabla como lista de filas. No escribe nada.

    Devuelve `valida` y `errores` (cada uno con su `ruta`: corrige ahí y
    vuelve a probar) y, si se pudo calcular, los `asientos` que saldrían."""
    codigo, comprobacion = await _sif_con_errores(
        id_empresa, "/contabilidad/plantillas/comprobar_definicion", {"definicion": definicion},
    )
    if codigo == 400 or not comprobacion.get("valida"):
        return {"valida": False, "errores": _errores(comprobacion), "mensaje": comprobacion.get("message")}
    codigo, calculo = await _sif_con_errores(
        id_empresa, "/contabilidad/plantillas/previsualizar", {"definicion": definicion, "parametros": datos_ejemplo or {}},
    )
    if codigo == 400:
        return {"valida": False, "errores": _errores(calculo), "mensaje": calculo.get("message")}
    return {
        "valida": True,
        "datos_correctos": bool(calculo.get("valido")),
        "errores": _errores(calculo),
        "como_se_graba": calculo.get("estado_inicial"),
        "asientos": [_asiento_compacto(a) for a in calculo.get("asientos") or []],
    }


@mcp_app.tool(tags=TAGS)
async def guardar_plantilla_asiento_gd(
    id_empresa: int, codigo: str, nombre: str, descripcion: str, definicion: dict,
) -> dict:
    """Guarda una plantilla de asiento NUEVA en el SIF, RETIRADA: no se puede
    usar hasta que el contable la revise y la ponga en uso en Contabilidad ›
    Diario › Asientos predefinidos. Solo después de probarla con
    probar_plantilla_asiento_gd y de que el contable haya dado el visto bueno
    al asiento de la prueba. `codigo`: corto, sin espacios, único en la
    empresa (p. ej. NOMINAS). No cambia ninguna plantilla existente."""
    codigo_http, creada = await _sif_con_errores(id_empresa, "/contabilidad/plantillas/crear", {
        "codigo": codigo, "nombre": nombre, "descripcion": descripcion, "definicion": definicion,
    })
    if codigo_http == 400:
        return {"guardada": False, "mensaje": creada.get("message"), "errores": _errores(creada)}
    await _sif(id_empresa, "/contabilidad/plantillas/desactivar", {"id": creada["id"]})
    return {
        "guardada": True, "id": creada["id"], "codigo": creada.get("codigo"), "retirada": True,
        "siguiente_paso": "El contable la revisa y la pone en uso en Contabilidad › Diario › Asientos predefinidos "
                          "(marca «Ver también las retiradas»).",
    }
