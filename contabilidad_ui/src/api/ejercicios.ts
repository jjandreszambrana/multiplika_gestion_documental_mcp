import { pedir } from './cliente'
import type { components } from './types'

/**
 * Ejercicios y periodos de liquidación.
 *
 * El listado vive en `sesion.ts`, porque lo pide el armazón al entrar para
 * alimentar el selector de ejercicio. Aquí está lo que solo usa la pantalla de
 * ejercicios: el detalle con sus periodos y las tres acciones de nivel `cierre`.
 */

export type EjercicioDetalle = components['schemas']['EjercicioDetalle']
export type Periodo = components['schemas']['Periodo']

/** El ejercicio con sus doce periodos. **404** si no existe. */
export function obtenerEjercicio(ejercicio: number): Promise<EjercicioDetalle> {
  return pedir<EjercicioDetalle>('/contabilidad/ejercicios/obtener', {
    ejercicio,
  })
}

/**
 * Bloquea el ejercicio para una revisión, o lo libera. Nivel `cierre`.
 * Sobre un ejercicio cerrado la API responde 400: el cierre es definitivo y no
 * se levanta quitando el bloqueo.
 */
export function bloquearEjercicio(
  ejercicio: number,
  bloqueado: boolean,
): Promise<components['schemas']['RespuestaBloqueo']> {
  return pedir<components['schemas']['RespuestaBloqueo']>('/contabilidad/ejercicios/bloquear', {
    ejercicio,
    bloqueado,
  })
}

/**
 * Cierra un periodo a nuevos apuntes, o lo reabre. Nivel `cierre`. El periodo
 * es el mes en dos cifras, de `01` a `12`.
 */
export function fijarPeriodo(
  ejercicio: number,
  periodo: string,
  deshabilitado: boolean,
): Promise<components['schemas']['RespuestaPeriodoEstado']> {
  return pedir<components['schemas']['RespuestaPeriodoEstado']>(
    '/contabilidad/ejercicios/periodo',
    { ejercicio, periodo, deshabilitado },
  )
}

/**
 * Abre un ejercicio nuevo. Nivel `cierre`. Cuelga de `/empresa` y no de
 * `/ejercicios`, y `tipo_pgc` se omite a propósito: lo hereda de la empresa.
 * Se abre vacío; los saldos del anterior los trae el asiento de apertura.
 */
export function abrirEjercicio(
  ejercicio: number,
): Promise<components['schemas']['RespuestaAbrirEjercicio']> {
  return pedir<components['schemas']['RespuestaAbrirEjercicio']>(
    '/contabilidad/empresa/abrir_ejercicio',
    { ejercicio },
  )
}
