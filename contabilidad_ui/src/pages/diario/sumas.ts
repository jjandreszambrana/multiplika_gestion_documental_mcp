import Decimal from 'decimal.js'
import type { Apunte, Suma } from '../../api/asientos'

/**
 * Debe, haber y descuadre de los apuntes marcados con su casilla. Es la única
 * cuenta que echa esta pantalla, y solo porque es el total de una columna a la
 * vista: la de la consulta y la del ejercicio las da el servidor.
 */
export function sumarSeleccion(apuntes: Apunte[]): Suma {
  const debe = apuntes.reduce((acumulado, fila) => acumulado.plus(fila.debe), new Decimal(0))
  const haber = apuntes.reduce((acumulado, fila) => acumulado.plus(fila.haber), new Decimal(0))
  return { debe, haber, diferencia: debe.minus(haber), apuntes: apuntes.length }
}
