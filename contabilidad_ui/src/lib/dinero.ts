import Decimal from 'decimal.js'

/**
 * Importe tal y como puede llegar de la API: número, cadena o nulo.
 * El tipo generado lo refleja así, y hay que normalizarlo en un único punto.
 */
export type ImporteApi = number | string | null | undefined

/** Convierte a Decimal lo que venga de la API. Nulo y vacío valen cero. */
export function aDecimal(valor: ImporteApi): Decimal {
  if (valor === null || valor === undefined || valor === '') return new Decimal(0)
  return new Decimal(valor)
}

/**
 * Importe listo para enviar a la API, que los espera como cadena con punto
 * decimal. Se redondea a 2 con ROUND_HALF_UP porque es lo que el backend guarda.
 */
export function aCadenaApi(valor: Decimal): string {
  return valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
}

/**
 * Quita de lo tecleado todo lo que no puede formar parte de un importe: dígitos
 * y **un solo** separador decimal, que puede ser coma o punto porque el
 * contable escribe con coma y el teclado numérico da punto.
 *
 * Se aplica mientras se escribe, así que la letra no llega ni a verse. No
 * decide si el importe vale: eso lo dice la API.
 *
 * No admite el signo menos a propósito: lo que cuesta un bien, lo que se saca
 * al venderlo y un porcentaje de amortización no son negativos nunca.
 */
export function soloImporte(texto: string): string {
  const limpio = texto.replace(/[^\d.,]/g, '')
  const primero = limpio.search(/[.,]/)
  if (primero === -1) return limpio
  // Del resto se quitan los separadores de más: 1,2,3 se queda en 1,23.
  return limpio.slice(0, primero + 1) + limpio.slice(primero + 1).replace(/[.,]/g, '')
}
