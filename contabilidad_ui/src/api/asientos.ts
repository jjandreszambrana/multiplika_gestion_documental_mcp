import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import type { components } from './types'

export type ApunteApi = components['schemas']['ApunteDiario']

/**
 * Tope por llamada que impone la API. Subido de 500 a 25.000 por el backend el
 * 30/08/2026, para que el diario de un ejercicio entre en un solo viaje. El
 * techo se queda puesto a propósito: sin ninguno, una consulta mal hecha podría
 * pedir veinte ejercicios de golpe.
 */
export const MAXIMO_POR_PAGINA = 25000

/**
 * Una línea del diario con los importes ya normalizados a `Decimal`. La API
 * puede devolverlos como número o como cadena; aquí es el único sitio donde se
 * convierten, y ningún componente recibe un importe sin normalizar.
 */
export interface Apunte extends Omit<ApunteApi, 'debe' | 'haber'> {
  debe: Decimal
  haber: Decimal
}

/** Las tres posiciones del filtro de la pantalla. */
export type Incluir = 'confirmadas' | 'borradores' | 'todas'

export interface FiltroApuntes {
  /** Nulo = todos los ejercicios. */
  ejercicio: number | null
  /** Vacío = todas las cuentas. */
  cuenta: string
  /** `aaaa-mm-dd`, o vacío. */
  desde: string
  hasta: string
  incluir: Incluir
  /** Código exacto del diario. Vacío = todos. */
  diario: string
  /**
   * Texto que aparezca en el concepto. No distingue mayúsculas ni acentos, y un
   * `%` o un `_` se buscan tal cual: quien teclea `50%` busca el descuento.
   */
  concepto: string
  /** Igual que el concepto, sobre la referencia del documento. */
  documento: string
  /** Texto del nombre de quien creó el asiento. Opcional: quien no lo usa no lo manda. */
  usuario?: string
  /** Texto del nombre de quien lo cambió por última vez (solo cambia mientras es borrador). */
  usuarioModif?: string
  /** Número de asiento. Con los dos iguales sale un solo asiento. */
  asientoDesde: string
  asientoHasta: string
  /** Importe de la línea, como cadena decimal: `"100.00"`, nunca `number`. */
  importeDesde: string
  importeHasta: string
  /**
   * Las líneas de un borrador concreto. Un `0` no filtra: es lo que llevan
   * todos los apuntes del libro, y mandarlo devolvería justo lo contrario.
   */
  idBorrador: number | null
  offset: number
  limit: number
}

/** Lo que se manda de los siete filtros nuevos: la clave no viaja si está vacía. */
export function camposDelFiltro(filtro: Omit<FiltroApuntes, 'offset' | 'limit'>) {
  return {
    ...(filtro.ejercicio === null ? {} : { ejercicio: filtro.ejercicio }),
    ...(filtro.cuenta === '' ? {} : { cuenta: filtro.cuenta }),
    ...(filtro.desde === '' ? {} : { desde: filtro.desde }),
    ...(filtro.hasta === '' ? {} : { hasta: filtro.hasta }),
    ...(filtro.diario === '' ? {} : { diario: filtro.diario }),
    ...(filtro.concepto === '' ? {} : { concepto: filtro.concepto }),
    ...(filtro.documento === '' ? {} : { documento: filtro.documento }),
    ...(!filtro.usuario ? {} : { usuario: filtro.usuario }),
    ...(!filtro.usuarioModif ? {} : { usuario_modif: filtro.usuarioModif }),
    ...(filtro.asientoDesde === '' ? {} : { asiento_desde: Number(filtro.asientoDesde) }),
    ...(filtro.asientoHasta === '' ? {} : { asiento_hasta: Number(filtro.asientoHasta) }),
    ...(filtro.importeDesde === '' ? {} : { importe_desde: filtro.importeDesde }),
    ...(filtro.importeHasta === '' ? {} : { importe_hasta: filtro.importeHasta }),
    ...(filtro.idBorrador === null || filtro.idBorrador < 1
      ? {}
      : { id_borrador: filtro.idBorrador }),
    incluir: filtro.incluir,
  }
}

export interface PaginaDeApuntes {
  /** Apuntes que cumplen el filtro, sin paginar. */
  total: number
  apuntes: Apunte[]
}

/**
 * Los apuntes del diario, en el orden fijo que da la API: fecha, asiento y
 * pase. La clave de fila es `pase`, que es único dentro de la empresa.
 */
export async function listarApuntes(
  filtro: FiltroApuntes,
  senal?: AbortSignal,
): Promise<PaginaDeApuntes> {
  const respuesta = await pedir<components['schemas']['RespuestaListarApuntes']>(
    '/contabilidad/asientos/listar',
    { ...camposDelFiltro(filtro), offset: filtro.offset, limit: filtro.limit },
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

/** Debe, haber y descuadre de un alcance. La diferencia la calcula la API. */
export interface Suma {
  debe: Decimal
  haber: Decimal
  diferencia: Decimal
  apuntes: number
}

export interface Totales {
  /** Todo lo que cumple el filtro, no solo la página. */
  consulta: Suma
  /** El ejercicio entero. Nulo si se están mirando todos los ejercicios. */
  ejercicio: Suma | null
}

function aSuma(suma: components['schemas']['Suma']): Suma {
  return {
    debe: aDecimal(suma.debe),
    haber: aDecimal(suma.haber),
    diferencia: aDecimal(suma.diferencia),
    apuntes: suma.apuntes,
  }
}

/**
 * Las sumas de la consulta y del ejercicio. Se pide con el MISMO `incluir` que
 * el listado: con uno distinto, las cifras del pie no cuadrarían con lo que el
 * contable tiene delante.
 */
export async function totalesApuntes(
  filtro: Omit<FiltroApuntes, 'offset' | 'limit'>,
  senal?: AbortSignal,
): Promise<Totales> {
  const respuesta = await pedir<components['schemas']['RespuestaTotales']>(
    '/contabilidad/asientos/totales',
    camposDelFiltro(filtro),
    senal,
  )

  return {
    consulta: aSuma(respuesta.consulta),
    ejercicio: respuesta.ejercicio ? aSuma(respuesta.ejercicio) : null,
  }
}
