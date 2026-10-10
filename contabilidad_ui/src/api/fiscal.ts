import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import type { components } from './types'

/**
 * Los tres resúmenes fiscales del periodo. Nivel `consulta`: no se guarda nada,
 * se pregunta y se contesta con lo que hay hoy en los libros.
 *
 * No confundirlos con el modelo 303, que sí es un documento guardado y vive en
 * `/contabilidad/declaraciones`. Estas tres son la materia prima; el 303 son
 * sus casillas.
 *
 * Los tres comparten cuerpo: `ejercicio` y `periodo`. **No lleva `id_obligado`**:
 * la empresa viaja en el token.
 */

/** Mes (`01`–`12`) o trimestre (`1T`–`4T`), como los nombra la API. */
export type Periodo = string

export interface FiltroFiscal {
  ejercicio: number
  periodo: Periodo
}

type TramoApi = components['schemas']['TramoIvaPeriodo']
type PerceptorApi = components['schemas']['Perceptor']

/** Un tipo de IVA con lo acumulado del periodo. */
export interface TramoIva extends Omit<TramoApi, 'base' | 'cuota' | 'recargo'> {
  base: Decimal
  cuota: Decimal
  recargo: Decimal
}

export interface ResumenIva {
  ejercicio: number
  periodo: Periodo
  /** Primer y último día del periodo, como los calcula la API. */
  desde: string
  hasta: string
  repercutido: TramoIva[]
  soportado: TramoIva[]
  cuota_repercutida: Decimal
  cuota_soportada: Decimal
  /** Repercutido menos soportado. Positivo, a ingresar; negativo, a compensar. */
  resultado: Decimal
}

export interface Perceptor extends Omit<PerceptorApi, 'tipo' | 'retenido'> {
  /** Porcentaje de retención. */
  tipo: Decimal
  retenido: Decimal
}

export interface Retenciones {
  ejercicio: number
  periodo: Periodo
  perceptores: Perceptor[]
  total_retenido: Decimal
  /** Limitación conocida del dato, redactada por la API. Se enseña tal cual. */
  aviso: string
}

export interface CuadreIva {
  ejercicio: number
  periodo: Periodo
  repercutido_en_facturas: Decimal
  repercutido_contabilizado: Decimal
  diferencia_repercutido: Decimal
  soportado_en_facturas: Decimal
  soportado_contabilizado: Decimal
  diferencia_soportado: Decimal
  /** Lo decide la API, no la pantalla. */
  cuadra: boolean
  tolerancia: Decimal
  /** Hasta dónde llega ese «cuadra»: qué casos no mira. Se enseña tal cual. */
  limites: string
}

function tramo(fila: TramoApi): TramoIva {
  return {
    ...fila,
    base: aDecimal(fila.base),
    cuota: aDecimal(fila.cuota),
    recargo: aDecimal(fila.recargo),
  }
}

/** Bases y cuotas del periodo por tipo. Es la materia prima del 303, no sus casillas. */
export async function resumenDeIva(filtro: FiltroFiscal, senal?: AbortSignal): Promise<ResumenIva> {
  const salida = await pedir<components['schemas']['RespuestaIva']>(
    '/contabilidad/fiscal/iva',
    { ejercicio: filtro.ejercicio, periodo: filtro.periodo },
    senal,
  )

  return {
    ejercicio: salida.ejercicio,
    periodo: salida.periodo,
    desde: salida.desde,
    hasta: salida.hasta,
    repercutido: (salida.repercutido ?? []).map(tramo),
    soportado: (salida.soportado ?? []).map(tramo),
    cuota_repercutida: aDecimal(salida.cuota_repercutida),
    cuota_soportada: aDecimal(salida.cuota_soportada),
    resultado: aDecimal(salida.resultado),
  }
}

/** Lo retenido en el periodo, por proveedor y porcentaje. Base de los modelos 111 y 115. */
export async function retencionesDelPeriodo(
  filtro: FiltroFiscal,
  senal?: AbortSignal,
): Promise<Retenciones> {
  const salida = await pedir<components['schemas']['RespuestaRetenciones']>(
    '/contabilidad/fiscal/retenciones',
    { ejercicio: filtro.ejercicio, periodo: filtro.periodo },
    senal,
  )

  return {
    ejercicio: salida.ejercicio,
    periodo: salida.periodo,
    perceptores: (salida.perceptores ?? []).map((fila) => ({
      ...fila,
      tipo: aDecimal(fila.tipo),
      retenido: aDecimal(fila.retenido),
    })),
    total_retenido: aDecimal(salida.total_retenido),
    aviso: salida.aviso,
  }
}

/** Compara el IVA de las facturas con el contabilizado. */
export async function cuadreDeIva(filtro: FiltroFiscal, senal?: AbortSignal): Promise<CuadreIva> {
  const salida = await pedir<components['schemas']['RespuestaCuadreIva']>(
    '/contabilidad/fiscal/cuadre_iva',
    { ejercicio: filtro.ejercicio, periodo: filtro.periodo },
    senal,
  )

  return {
    ejercicio: salida.ejercicio,
    periodo: salida.periodo,
    repercutido_en_facturas: aDecimal(salida.repercutido_en_facturas),
    repercutido_contabilizado: aDecimal(salida.repercutido_contabilizado),
    diferencia_repercutido: aDecimal(salida.diferencia_repercutido),
    soportado_en_facturas: aDecimal(salida.soportado_en_facturas),
    soportado_contabilizado: aDecimal(salida.soportado_contabilizado),
    diferencia_soportado: aDecimal(salida.diferencia_soportado),
    cuadra: salida.cuadra,
    tolerancia: aDecimal(salida.tolerancia),
    limites: salida.limites,
  }
}
