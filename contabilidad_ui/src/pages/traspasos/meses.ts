/** El mes que se contabiliza. Vacío es el ejercicio entero. */
export const TODO_EL_EJERCICIO = ''

const NOMBRES = [
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

/** Los doce meses más la opción de no filtrar, para el selector. */
export const MESES = [
  { value: TODO_EL_EJERCICIO, label: 'Todo el ejercicio' },
  ...NOMBRES.map((nombre, posicion) => ({
    value: String(posicion + 1).padStart(2, '0'),
    label: nombre,
  })),
]

/** «marzo de 2026» o «2026», para decir en la confirmación qué se va a tocar. */
export function comoSeLlama(periodo: string, ejercicio: number): string {
  const mes = MESES.find((m) => m.value === periodo && m.value !== TODO_EL_EJERCICIO)
  return mes ? `${mes.label.toLowerCase()} de ${ejercicio}` : String(ejercicio)
}
