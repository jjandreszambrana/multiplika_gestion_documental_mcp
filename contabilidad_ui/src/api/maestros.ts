import { pedir } from './cliente'
import type { components } from './types'

export type Maestro = components['schemas']['MaestroConCuentas']
// El OpenAPI trae dos `CampoDeCuenta`, uno por módulo, y los genera con el
// nombre largo. Este es el de los maestros; el de la configuración vive en
// `configuracion.ts`.
export type CampoDeCuenta =
  components['schemas']['apps__apisif__v1__metodos__contabilidad___api_conta_cuentas_maestros__CampoDeCuenta']
export type Ficha = components['schemas']['FichaConCuentas']
export type CuentaDeFicha = components['schemas']['CuentaDeFicha']
export type RespuestaFamilias = components['schemas']['RespuestaFamiliasConCuentas']
export type RespuestaFichas = components['schemas']['RespuestaFichasConCuentas']
export type RespuestaFijar = components['schemas']['RespuestaFijarCuentasFicha']
export type CuentaSugerida = components['schemas']['CuentaSugerida']
export type RespuestaSugerir = components['schemas']['RespuestaSugerirCuentas']

/**
 * Qué maestros tienen cuenta contable y qué campos tiene cada uno. La lista la
 * manda el servidor: si un maestro gana una cuenta, aparece sin tocar esto.
 */
export function listarMaestros(): Promise<RespuestaFamilias> {
  return pedir<RespuestaFamilias>('/contabilidad/cuentas_maestros/familias', {})
}

export interface FiltroFichas {
  familia: string
  buscar: string
  soloSinCuenta: boolean
  pagina: number
  porPagina: number
}

export function listarFichas(filtro: FiltroFichas): Promise<RespuestaFichas> {
  return pedir<RespuestaFichas>('/contabilidad/cuentas_maestros/listar', {
    familia: filtro.familia,
    buscar: filtro.buscar,
    solo_sin_cuenta: filtro.soloSinCuenta,
    pagina: filtro.pagina,
    por_pagina: filtro.porPagina,
  })
}

/** Una ficha concreta con sus cuentas, para abrir su formulario desde otra pantalla. */
export function obtenerFicha(familia: string, idFicha: number): Promise<Ficha> {
  return pedir<Ficha>('/contabilidad/cuentas_maestros/obtener', {
    familia,
    id_ficha: idFicha,
  })
}

/**
 * Escribe las cuentas de una ficha. Lo que no se manda se deja como está y una
 * cadena vacía borra la cuenta, que no es lo mismo. Es todo o nada: si una
 * cuenta no vale, no se escribe ninguna.
 */
export function fijarCuentasDeFicha(
  familia: string,
  idFicha: number,
  cuentas: Record<string, string>,
  crearEnPlan: boolean,
): Promise<RespuestaFijar> {
  return pedir<RespuestaFijar>('/contabilidad/cuentas_maestros/fijar', {
    familia,
    id_ficha: idFicha,
    cuentas,
    crear_en_plan: crearEnPlan,
  })
}

/**
 * Qué cuenta le tocaría a cada casilla de una ficha. No escribe nada: es para
 * abrir el formulario con un número puesto en vez de en blanco.
 *
 * El número lo compone el servidor con las raíces y el ancho de esta empresa.
 * Donde no hay criterio, la sugerencia viene vacía y `motivo` dice por qué;
 * aquí no se inventa ninguna.
 */
export function sugerirCuentasDeFicha(
  idMaestro: string,
  idFicha: number,
): Promise<RespuestaSugerir> {
  return pedir<RespuestaSugerir>('/contabilidad/cuentas_maestros/sugerir', {
    familia: idMaestro,
    id_ficha: idFicha,
  })
}

export type FacturaConCuentas = components['schemas']['FacturaConCuentas']
export type RespuestaFacturas = components['schemas']['RespuestaFacturasConCuentas']
export type RespuestaFijarFactura = components['schemas']['RespuestaFijarCuentasFactura']
export type FacturasPorEstado = components['schemas']['FacturasPorEstado']

export interface FiltroFacturas {
  ejercicio: number
  /** Mes `"01"`…`"12"`. Vacío = el ejercicio entero. */
  periodo: string
}

/**
 * Facturas recibidas que todavía no tienen asiento, con la cuenta de cada una
 * y la que heredaría del proveedor. Las contabilizadas ni salen ni se tocan.
 */
export function listarFacturasSinAsiento(filtro: FiltroFacturas): Promise<RespuestaFacturas> {
  return pedir<RespuestaFacturas>('/contabilidad/cuentas_maestros/facturas', {
    ejercicio: filtro.ejercicio,
    ...(filtro.periodo === '' ? {} : { periodo: filtro.periodo }),
    // La ficha del proveedor viene con cada factura: es la mitad derecha del
    // formulario, y así se abre sin ninguna llamada más.
    incluir_cuentas_del_proveedor: true,
    por_pagina: 500,
  })
}

/**
 * Escribe las cuentas de una factura concreta. Lo que se pone aquí manda sobre
 * la cuenta del proveedor, y vaciar una casilla devuelve el mando a la suya.
 *
 * Da 400 si la factura ya está contabilizada: cambiarle la casilla no le
 * cambiaría el asiento y las dos cosas dejarían de contar lo mismo.
 */
export function fijarCuentasDeFactura(
  idFactura: number,
  cuentas: Record<string, string>,
  crearEnPlan: boolean,
): Promise<RespuestaFijarFactura> {
  return pedir<RespuestaFijarFactura>('/contabilidad/cuentas_maestros/fijar_factura', {
    id_factura: idFactura,
    cuentas,
    crear_en_plan: crearEnPlan,
  })
}

/** El maestro de proveedores, tal como lo llama la API. */
export const MAESTRO_PROVEEDORES = 'emisores'

export type ProveedorPosible = components['schemas']['ProveedorPosible']
export type RespuestaEnlazar = components['schemas']['RespuestaEnlazarProveedor']
export type RespuestaEnlazarCliente = components['schemas']['RespuestaEnlazarCliente']

/**
 * Enlaza una factura recibida con la ficha de su proveedor. Sin `idFicha`
 * crea la ficha con el nombre y el NIF que trae la factura.
 *
 * Arrastra a las demás facturas de ese mismo NIF que sigan sin asiento; las
 * contabilizadas no se tocan. Nivel `cierre`.
 */
export function enlazarProveedor(
  idFactura: number,
  idFicha: number | null,
): Promise<RespuestaEnlazar> {
  return pedir<RespuestaEnlazar>('/contabilidad/cuentas_maestros/enlazar_proveedor', {
    id_factura: idFactura,
    ...(idFicha === null ? {} : { id_ficha: idFicha }),
  })
}

export type EnlacePropuesto = components['schemas']['EnlaceDeProveedorPropuesto']

export type FacturaEmitidaConCuentas = components['schemas']['FacturaEmitidaConCuentas']
export type RespuestaFacturasEmitidas =
  components['schemas']['RespuestaFacturasEmitidasConCuentas']

/**
 * Facturas emitidas que todavía no tienen asiento, con las cuentas que va a
 * usar cada una ya resueltas: la del cliente, la de ventas de su serie, una
 * por cada tipo de IVA que traiga, el recargo y la retención.
 *
 * Aquí no hay cuenta propia de la factura: cada casilla dice en qué maestro se
 * arregla (`familia` e `id_ficha`), y por eso no existe un `fijar_factura`.
 */
export function listarFacturasEmitidasSinAsiento(
  filtro: FiltroFacturas,
): Promise<RespuestaFacturasEmitidas> {
  return pedir<RespuestaFacturasEmitidas>('/contabilidad/cuentas_maestros/facturas_emitidas', {
    ejercicio: filtro.ejercicio,
    ...(filtro.periodo === '' ? {} : { periodo: filtro.periodo }),
    por_pagina: 500,
  })
}

/**
 * Enlaza una factura emitida con la ficha de su cliente. Sin `idFicha` crea la
 * ficha con el nombre y el NIF que trae la factura.
 *
 * Arrastra a las demás facturas de ese mismo NIF que sigan sin asiento. Nivel
 * `cierre`.
 */
export function enlazarCliente(
  idFactura: number,
  idFicha: number | null,
): Promise<RespuestaEnlazarCliente> {
  return pedir<RespuestaEnlazarCliente>('/contabilidad/cuentas_maestros/enlazar_cliente', {
    id_factura: idFactura,
    ...(idFicha === null ? {} : { id_ficha: idFicha }),
  })
}
