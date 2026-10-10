import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import type { components } from './types'

/**
 * Regularización, cierre del ejercicio y apertura del siguiente. Nivel `cierre`.
 *
 * **Los dos asientos nacen como borradores.** Por eso deshacer no es ninguna
 * excepción a la regla del proyecto: no se borra ningún asiento porque ninguno
 * llegó a entrar en el libro. Y hasta que se confirma, el contable puede
 * abrirlos en el diario y verlos enteros.
 *
 * `/cierre/cerrar` y `/cierre/abrir` siguen existiendo y hacen lo de siempre de
 * una vez, sin ensayo ni vuelta atrás. **Aquí no se usan.**
 */

export type Impedimento = components['schemas']['Impedimento']

export interface Impedimentos {
  impedimentos: Impedimento[]
  cuantos: number
  se_puede_cerrar: boolean
}

/**
 * Lo que hay que resolver antes de poder cerrar, ya redactado por la API.
 *
 * Con `incluirBorradores` dice lo mismo que hará el botón: los asientos a medias
 * dejan de bloquear y pasan a ser un aviso, pero **siguen en la lista**, porque
 * sigue habiendo algo que hacer.
 */
export async function impedimentosDelCierre(
  ejercicio: number,
  incluirBorradores: boolean,
  senal?: AbortSignal,
): Promise<Impedimentos> {
  const salida = await pedir<components['schemas']['RespuestaImpedimentos']>(
    '/contabilidad/cierre/impedimentos',
    { ejercicio, incluir_borradores: incluirBorradores },
    senal,
  )
  return {
    impedimentos: salida.impedimentos ?? [],
    cuantos: salida.cuantos,
    se_puede_cerrar: salida.se_puede_cerrar,
  }
}

export interface BorradorDelCierre {
  id_borrador: number
  /** `regularizacion` o `cierre`. */
  que_es: string
}

export interface EstadoDelCierre {
  ejercicio: number
  cerrado: boolean
  preparado: boolean
  /** `sin_empezar`, `preparado` o `cerrado`. */
  paso: string
  borradores: BorradorDelCierre[]
}

/** En qué punto del proceso está el ejercicio. */
export async function estadoDelCierre(
  ejercicio: number,
  senal?: AbortSignal,
): Promise<EstadoDelCierre> {
  const salida = await pedir<components['schemas']['RespuestaEstadoCierre']>(
    '/contabilidad/cierre/estado',
    { ejercicio },
    senal,
  )
  return { ...salida, borradores: salida.borradores ?? [] }
}

export interface VistaDelCierre {
  ejercicio: number
  /** La de los dos asientos. */
  fecha: string
  regularizacion: {
    cuentas: number
    gastos: Decimal
    ingresos: Decimal
    /** Positivo, beneficio; negativo, pérdida. */
    resultado: Decimal
    /** Dónde va el resultado al regularizar. */
    cuenta_de_resultado: string
  }
  cierre: { cuentas: number; importe: Decimal }
  simulado: boolean
  /** Se contaron los asientos a medias. */
  con_borradores: boolean
  /** Lo que se ve no se puede cerrar tal cual: hay borradores dentro. */
  provisional: boolean
  /** Escrita por la API para enseñarla tal cual. Vacía si no es provisional. */
  nota: string
  borradores: BorradorDelCierre[]
}

/**
 * Escribe los dos borradores y cuenta qué va a pasar. Con `simular` no escribe
 * ni el borrador, y **no se frena por lo que falte por hacer**: se puede ver qué
 * pasaría aunque todavía no se pueda cerrar.
 *
 * **Preparar no cierra el ejercicio**: sigue abierto y admitiendo apuntes. Si se
 * apunta algo después, lo preparado se queda viejo y hay que deshacer y volver a
 * preparar; preparar dos veces sin deshacer se rechaza.
 *
 * Con `incluirBorradores` los asientos a medias cuentan, y entonces lo que sale
 * es **provisional**: se puede mirar, pero confirmar se niega mientras quede
 * alguno. El porqué lo dice `nota`, escrita por la API.
 */
export async function prepararCierre(
  ejercicio: number,
  simular: boolean,
  incluirBorradores: boolean,
): Promise<VistaDelCierre> {
  const salida = await pedir<components['schemas']['RespuestaPrepararCierre']>(
    '/contabilidad/cierre/preparar',
    { ejercicio, simular, incluir_borradores: incluirBorradores },
  )
  return {
    ...salida,
    regularizacion: {
      ...salida.regularizacion,
      gastos: aDecimal(salida.regularizacion.gastos),
      ingresos: aDecimal(salida.regularizacion.ingresos),
      resultado: aDecimal(salida.regularizacion.resultado),
    },
    cierre: { ...salida.cierre, importe: aDecimal(salida.cierre.importe) },
    borradores: salida.borradores ?? [],
  }
}

/** Pasa los dos borradores al libro y cierra. **Esto ya no se deshace.** */
export function confirmarCierre(
  ejercicio: number,
): Promise<components['schemas']['RespuestaConfirmarCierre']> {
  return pedir<components['schemas']['RespuestaConfirmarCierre']>(
    '/contabilidad/cierre/confirmar',
    { ejercicio },
  )
}

/** Tira los borradores y deja el ejercicio como estaba. Solo si no se confirmó. */
export function deshacerCierre(ejercicio: number): Promise<{ deshechos: number }> {
  return pedir<{ deshechos: number }>('/contabilidad/cierre/deshacer', { ejercicio })
}

export interface VistaDeLaApertura {
  /** El que se abre. */
  ejercicio: number
  /** De cuál se arrastran los saldos. */
  ejercicio_base: number
  fecha: string
  cuentas: number
  importe: Decimal
  simulado: boolean
  id_borrador?: number | null
}

/**
 * El borrador del asiento de apertura del ejercicio siguiente.
 *
 * **No se prepara si el cierre del anterior no está confirmado**: arrastra sus
 * saldos, y en borrador todavía pueden cambiar.
 */
export async function prepararApertura(
  ejercicioCerrado: number,
  ejercicioNuevo: number,
  simular: boolean,
): Promise<VistaDeLaApertura> {
  const salida = await pedir<components['schemas']['RespuestaPrepararApertura']>(
    '/contabilidad/cierre/preparar_apertura',
    { ejercicio_cerrado: ejercicioCerrado, ejercicio_nuevo: ejercicioNuevo, simular },
  )
  return { ...salida, importe: aDecimal(salida.importe) }
}

/** Pasa el asiento de apertura al libro del ejercicio nuevo. */
export function confirmarApertura(
  ejercicioCerrado: number,
  ejercicioNuevo: number,
): Promise<components['schemas']['RespuestaAbrir']> {
  return pedir<components['schemas']['RespuestaAbrir']>(
    '/contabilidad/cierre/confirmar_apertura',
    { ejercicio_cerrado: ejercicioCerrado, ejercicio_nuevo: ejercicioNuevo },
  )
}

/** Tira el borrador de la apertura. Solo mientras no se haya confirmado. */
export function deshacerApertura(
  ejercicioCerrado: number,
  ejercicioNuevo: number,
): Promise<{ deshechos: number }> {
  return pedir<{ deshechos: number }>('/contabilidad/cierre/deshacer_apertura', {
    ejercicio_cerrado: ejercicioCerrado,
    ejercicio_nuevo: ejercicioNuevo,
  })
}
