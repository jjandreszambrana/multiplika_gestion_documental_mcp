import { pedir } from './cliente'
import type { components } from './types'

export type RespuestaRevisar = components['schemas']['RespuestaRevisar']
export type FamiliaRevisada = components['schemas']['FamiliaRevisada']
export type RespuestaCrearCuentas = components['schemas']['RespuestaCrearCuentas']

/** Qué cuentas apuntan los maestros de facturación y no existen en el plan. */
export function revisarCuadre(): Promise<RespuestaRevisar> {
  return pedir<RespuestaRevisar>('/contabilidad/sincronizacion/revisar', {})
}

/**
 * Da de alta las cuentas que gestión ya apunta. Simula si no se dice lo
 * contrario, y es idempotente: aplicarlo dos veces no crea nada la segunda.
 */
export function crearCuentasQueFaltan(simular: boolean): Promise<RespuestaCrearCuentas> {
  return pedir<RespuestaCrearCuentas>('/contabilidad/sincronizacion/crear_cuentas', { simular })
}
