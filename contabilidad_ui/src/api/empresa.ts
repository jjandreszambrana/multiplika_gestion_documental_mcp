import { pedir } from './cliente'
import type { components } from './types'

export type RespuestaActivar = components['schemas']['RespuestaActivar']

/** Dónde vive la cuenta de un cliente o un proveedor en esta empresa. */
export type OrigenTerceros = 'gestion' | 'contabilidad'

/**
 * Da de alta la contabilidad de una empresa. Es el **único** endpoint del
 * módulo que lleva `id_obligado`: al activar todavía no hay contabilidad a la
 * que conmutar. `tipo_pgc` se omite y lo pone el servidor.
 *
 * `origen_terceros` no queda cerrado aquí: se cambia después con
 * `/configuracion/fijar_origen_terceros`, que además mueve las cuentas.
 */
export function activarContabilidad(
  idObligado: number,
  ejercicio: number,
  origenTerceros: OrigenTerceros,
): Promise<RespuestaActivar> {
  return pedir<RespuestaActivar>('/contabilidad/empresa/activar', {
    id_obligado: idObligado,
    ejercicio,
    origen_terceros: origenTerceros,
  })
}

export interface ObligadoResumen {
  id: number
  nombre: string | null
  nif: string | null
}

const MAXIMO_OBLIGADOS = 500

/**
 * `/obligados/listar` es de otro módulo y su respuesta viene sin tipar en el
 * OpenAPI (`registros: object[]`), así que cada fila se lee con cuidado y lo
 * que no venga se muestra vacío en vez de romper la pantalla.
 */
function leerObligado(fila: unknown): ObligadoResumen | null {
  if (typeof fila !== 'object' || fila === null) return null
  const campos = fila as Record<string, unknown>
  const id = campos['id']
  if (typeof id !== 'number') return null
  const nombre = campos['NombreRazon']
  const nif = campos['NIF']
  return {
    id,
    nombre: typeof nombre === 'string' ? nombre : null,
    nif: typeof nif === 'string' ? nif : null,
  }
}

export async function listarObligados(): Promise<ObligadoResumen[]> {
  const { registros } = await pedir<{ registros: unknown[] }>('/obligados/listar', {
    limit: MAXIMO_OBLIGADOS,
  })
  return registros.map(leerObligado).filter((o): o is ObligadoResumen => o !== null)
}
