import { formatearEntero } from '../../lib/format'
import { FACTURAS, type DocumentoBandeja, type FacturaBandeja, type TipoDocumento } from '../../api/bandeja'

/** Los estados de la bandeja como se dicen, con su color. */
export const ESTADOS: Record<string, { nombre: string; color: string }> = {
  pendiente: { nombre: 'Por contabilizar', color: 'blue' },
  duplicada: { nombre: 'Ya está en la facturación', color: 'gray' },
  en_conflicto: { nombre: 'No coincide con la facturación', color: 'orange' },
  contabilizada: { nombre: 'Contabilizada', color: 'green' },
  descartada: { nombre: 'Descartada', color: 'gray' },
}

export function nombreDeEstado(estado: string): string {
  return ESTADOS[estado]?.nombre ?? estado
}

/** Qué se lee al posarse en el estado, además del motivo que mande el servidor. */
export const EXPLICACION_ESTADO: Record<string, string> = {
  duplicada: 'Esta factura ya está en la facturación y cuenta la de allí: esta no se contabiliza.',
  en_conflicto: 'Hay una factura igual en la facturación, pero no dice lo mismo. Elige cuál vale.',
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
