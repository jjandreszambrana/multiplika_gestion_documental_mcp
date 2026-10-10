import type { Periodo } from '../../api/fiscal'

/**
 * Los periodos que admite la API: cuatro trimestres y doce meses.
 *
 * Van primero los trimestres porque es como declara casi todo el mundo, y con
 * los meses escritos al lado: nadie tiene por qué acordarse de qué abarca «3T».
 *
 * **En ningún sitio consta si una empresa declara por meses o por trimestres**,
 * así que se recuerda el último que eligió cada usuario.
 */
export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '1T', label: '1T · enero a marzo' },
  { value: '2T', label: '2T · abril a junio' },
  { value: '3T', label: '3T · julio a septiembre' },
  { value: '4T', label: '4T · octubre a diciembre' },
  { value: '01', label: '01 · enero' },
  { value: '02', label: '02 · febrero' },
  { value: '03', label: '03 · marzo' },
  { value: '04', label: '04 · abril' },
  { value: '05', label: '05 · mayo' },
  { value: '06', label: '06 · junio' },
  { value: '07', label: '07 · julio' },
  { value: '08', label: '08 · agosto' },
  { value: '09', label: '09 · septiembre' },
  { value: '10', label: '10 · octubre' },
  { value: '11', label: '11 · noviembre' },
  { value: '12', label: '12 · diciembre' },
]

export const PERIODO_POR_DEFECTO: Periodo = '1T'

/** Cómo se nombra un periodo fuera del desplegable. Si no se reconoce, tal cual. */
export function nombreDePeriodo(periodo: Periodo): string {
  return PERIODOS.find((uno) => uno.value === periodo)?.label ?? periodo
}
