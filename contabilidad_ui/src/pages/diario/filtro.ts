import Decimal from 'decimal.js'
import { formatearFecha } from '../../lib/format'
import { fechaParaApi } from '../../lib/fecha'
import type { Incluir } from '../../api/asientos'

/**
 * Lo que decide qué asientos se ven. Es lo que viaja a `/asientos/listar` y a
 * `/asientos/totales`, que aceptan los mismos campos: si se separasen, el pie
 * de sumas diría una cifra distinta de lo que se está viendo.
 *
 * Las fechas van en `aaaa-mm-dd` y los importes como cadena decimal. Todo vacío
 * significa «sin esa condición»; la clave no llega a viajar.
 */
export interface Filtro {
  cuenta: string
  desde: string
  hasta: string
  incluir: Incluir
  diario: string
  concepto: string
  documento: string
  /** Texto del nombre de quien creó el asiento. */
  usuario: string
  /** Texto del nombre de quien lo cambió por última vez. */
  usuarioModif: string
  asientoDesde: string
  asientoHasta: string
  importeDesde: string
  importeHasta: string
}

export const SIN_CONDICIONES: Omit<Filtro, 'desde' | 'hasta' | 'incluir'> = {
  cuenta: '',
  diario: '',
  concepto: '',
  documento: '',
  usuario: '',
  usuarioModif: '',
  asientoDesde: '',
  asientoHasta: '',
  importeDesde: '',
  importeHasta: '',
}

const ROTULO_INCLUIR: Record<Incluir, string> = {
  confirmadas: 'confirmadas',
  borradores: 'borradores',
  todas: 'todas',
}

/**
 * El día por el que se abre el diario: hoy si se está en el ejercicio en curso,
 * y si no, el último día de ese ejercicio, que es donde está el trabajo.
 */
export function diaDeEntrada(ejercicio: number | null, cierre: string | null): string {
  const hoy = new Date()
  if (ejercicio === null || ejercicio === hoy.getFullYear()) return fechaParaApi(hoy)
  return cierre ? cierre.slice(0, 10) : ''
}

export function filtroDeEntrada(ejercicio: number | null, cierre: string | null): Filtro {
  const dia = diaDeEntrada(ejercicio, cierre)
  return { ...SIN_CONDICIONES, desde: dia, hasta: dia, incluir: 'confirmadas' }
}

/**
 * Lo que se está viendo, dicho en una línea junto al botón. Sin esto habría que
 * abrir el diálogo para saber por qué la lista tiene las filas que tiene.
 */
export function resumenDeFiltro(filtro: Filtro): string {
  const hoy = fechaParaApi(new Date())
  const partes: string[] = []

  if (filtro.desde && filtro.desde === filtro.hasta) {
    partes.push(filtro.desde === hoy ? 'Hoy' : formatearFecha(filtro.desde))
  } else if (filtro.desde && filtro.hasta) {
    partes.push(`${formatearFecha(filtro.desde)} – ${formatearFecha(filtro.hasta)}`)
  } else if (filtro.desde) {
    partes.push(`desde ${formatearFecha(filtro.desde)}`)
  } else if (filtro.hasta) {
    partes.push(`hasta ${formatearFecha(filtro.hasta)}`)
  } else {
    partes.push('Todo el ejercicio')
  }

  if (filtro.cuenta) partes.push(`cuenta ${filtro.cuenta}`)
  if (filtro.diario) partes.push(`diario ${filtro.diario}`)
  if (filtro.concepto) partes.push(`concepto «${filtro.concepto}»`)
  if (filtro.documento) partes.push(`documento «${filtro.documento}»`)
  if (filtro.usuario) partes.push(`creado por «${filtro.usuario}»`)
  if (filtro.usuarioModif) partes.push(`cambiado por «${filtro.usuarioModif}»`)
  if (filtro.asientoDesde && filtro.asientoDesde === filtro.asientoHasta) {
    partes.push(`asiento ${filtro.asientoDesde}`)
  } else if (filtro.asientoDesde || filtro.asientoHasta) {
    partes.push(`asientos ${filtro.asientoDesde || '…'}–${filtro.asientoHasta || '…'}`)
  }
  if (filtro.importeDesde || filtro.importeHasta) {
    partes.push(`importe ${filtro.importeDesde || '…'}–${filtro.importeHasta || '…'}`)
  }
  partes.push(ROTULO_INCLUIR[filtro.incluir])

  return partes.join(' · ')
}

/** Número de asiento: solo dígitos, para que no viaje una letra a la API. */
export function soloDigitos(texto: string): string {
  return (texto ?? '').replace(/\D/g, '')
}

/**
 * Lo leído del navegador, completado con lo que falte.
 *
 * Un filtro guardado antes de que existieran los siete campos nuevos no los
 * trae, y el componente reventaba al llegar a esas casillas. Se completa aquí,
 * en un solo sitio, y se descarta lo que no sea texto: en el navegador puede
 * haber cualquier cosa de una versión anterior.
 */
export function normalizarFiltro(leido: unknown, porDefecto: Filtro): Filtro {
  if (typeof leido !== 'object' || leido === null) return porDefecto
  const guardado = leido as Record<string, unknown>
  const texto = (clave: keyof Filtro): string =>
    typeof guardado[clave] === 'string' ? (guardado[clave] as string) : porDefecto[clave]

  const incluir = guardado.incluir
  return {
    cuenta: texto('cuenta'),
    desde: texto('desde'),
    hasta: texto('hasta'),
    incluir:
      incluir === 'confirmadas' || incluir === 'borradores' || incluir === 'todas'
        ? incluir
        : porDefecto.incluir,
    diario: texto('diario'),
    concepto: texto('concepto'),
    documento: texto('documento'),
    usuario: texto('usuario'),
    usuarioModif: texto('usuarioModif'),
    asientoDesde: texto('asientoDesde'),
    asientoHasta: texto('asientoHasta'),
    importeDesde: texto('importeDesde'),
    importeHasta: texto('importeHasta'),
  }
}

/**
 * Un importe tecleado en español (`1.234,56`) a la cadena decimal que espera la
 * API (`"1234.56"`). Si lo escrito no es un número, se queda vacío y ese
 * extremo del filtro no viaja: mandarlo daría un 422, que es un fallo nuestro.
 */
export function importeParaApi(texto: string): string {
  const limpio = (texto ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (limpio === '') return ''
  try {
    return new Decimal(limpio).toString()
  } catch {
    return ''
  }
}
