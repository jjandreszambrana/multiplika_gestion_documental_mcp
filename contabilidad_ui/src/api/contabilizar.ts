import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import type { components } from './types'

/**
 * Contabilización automática: pasar a asientos las facturas de facturación.
 *
 * El `tipo` separa emitidas de recibidas y lo entienden los cuatro endpoints.
 * Sin él vendrían los dos, pero aquí se manda siempre: cada pantalla es de un
 * tipo y un botón que hiciera las dos cosas mentiría sobre lo que hace.
 */
export const EMITIDAS = 'factura_emitida'
export const RECIBIDAS = 'factura_recibida_sii'

export type TipoFactura = typeof EMITIDAS | typeof RECIBIDAS

type FacturaEmitidaApi = components['schemas']['FacturaPendienteEmitida']
type FacturaRecibidaApi = components['schemas']['FacturaPendienteRecibida']

/** Los importes de una factura, ya normalizados. `tramos` no se enseña. */
interface Importes {
  base: Decimal
  cuota: Decimal
  recargo: Decimal
  importe_irpf: Decimal
  importe_total: Decimal
}

const IMPORTES = ['base', 'cuota', 'recargo', 'importe_irpf', 'importe_total', 'tramos'] as const

export type FacturaEmitida = Omit<FacturaEmitidaApi, (typeof IMPORTES)[number]> & Importes
export type FacturaRecibida = Omit<FacturaRecibidaApi, (typeof IMPORTES)[number]> & Importes

/** Lo que las dos comparten, que es lo que necesitan las columnas comunes. */
export type FacturaPendiente = FacturaEmitida | FacturaRecibida

export type AsientoGenerado = components['schemas']['AsientoGenerado']
export type ResultadoPeriodo = components['schemas']['RespuestaContabilizarPeriodo']
export type ResultadoReintento = components['schemas']['RespuestaReintentar']
export type Anulacion = components['schemas']['AnulacionPendiente']
export type ResultadoReversion = components['schemas']['RespuestaRevertirAnulaciones']

function importesDe(factura: FacturaEmitidaApi | FacturaRecibidaApi): Importes {
  return {
    base: aDecimal(factura.base),
    cuota: aDecimal(factura.cuota),
    recargo: aDecimal(factura.recargo),
    importe_irpf: aDecimal(factura.importe_irpf),
    importe_total: aDecimal(factura.importe_total),
  }
}

// El desglose por tipo de IVA (`tramos`) se descarta aquí: no se enseña, y
// dejarlo pasar sería un importe sin normalizar suelto por la aplicación.
function sinTramos(factura: FacturaEmitidaApi): FacturaEmitida
function sinTramos(factura: FacturaRecibidaApi): FacturaRecibida
function sinTramos(factura: FacturaEmitidaApi | FacturaRecibidaApi): FacturaPendiente {
  const { tramos, base, cuota, recargo, importe_irpf, importe_total, ...resto } = factura
  return { ...resto, ...importesDe(factura) }
}

/**
 * Facturas firmes que todavía no tienen asiento. Las dos claves llegan siempre
 * aunque se pida un solo tipo: la que no se pide viene vacía, así que no hay
 * que averiguar si la que falta es que no había o que no se pidió.
 */
export async function facturasPendientes(
  ejercicio: number,
  periodo: string,
  tipo: TipoFactura,
): Promise<FacturaPendiente[]> {
  const respuesta = await pedir<components['schemas']['RespuestaPendientes']>(
    '/contabilidad/contabilizar/pendientes',
    { ejercicio, ...(periodo === '' ? {} : { periodo }), tipo },
  )

  if (tipo === EMITIDAS) return (respuesta.factura_emitida.facturas ?? []).map(sinTramos)
  return (respuesta.factura_recibida_sii.facturas ?? []).map(sinTramos)
}

/**
 * Genera los asientos. Cada factura va por su cuenta: la que falla queda
 * anotada con su motivo y no frena a las demás.
 */
export function contabilizarPeriodo(
  ejercicio: number,
  periodo: string,
  tipo: TipoFactura,
): Promise<ResultadoPeriodo> {
  return pedir<ResultadoPeriodo>('/contabilidad/contabilizar/periodo', {
    ejercicio,
    ...(periodo === '' ? {} : { periodo }),
    tipo,
  })
}

/**
 * Vuelve a intentar las que quedaron apartadas. Es del ejercicio entero, sin
 * mes: lo que se arregla es el motivo, y ese no entiende de meses.
 */
export function reintentarPendientes(
  ejercicio: number,
  tipo: TipoFactura,
): Promise<ResultadoReintento> {
  return pedir<ResultadoReintento>('/contabilidad/contabilizar/reintentar_pendientes', {
    ejercicio,
    tipo,
  })
}

/**
 * Ventas anuladas que siguen teniendo asiento. No llevan ejercicio ni tipo: la
 * fecha la manda la anulación y anular es cosa de las emitidas.
 */
export async function anulacionesPendientes(): Promise<Anulacion[]> {
  const respuesta = await pedir<components['schemas']['RespuestaAnulacionesPendientes']>(
    '/contabilidad/contabilizar/anulaciones_pendientes',
    {},
  )
  return respuesta.anulaciones ?? []
}

/** Genera el asiento inverso de cada anulación. El original no se borra. */
export function revertirAnulaciones(): Promise<ResultadoReversion> {
  return pedir<ResultadoReversion>('/contabilidad/contabilizar/revertir_anulaciones', {})
}
