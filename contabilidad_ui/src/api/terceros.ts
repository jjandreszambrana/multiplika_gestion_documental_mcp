import { pedir } from './cliente'
import type { components } from './types'

export type Tercero = components['schemas']['Tercero']
export type RespuestaListarTerceros = components['schemas']['RespuestaListarTerceros']

/** Las dos clases de tercero. Sin valor = las dos. */
export type TipoTercero = 'cliente' | 'proveedor'

/** Tope por llamada que impone la API. */
export const MAXIMO_POR_PAGINA = 1000

export interface FiltroTerceros {
  /** Nulo = clientes y proveedores. */
  tipo: TipoTercero | null
  /** Busca por cuenta (que empiece por), razón social o NIF (que lo contengan). */
  texto: string
  offset: number
  limit: number
}

/**
 * Los terceros que ya tienen subcuenta. `razon` y `cif` son los del momento
 * del alta y no se refrescan desde gestión: es a propósito, para que un asiento
 * antiguo se imprima con el nombre de entonces.
 */
export function listarTerceros(filtro: FiltroTerceros): Promise<RespuestaListarTerceros> {
  return pedir<RespuestaListarTerceros>('/contabilidad/terceros/listar', {
    ...(filtro.tipo === null ? {} : { tipo: filtro.tipo }),
    texto: filtro.texto,
    offset: filtro.offset,
    limit: filtro.limit,
  })
}

/*
 * Lo que este módulo NO hace, a propósito:
 *
 * - `/terceros/enlazar` no se usa. La cuenta de un cliente o un proveedor se
 *   pone en «Enlace con gestión», que escribe la ficha y la equivalencia en la
 *   misma operación; enlazar solo aquí dejaría la ficha vacía y el dato en dos
 *   sitios otra vez.
 * - `/terceros/sin_enlazar` tampoco: los que no tienen cuenta salen ya en esa
 *   misma pantalla, con el filtro de fichas sin cuenta asignada.
 * - `/terceros/resolver` es de la entrada de asientos, no de aquí: devuelve la
 *   cuenta de un tercero, pero la crea si no existe, así que no vale para mirar.
 */
