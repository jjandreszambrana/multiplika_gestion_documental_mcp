/**
 * El periodo de liquidación llega como el mes en dos cifras, de `01` a `12`.
 * En pantalla se enseña con su nombre: un contable lee «Marzo» antes que «03».
 */
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** Si llega un código que no es un mes, se enseña tal cual en vez de vacío. */
export function nombreDePeriodo(periodo: string): string {
  return MESES[Number(periodo) - 1] ?? periodo
}
