import type Decimal from 'decimal.js'
import DecimalCtor from 'decimal.js'

/**
 * Todo el formateo para pantalla vive aquí. Los componentes no formatean.
 * Formato español: decimales con coma, miles con punto, fechas dd/mm/aaaa.
 */

const SEPARADOR_MILES = '.'
const SEPARADOR_DECIMAL = ','

/** Importe para mostrar: 1234.565 -> "1.234,57". Redondeo solo al mostrar. */
export function formatearImporte(valor: Decimal, decimales = 2): string {
  const redondeado = valor.toDecimalPlaces(decimales, DecimalCtor.ROUND_HALF_UP)
  const negativo = redondeado.isNegative() && !redondeado.isZero()
  const [entera = '0', fraccion = ''] = redondeado.abs().toFixed(decimales).split('.')

  const enteraConMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARADOR_MILES)
  const cuerpo = decimales > 0 ? `${enteraConMiles}${SEPARADOR_DECIMAL}${fraccion}` : enteraConMiles

  return negativo ? `-${cuerpo}` : cuerpo
}

/** Fecha de la API (aaaa-mm-dd) a pantalla (dd/mm/aaaa). */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const [aaaa, mm, dd] = iso.slice(0, 10).split('-')
  if (!aaaa || !mm || !dd) return ''
  return `${dd}/${mm}/${aaaa}`
}

/** Fecha de pantalla (dd/mm/aaaa) a la API (aaaa-mm-dd). Vacío si no encaja. */
export function fechaParaApi(texto: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim())
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** Número entero para mostrar: 1234 -> "1.234". Para contadores y totales de filas. */
export function formatearEntero(valor: number): string {
  const entero = Math.trunc(valor)
  const negativo = entero < 0
  const cuerpo = String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, SEPARADOR_MILES)
  return negativo ? `-${cuerpo}` : cuerpo
}
