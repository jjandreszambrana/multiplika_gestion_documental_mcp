"""Que un asiento propuesto, su borrador en el diario del SIF y el movimiento
bancario del que viene digan siempre lo mismo, se deshaga donde se deshaga.

- Aceptar un asiento deja un borrador en el SIF y lo apunta en la propuesta
  (`detalle.borrador` = id, ejercicio, asiento).
- Si el borrador se tira en el SIF, la propuesta vuelve a pendiente
  (`sincronizar`, que se mira al abrir propuestas o movimientos).
- Si se deshace aquí (la propuesta o el movimiento), el borrador se tira en el
  SIF. Uno ya confirmado en el diario no se toca: es un asiento de verdad.
- Si se descarta la propuesta, el movimiento vuelve a «asiento propuesto»."""

import json

from mtpk_postgres.async_adapter import AsyncDatabase

from ..dependencias._dep_conciliacion import (
    NOMBRE_TABLA_CONCILIACION_MOVIMIENTOS as _TM, NOMBRE_TABLA_CONCILIACIONES as _TE, NOMBRE_TABLA_CUENTAS_BANCARIAS as _TC,
)
from ..dependencias._dep_contabilidad import NOMBRE_TABLA_CONTA_PROPUESTAS as _TP
from . import _mod_conta_propuestas as propuestas, _mod_contabilidad_sif as sif

RUTA = "/contabilidad/asientos/borrador/"
RUTA_BANDEJA = "/contabilidad/bandeja/"


async def _movimiento_de(config: dict, propuesta: dict) -> dict | None:
    """El movimiento del extracto del que viene la propuesta (su `documento` es BANCO-<id>)."""
    documento = str((propuesta.get("detalle") or {}).get("documento") or "")
    if not documento.startswith("BANCO-") or not documento[6:].isdigit():
        return None
    filas = await AsyncDatabase(**config).query(
        f'SELECT m.*, c.subcuenta FROM "{_TM}" m JOIN "{_TE}" e ON e.id = m.id_conciliacion '
        f'JOIN "{_TC}" c ON c.id_empresa = e.id_empresa AND c.banco = e.banco AND c.oficina = e.oficina AND c.cuenta = e.cuenta '
        "WHERE m.id = %s", (int(documento[6:]),),
    )
    return filas[0] if filas else None


async def anotar_conciliado(config: dict, id_usuario: int | None, propuesta: dict) -> None:
    """Deja en la bandeja del SIF la nota de que este movimiento del banco ya está
    asentado, para que ninguna importación lo repita. Si el SIF no lo admite
    todavía, no pasa nada: el asiento ya está en el Diario."""
    movimiento = await _movimiento_de(config, propuesta)
    borrador = (propuesta.get("detalle") or {}).get("borrador") or {}
    if not movimiento or not movimiento.get("subcuenta"):
        return
    try:
        await sif.pedir(config, id_usuario, propuesta["id_empresa"], RUTA_BANDEJA + "anotar_conciliados", {"movimientos": [{
            "referencia": propuesta["detalle"]["documento"], "cuenta_tesoreria": movimiento["subcuenta"],
            "fecha": str(movimiento["fecha_valor"]), "importe": float(movimiento["importe"]), "concepto": (movimiento.get("concepto") or "")[:200] or None,
            "id_borrador": borrador.get("id"), "asiento": borrador.get("asiento"),
        }]})
    except (ValueError, LookupError):
        pass


async def quitar_conciliado(config: dict, id_usuario: int | None, propuesta: dict) -> None:
    """Quita esa nota (se ha tirado el borrador o deshecho el asiento)."""
    referencia = (propuesta.get("detalle") or {}).get("documento")
    if not referencia:
        return
    try:
        await sif.pedir(config, id_usuario, propuesta["id_empresa"], RUTA_BANDEJA + "quitar_conciliados", {"referencias": [referencia]})
    except (ValueError, LookupError):
        pass


async def estado(config: dict, id_usuario: int | None, id_empresa: int, borrador: dict) -> str:
    """`existe`, `confirmado` (ya está en el libro), `tirado` o `desconocido`."""
    codigo, _ = await sif.pedir_con_errores(config, id_usuario, id_empresa, RUTA + "obtener", {"id": borrador["id"]})
    if codigo < 300:
        return "existe"
    _, historia = await sif.pedir_con_errores(config, id_usuario, id_empresa, RUTA + "historico", {"id_borrador": borrador["id"], "limit": 1})
    versiones = historia.get("versiones") or []
    accion = versiones[0].get("accion") if versiones else None
    return accion if accion in ("confirmado", "tirado") else "desconocido"


async def _tirar(config: dict, id_usuario: int | None, propuesta: dict) -> None:
    borrador = (propuesta.get("detalle") or {}).get("borrador")
    if not borrador:
        return
    situacion = await estado(config, id_usuario, propuesta["id_empresa"], borrador)
    if situacion == "confirmado":
        raise ValueError("Ese asiento ya está confirmado en el Diario: para quitarlo, anúlalo allí")
    if situacion == "existe":
        await sif.pedir(config, id_usuario, propuesta["id_empresa"], RUTA + "eliminar", {"id": borrador["id"]})


async def quitar_del_diario(config: dict, id_usuario: int | None, id_propuesta: int) -> dict:
    """Tira el borrador y deja la propuesta otra vez pendiente."""
    propuesta = await propuestas.obtener(config, id_propuesta)
    if not propuesta or propuesta["estado"] != "aceptada" or not (propuesta.get("detalle") or {}).get("borrador"):
        raise LookupError("Esa propuesta no tiene un asiento en el Diario")
    await _tirar(config, id_usuario, propuesta)
    await quitar_conciliado(config, id_usuario, propuesta)
    return await propuestas.reabrir(config, id_propuesta)


async def deshacer_desde_movimiento(config: dict, id_usuario: int | None, id_propuesta: int) -> None:
    """Se deshace el movimiento: se tira el borrador si lo hay y la propuesta se descarta."""
    propuesta = await propuestas.obtener(config, id_propuesta)
    if not propuesta or propuesta["estado"] == "descartada":
        return
    if propuesta["estado"] == "aceptada":
        borrador = (propuesta.get("detalle") or {}).get("borrador")
        if borrador and await estado(config, id_usuario, propuesta["id_empresa"], borrador) in ("existe", "confirmado"):
            # Desde Conciliación no se toca lo que ya está en el Diario: se quita desde Propuestas o desde el propio Diario
            raise ValueError("Este asiento ya está en el Diario: para quitarlo, usa «Deshacer» en Propuestas o bórralo en el Diario")
    await propuestas.descartar_siempre(config, id_propuesta, "Deshecho desde Conciliación", id_usuario)


async def volver_movimientos(config: dict, id_propuesta: int) -> None:
    """La propuesta se ha descartado: sus movimientos vuelven a tener el asiento propuesto."""
    await AsyncDatabase(**config).query(
        f"UPDATE \"{_TM}\" SET estado = 'asiento_propuesto', decision = NULL, revisado_por = NULL, fecha_revision = NULL "
        "WHERE estado = 'confirmado' AND decision ~ %s",
        (f'"id_propuesta": {int(id_propuesta)}[,}}]',),
    )


async def sincronizar(config: dict, id_usuario: int | None, ids_empresa: list[int]) -> None:
    """Mira en el SIF los borradores de las propuestas aceptadas: si alguno se
    ha tirado, su propuesta vuelve a pendiente; si se ha confirmado, queda anotado."""
    filas = await AsyncDatabase(**config).query(
        f"SELECT * FROM \"{_TP}\" WHERE id_empresa = ANY(%s) AND tipo = 'asiento' AND estado = 'aceptada' "
        "AND detalle LIKE '%%\"borrador\"%%'", (ids_empresa,),
    )
    for fila in filas:
        propuesta = propuestas._publica(fila)
        borrador = (propuesta.get("detalle") or {}).get("borrador")
        if not borrador or borrador.get("final"):
            continue
        try:
            situacion = await estado(config, id_usuario, propuesta["id_empresa"], borrador)
        except (ValueError, LookupError):
            continue
        if situacion == "tirado":
            await quitar_conciliado(config, id_usuario, propuesta)
            await propuestas.reabrir(config, propuesta["id"])
        elif situacion == "confirmado":
            await propuestas.anotar_borrador(config, propuesta["id"], {**borrador, "final": "confirmado"})
