import Decimal from 'decimal.js'
import type { TramoIva } from '../../api/fiscal'

export interface SumaDeTramos {
  base: Decimal
  cuota: Decimal
  recargo: Decimal
}

/**
 * Los totales de las tres columnas de una tabla de tipos de IVA.
 *
 * La API ya manda la cuota total —`cuota_repercutida` y `cuota_soportada`—, y
 * esa es la que se enseña. Esto suma las otras dos columnas, la base y el
 * recargo, que la API no totaliza y están a la vista: es la única excepción
 * admitida, y va con decimal.js.
 */
export function sumarTramos(tramos: TramoIva[]): SumaDeTramos {
  return {
    base: tramos.reduce((total, fila) => total.plus(fila.base), new Decimal(0)),
    cuota: tramos.reduce((total, fila) => total.plus(fila.cuota), new Decimal(0)),
    recargo: tramos.reduce((total, fila) => total.plus(fila.recargo), new Decimal(0)),
  }
}
