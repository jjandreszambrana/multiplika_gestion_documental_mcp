import Decimal from 'decimal.js'
import type { ApunteMayor } from '../../api/informes'

export interface SumaDeSeleccion {
  debe: Decimal
  haber: Decimal
  diferencia: Decimal
  apuntes: number
}

/**
 * Debe, haber y diferencia de los apuntes marcados con su casilla. Es la única
 * cuenta que echa esta pantalla, y solo porque es el total de una columna que
 * está a la vista: los saldos los da el servidor.
 */
export function sumarSeleccion(apuntes: ApunteMayor[]): SumaDeSeleccion {
  const debe = apuntes.reduce((acumulado, fila) => acumulado.plus(fila.debe), new Decimal(0))
  const haber = apuntes.reduce((acumulado, fila) => acumulado.plus(fila.haber), new Decimal(0))
  return { debe, haber, diferencia: debe.minus(haber), apuntes: apuntes.length }
}
