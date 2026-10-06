"""Herramientas MCP de la conexión con el ERP: importar clientes, facturas y
cobros desde un Excel/CSV, sincronizar con Multiplika SIF y consultar lo
facturado a cada entidad — ver docs/gestion-documental.md → "Ventas (CRM)".
Las reglas viven en _mod_erp.py y _mod_sif.py (las comparte el panel)."""

import base64
from typing import Literal

from apps.mcp_server.core import mcp_app
from fastmcp.exceptions import ToolError

from ._anotaciones import SOLO_LECTURA
from ._herr_bloc_notas import _contexto, _ejecutar
from ..database.modelos import _mod_erp as erp
from ..database.modelos import _mod_sif as sif
from ..database.modelos._mod_documentos_pendientes import DocumentosPendientesCRUD

Objeto = Literal["clientes", "facturas", "cobros"]
FormatoFecha = Literal["dd/mm/aaaa", "mm/dd/aaaa", "aaaa-mm-dd"]


# ---------- Importación desde Excel ----------

@mcp_app.tool()
async def importar_excel_erp_gd(
    objeto: Objeto,
    id_documento_pendiente: int | None = None,
    archivo_base64: str | None = None,
    nombre_fichero: str | None = None,
    todos_los_clientes: bool = False,
) -> dict:
    """Prepara la importación de un listado exportado del ERP del cliente
    (cualquier programa de facturación) en Excel (.xlsx) o CSV: `clientes`,
    `facturas` (una fila por factura: número, fecha, cliente, base, total y,
    si lo trae, lo pendiente de cobro) o `cobros` (número de factura y lo que
    queda por cobrar). NO guarda nada todavía.

    El fichero, mejor desde la cola de pendientes (`id_documento_pendiente`:
    el cliente lo sube al panel o llega por correo; sale de la cola). Solo
    si no, `archivo_base64` + `nombre_fichero` (gasta muchos tokens).

    Devuelve las cabeceras, 10 filas de muestra, `mapeo` (campo -> número de
    columna, empezando en 0: el guardado si ya se importó un fichero con las
    mismas columnas, o uno propuesto), `faltan` y `prevision` (cuántos se
    crearían, actualizarían y qué filas fallan). Enséñale al cliente el
    mapeo y la previsión; si alguna columna está mal, corrígela con
    revisar_importacion_erp_gd. Después, aplicar_importacion_erp_gd.

    `todos_los_clientes` (solo clientes): el fichero trae TODOS los clientes,
    así que los que vinieron antes del ERP y ahora no están se marcan como
    baja (no se borran). Pregúntalo antes de ponerlo."""
    config, _, _, quien = await _contexto()
    if id_documento_pendiente is not None:
        pendientes = DocumentosPendientesCRUD(config)
        pendiente = await pendientes.obtener(id_documento_pendiente)
        if not pendiente:
            raise ToolError(f"No hay ningún documento pendiente con id {id_documento_pendiente}")
        contenido, nombre = bytes(pendiente["archivo"]), pendiente["nombre_original"]
    elif archivo_base64 and nombre_fichero:
        try:
            contenido = base64.b64decode("".join(archivo_base64.split()), validate=True)
        except ValueError as e:
            raise ToolError("archivo_base64 no es base64 válido") from e
        nombre = nombre_fichero
    else:
        raise ToolError("Pasa id_documento_pendiente, o archivo_base64 con nombre_fichero")
    vista = await _ejecutar(erp.crear_importacion(config, objeto, nombre, contenido, quien, todos_los_clientes))
    if id_documento_pendiente is not None:
        await pendientes.eliminar(id_documento_pendiente)
    return vista


@mcp_app.tool(annotations=SOLO_LECTURA)
async def revisar_importacion_erp_gd(
    id_importacion: int, mapeo: dict[str, int | None] | None = None, formato_fecha: FormatoFecha | None = None,
) -> dict:
    """Vuelve a enseñar una importación preparada, con otro `mapeo` (campo ->
    número de columna, desde 0; null deja el campo sin columna) o con otro
    `formato_fecha` si las fechas salen mal (p.ej. 03/10 leído como 10 de
    marzo). No guarda nada: solo simula."""
    config, *_ = await _contexto()
    return await _ejecutar(erp.vista_importacion(config, id_importacion, mapeo, formato_fecha))


@mcp_app.tool()
async def aplicar_importacion_erp_gd(
    id_importacion: int, mapeo: dict[str, int | None] | None = None, formato_fecha: FormatoFecha | None = None,
) -> dict:
    """Aplica una importación preparada, cuando el cliente haya dado por
    bueno el mapeo y la previsión. Las filas con error se saltan (se dice
    cuáles). Se recuerda el mapeo: la próxima vez que llegue un fichero con
    las mismas columnas se usa solo. Volver a importar no duplica: lo que
    ya estaba se actualiza."""
    config, _, _, quien = await _contexto()
    return await _ejecutar(erp.aplicar_importacion(config, id_importacion, quien, mapeo, formato_fecha))


@mcp_app.tool()
async def descartar_importacion_erp_gd(id_importacion: int) -> dict:
    """Descarta una importación preparada sin aplicarla."""
    config, *_ = await _contexto()
    await _ejecutar(erp.descartar_importacion(config, id_importacion))
    return {"id_importacion": id_importacion, "descartada": True}


@mcp_app.tool(annotations=SOLO_LECTURA)
async def listar_importaciones_erp_gd(limite: int = 20) -> list[dict]:
    """Las últimas importaciones desde Excel: qué, cuándo, quién y cómo
    fueron (creados, actualizados, errores)."""
    config, *_ = await _contexto()
    return await erp.listar_importaciones(config, limite)


# ---------- Lo facturado ----------

@mcp_app.tool(annotations=SOLO_LECTURA)
async def datos_erp_entidad_gd(id_entidad: int, solo_pendientes_de_cobro: bool = False, limite: int = 30) -> dict:
    """Lo que dice el ERP de una entidad: facturado este año y el anterior
    (base imponible), pendiente de cobro, última factura y sus facturas
    (cabecera: número, fecha, base, total, pendiente). Di siempre de cuándo
    son los datos (`fecha_datos`): si vienen de un Excel pueden estar
    atrasados. Para "¿cuánto nos debe García?" o "¿cuánto le facturamos el
    año pasado?"."""
    config, *_ = await _contexto()
    return {
        "resumen": await erp.resumen_economico(config, id_entidad),
        "facturas": await erp.facturas_entidad(config, id_entidad, solo_pendientes_de_cobro, limite),
    }


# ---------- Multiplika SIF ----------

@mcp_app.tool(annotations=SOLO_LECTURA)
async def estado_conexion_sif_gd() -> list[dict]:
    """Las conexiones con Multiplika SIF (el programa de facturación de
    Multiplika): a qué empresa, si funciona, cuándo se sincronizó por última
    vez y qué trajo."""
    config, *_ = await _contexto()
    return await sif.listar_conexiones(config)


@mcp_app.tool()
async def conectar_sif_gd(
    nombre_credencial: str, url: str = sif.URL_POR_DEFECTO, nombre: str = "Multiplika SIF",
) -> dict:
    """Conecta la GD con Multiplika SIF usando el usuario y la contraseña del
    obligado (la empresa que factura en SIF). Primero tienen que estar
    guardados como credencial (crear_credencial_gd o el panel: usuario =
    usuario de SIF, valor = contraseña). Prueba la conexión y saca sola el
    número de obligado. Después, sincronizar_sif_gd trae clientes y
    facturas, y cada noche se repite sola. Solo lee: no cambia nada en SIF."""
    config, *_ = await _contexto()
    return await _ejecutar(sif.crear_conexion(config, nombre, url, nombre_credencial))


@mcp_app.tool()
async def sincronizar_sif_gd(id_conexion: int | None = None) -> dict:
    """Trae ahora de Multiplika SIF los clientes, las facturas y lo pendiente
    de cobro (lo mismo que se hace cada noche). Sin `id_conexion`, la única
    que haya."""
    config, *_ = await _contexto()
    return await _ejecutar(sif.sincronizar(config, id_conexion))
