import { formatearEntero } from '../../lib/format'
import { FACTURAS, type DocumentoBandeja, type FacturaBandeja, type TipoDocumento } from '../../api/bandeja'

/** Los estados de la bandeja como se dicen, con su color. */
export const ESTADOS: Record<string, { nombre: string; color: string }> = {
  pendiente: { nombre: 'Por contabilizar', color: 'blue' },
  duplicada: { nombre: 'Ya está en la facturación', color: 'gray' },
  en_conflicto: { nombre: 'No coincide con la facturación', color: 'orange' },
  posible_duplicado: { nombre: 'CONTABILIZADO', color: 'green' },
  contabilizada: { nombre: 'Contabilizada', color: 'green' },
  descartada: { nombre: 'Descartada', color: 'gray' },
}

/** Lo que escribe el servidor en `motivo` cuando el contable dice «no es el mismo» (o «vale esta»). */
const MOTIVO_ELEGIDO_POR_EL_USUARIO = 'El contable eligió la del programa de origen.'

/**
 * Cómo se ve el estado de un documento. Lo que parece estar ya en el diario
 * se enseña como CONTABILIZADO y no se contabiliza; lo que el usuario ha dicho
 * que es distinto vuelve a por contabilizar, con otro color para que se sepa
 * que lo decidió una persona y no el programa.
 */
export function aspectoDeEstado(documento: { estado: string; motivo?: string | null }): {
  nombre: string
  color: string
} | undefined {
  if (documento.estado === 'pendiente' && documento.motivo === MOTIVO_ELEGIDO_POR_EL_USUARIO) {
    return { nombre: 'Por contabilizar', color: 'violet' }
  }
  return ESTADOS[documento.estado]
}

export function nombreDeEstado(estado: string): string {
  return ESTADOS[estado]?.nombre ?? estado
}

/** Qué se lee al posarse en el estado, además del motivo que mande el servidor. */
export const EXPLICACION_ESTADO: Record<string, string> = {
  duplicada: 'Esta factura ya está en la facturación y cuenta la de allí: esta no se contabiliza.',
  en_conflicto: 'Hay una factura igual en la facturación, pero no dice lo mismo. Elige cuál vale.',
  posible_duplicado: 'Ya está en el diario con otro asiento, así que no se contabiliza. Si no es el mismo, dilo y pasará a por contabilizar.',
  descartada: 'No entra en la contabilidad ni en el IVA.',
}

export const AVISO_CAMBIADA = 'Codiplika la cambió después de contabilizarla'

/** El segundo filtro: emitidas o recibidas; cobros o pagos. */
export const LIBROS: Record<TipoDocumento, { value: string; label: string }[]> = {
  facturas: [
    { value: '', label: 'Emitidas y recibidas' },
    { value: 'emitida', label: 'Emitidas' },
    { value: 'recibida', label: 'Recibidas' },
  ],
  movimientos: [
    { value: '', label: 'Cobros y pagos' },
    { value: 'cobro', label: 'Cobros' },
    { value: 'pago', label: 'Pagos' },
  ],
}

export function esFactura(documento: DocumentoBandeja, tipo: TipoDocumento): documento is FacturaBandeja {
  return tipo === FACTURAS && 'libro' in documento
}

/** «1 factura», «3 cobros o pagos»… para las frases de las confirmaciones. */
export function cuantosDocumentos(cuantos: number, tipo: TipoDocumento): string {
  if (tipo === FACTURAS) return cuantos === 1 ? '1 factura' : `${formatearEntero(cuantos)} facturas`
  return cuantos === 1 ? '1 cobro o pago' : `${formatearEntero(cuantos)} cobros y pagos`
}

/** Fase de un cobro con pagaré, cheque o confirming: es lo que dice en qué punto está ([5.47] del canal). */
export const FASES_PAGARE: Record<string, { nombre: string; color: string; explicacion: string }> = {
  cartera: {
    nombre: 'En cartera',
    color: 'indigo',
    explicacion: 'El cliente ha entregado el efecto, pero el dinero aún no está en el banco: pasa de la 430 a la 431 del cliente.',
  },
  negociado: {
    nombre: 'Cobrado en banco',
    color: 'teal',
    explicacion: 'El efecto se ha negociado o cobrado: la 431 del cliente pasa al banco (572) en la fecha de negociado.',
  },
  devuelto: {
    nombre: 'Devuelto',
    color: 'red',
    explicacion: 'El banco ha devuelto el efecto: el dinero sale del banco y vuelve a la 431 del cliente.',
  },
}
