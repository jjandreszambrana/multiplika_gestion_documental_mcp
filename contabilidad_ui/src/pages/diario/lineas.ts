import Decimal from 'decimal.js'
import type { LineaBorradorApi, LineaParaEnviar } from '../../api/borradores'
import { aDecimal } from '../../lib/dinero'

/**
 * Una línea mientras se teclea. Los importes viven como el texto que la persona
 * ha escrito, no como número: convertirlos a cada pulsación estropearía lo que
 * está escribiendo. Se pasan a `Decimal` para sumar y a cadena para enviar.
 */
export interface LineaEnEdicion {
  /** Identifica la fila mientras se edita; no viaja a la API. */
  clave: number
  cuenta: string
  concepto: string
  documento: string
  debe: string
  haber: string
}

let siguienteClave = 1

export function lineaVacia(): LineaEnEdicion {
  siguienteClave += 1
  return { clave: siguienteClave, cuenta: '', concepto: '', documento: '', debe: '', haber: '' }
}

/** Lo que devuelve la API, listo para editar. */
export function desdeApi(lineas: LineaBorradorApi[]): LineaEnEdicion[] {
  return lineas.map((linea) => {
    siguienteClave += 1
    return {
      clave: siguienteClave,
      cuenta: linea.cuenta,
      concepto: linea.concepto,
      documento: linea.documento,
      debe: linea.debe ?? '',
      haber: linea.haber ?? '',
    }
  })
}

/**
 * Un importe tecleado a `Decimal`. El contable escribe con coma; se admiten
 * las dos y lo que no sea un número cuenta como cero, que es lo que se ve en
 * el descuadre mientras la línea está a medio escribir.
 */
export function importeTecleado(texto: string): Decimal {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return new Decimal(0)
  try {
    return aDecimal(limpio)
  } catch {
    return new Decimal(0)
  }
}

/** Importe listo para la API: cadena con punto, o nulo si la casilla está vacía. */
function paraApi(texto: string): string | null {
  const limpio = texto.trim().replace(',', '.')
  return limpio === '' ? null : limpio
}

export function paraEnviar(lineas: LineaEnEdicion[]): LineaParaEnviar[] {
  return lineas.map((linea) => ({
    cuenta: linea.cuenta.trim(),
    debe: paraApi(linea.debe),
    haber: paraApi(linea.haber),
    concepto: linea.concepto.trim(),
    documento: linea.documento.trim(),
    id_obra: 0,
  }))
}

export interface Totales {
  debe: Decimal
  haber: Decimal
  diferencia: Decimal
  cuadra: boolean
}

/**
 * Los totales de las dos columnas que se están viendo, para que el descuadre se
 * note al teclear y no al guardar. Es un aviso: quien decide si un asiento
 * cuadra es el servidor al confirmarlo.
 */
export function totalesDe(lineas: LineaEnEdicion[]): Totales {
  const debe = lineas.reduce((suma, l) => suma.plus(importeTecleado(l.debe)), new Decimal(0))
  const haber = lineas.reduce((suma, l) => suma.plus(importeTecleado(l.haber)), new Decimal(0))
  const diferencia = debe.minus(haber)
  return { debe, haber, diferencia, cuadra: diferencia.isZero() }
}

/** Una línea cuenta como escrita si tiene cuenta o algún importe. */
export function tieneAlgo(linea: LineaEnEdicion): boolean {
  return linea.cuenta.trim() !== '' || linea.debe.trim() !== '' || linea.haber.trim() !== ''
}

/**
 * Qué le falta a la primera línea escrita a medias, o `null` si están todas
 * completas. Las que están del todo en blanco no cuentan: no se envían.
 *
 * Aquí no se decide si el asiento cuadra ni si una cuenta existe: eso lo dice
 * el servidor. Solo se mira que lo que se ha empezado a escribir esté entero.
 */
export function loQueFalta(lineas: LineaEnEdicion[]): string | null {
  for (const [indice, linea] of lineas.entries()) {
    if (!tieneAlgo(linea)) continue
    const numero = indice + 1
    if (linea.cuenta.trim() === '') {
      return `La línea ${numero} está a medias: le falta la cuenta.`
    }
    if (linea.debe.trim() === '' && linea.haber.trim() === '') {
      return `La línea ${numero} está a medias: le falta el importe, al debe o al haber.`
    }
  }
  return null
}
