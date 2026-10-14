import type { CambiosDePartida, CasillaDeclarada, FichaDeclaracion } from '../../api/declaraciones'
import { aCadenaApi } from '../../lib/dinero'
import { importeTecleado } from '../diario/lineas'

/**
 * Lo que decide la ficha de una declaración sin pintar nada: qué estados se
 * ofrecen, si se puede editar, cómo se agrupan las casillas y qué datos de
 * partida han cambiado. Aparte para poder probarlo.
 */

export const BORRADOR = 0
export const REGISTRADA = 1
export const PRESENTADA = 2
export const SUSTITUIDA = 3

/** La API llama «confirmada» al estado 1; el contable la conoce como registrada. */
export const ESTADOS: Record<number, { texto: string; color: string }> = {
  [BORRADOR]: { texto: 'Borrador', color: 'gray' },
  [REGISTRADA]: { texto: 'Registrada', color: 'blue' },
  [PRESENTADA]: { texto: 'Presentada', color: 'green' },
  [SUSTITUIDA]: { texto: 'Sustituida', color: 'orange' },
}

export function estadoDe(estado: number) {
  return ESTADOS[estado] ?? { texto: String(estado), color: 'gray' }
}

export const RESULTADOS: Record<string, string> = {
  ingresar: 'A ingresar',
  compensar: 'A compensar',
  devolver: 'A devolver',
  resultado_cero: 'Sin resultado',
  sin_actividad: 'Sin actividad',
}

export interface PasoDeEstado {
  estado: number
  texto: string
  /** Pasar a presentada pide fecha y justificante. */
  pideJustificante?: boolean
}

/**
 * Los cambios de estado que se ofrecen. Con la liquidación contabilizada no se
 * cambia (hay que descontabilizar antes), la sustituida no se toca a mano y de
 * presentada no se vuelve a borrador: solo se deshace la presentación.
 */
export function pasosDeEstado(estado: number, contabilizada: boolean): PasoDeEstado[] {
  if (contabilizada) return []
  switch (estado) {
    case BORRADOR:
      return [{ estado: REGISTRADA, texto: 'Marcar como registrada' }]
    case REGISTRADA:
      return [
        { estado: PRESENTADA, texto: 'Marcar como presentada', pideJustificante: true },
        { estado: BORRADOR, texto: 'Volver a borrador' },
      ]
    case PRESENTADA:
      return [{ estado: REGISTRADA, texto: 'Deshacer la presentación' }]
    default:
      return []
  }
}

/** Datos de partida y casillas solo se tocan en borrador o registrada, y sin contabilizar. */
export function sePuedeEditar(estado: number, contabilizada: boolean): boolean {
  return !contabilizada && (estado === BORRADOR || estado === REGISTRADA)
}

/** Por qué no se puede editar, para decirlo en vez de dejar los botones apagados sin más. */
export function motivoSinEditar(estado: number, contabilizada: boolean): string | null {
  if (contabilizada) return 'Está contabilizada: para cambiar algo, deshaz antes la contabilización.'
  if (estado === PRESENTADA) return 'Está presentada: ya no se puede cambiar.'
  if (estado === SUSTITUIDA) return 'Otra declaración la ha sustituido: ya no se puede cambiar.'
  return null
}

/** Los bloques del impreso, en su orden. */
export const APARTADOS: { clave: string; titulo: string }[] = [
  { clave: 'devengado', titulo: 'IVA devengado' },
  { clave: 'deducible', titulo: 'IVA deducible' },
  { clave: 'informacion_adicional', titulo: 'Información adicional' },
  { clave: 'resultado', titulo: 'Resultado' },
]

/**
 * Las casillas por bloque, sin cambiar el orden en que llegan, que es el del
 * impreso. Un apartado que no se conozca va al final con su nombre, para no
 * perder ninguna casilla si la API añade uno.
 */
export function casillasPorApartado(
  casillas: CasillaDeclarada[],
): { clave: string; titulo: string; casillas: CasillaDeclarada[] }[] {
  const conocidos = new Set(APARTADOS.map((uno) => uno.clave))
  const otros = [...new Set(casillas.map((c) => c.apartado).filter((a) => !conocidos.has(a)))]
  return [...APARTADOS, ...otros.map((clave) => ({ clave, titulo: clave }))]
    .map((apartado) => ({
      ...apartado,
      casillas: casillas.filter((c) => c.apartado === apartado.clave),
    }))
    .filter((apartado) => apartado.casillas.length > 0)
}

/** El formulario de datos de partida, como se teclea. */
export interface FormularioPartida {
  /** Marcado: las cuotas a compensar se toman de la declaración anterior. */
  cuotasDeAnterior: boolean
  cuotas: string
  solicitar_devolucion: boolean
  devolucion_mensual: boolean
  forma_de_pago: string
  iban: string
  bic: string
  criterio_caja: boolean
  destinatario_criterio_caja: boolean
  sii_voluntario: boolean
  exonerado_390: boolean
  gasolinas: boolean
}

const MARCAS = [
  'solicitar_devolucion',
  'devolucion_mensual',
  'criterio_caja',
  'destinatario_criterio_caja',
  'sii_voluntario',
  'exonerado_390',
  'gasolinas',
] as const

const TEXTOS = ['forma_de_pago', 'iban', 'bic'] as const

export function formularioDe(ficha: FichaDeclaracion): FormularioPartida {
  return {
    cuotasDeAnterior: ficha.cuotas_a_compensar === null,
    cuotas: ficha.cuotas_a_compensar?.toFixed(2).replace('.', ',') ?? '',
    solicitar_devolucion: ficha.solicitar_devolucion,
    devolucion_mensual: ficha.devolucion_mensual,
    forma_de_pago: ficha.forma_de_pago,
    iban: ficha.iban,
    bic: ficha.bic,
    criterio_caja: ficha.criterio_caja,
    destinatario_criterio_caja: ficha.destinatario_criterio_caja,
    sii_voluntario: ficha.sii_voluntario,
    exonerado_390: ficha.exonerado_390,
    gasolinas: ficha.gasolinas,
  }
}

/**
 * Solo lo que ha cambiado respecto a lo guardado: `modificar` deja como está lo
 * que no se manda, y mandar de más recalcularía sin necesidad.
 */
export function cambiosDePartida(ficha: FichaDeclaracion, formulario: FormularioPartida): CambiosDePartida {
  const cambios: CambiosDePartida = {}

  if (formulario.cuotasDeAnterior) {
    if (ficha.cuotas_a_compensar !== null) cambios.cuotas_a_compensar = null
  } else {
    const tecleado = importeTecleado(formulario.cuotas)
    if (ficha.cuotas_a_compensar === null || !ficha.cuotas_a_compensar.equals(tecleado)) {
      cambios.cuotas_a_compensar = aCadenaApi(tecleado)
    }
  }

  for (const marca of MARCAS) {
    if (formulario[marca] !== ficha[marca]) cambios[marca] = formulario[marca]
  }
  for (const campo of TEXTOS) {
    const valor = formulario[campo].trim()
    if (valor !== ficha[campo]) cambios[campo] = valor
  }
  return cambios
}
