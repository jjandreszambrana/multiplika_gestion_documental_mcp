import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import type { components } from './types'

export type ApunteEliminadoApi = components['schemas']['ApunteEliminado']

/** Las tres posiciones del filtro, el mismo vocabulario que el diario. */
export type Incluir = 'confirmadas' | 'borradores' | 'todas'

/** Un apunte que salió del libro, con los importes ya normalizados a `Decimal`. */
export interface ApunteEliminado extends Omit<ApunteEliminadoApi, 'debe' | 'haber'> {
  debe: Decimal
  haber: Decimal
}

export interface FiltroEliminados {
  ejercicio: number | null
  /** Fecha contable del apunte, `aaaa-mm-dd`, no el día en que se borró. */
  desde: string
  hasta: string
  /** De dónde salió el apunte. Por defecto, de los dos sitios. */
  incluir: Incluir
  offset: number
  limit: number
}

export interface PaginaDeEliminados {
  total: number
  apuntes: ApunteEliminado[]
}

/** Tope por llamada, el mismo que el diario. */
export const MAXIMO_POR_PAGINA = 500

/**
 * Los apuntes que se eliminaron, del más recientemente borrado al más antiguo.
 * Solo se consultan: no se recuperan, ni por aquí ni por ningún otro sitio.
 *
 * Entran los dos casos: lo que salió del libro —que hoy ya no puede pasar— y
 * los apuntes que se quitaron de un borrador, incluido tirar el borrador
 * entero. Lo que se traspasa a otro borrador **no** cuenta: se ha movido, no
 * eliminado.
 */
export async function listarEliminados(
  filtro: FiltroEliminados,
  senal?: AbortSignal,
): Promise<PaginaDeEliminados> {
  const respuesta = await pedir<components['schemas']['RespuestaListarEliminados']>(
    '/contabilidad/asientos/eliminados/listar',
    {
      ...(filtro.ejercicio === null ? {} : { ejercicio: filtro.ejercicio }),
      ...(filtro.desde === '' ? {} : { desde: filtro.desde }),
      ...(filtro.hasta === '' ? {} : { hasta: filtro.hasta }),
      incluir: filtro.incluir,
      offset: filtro.offset,
      limit: filtro.limit,
    },
    senal,
  )

  return {
    total: respuesta.total,
    apuntes: (respuesta.apuntes ?? []).map((fila) => ({
      ...fila,
      debe: aDecimal(fila.debe),
      haber: aDecimal(fila.haber),
    })),
  }
}
