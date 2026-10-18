import type { DatosEquivalencia, EquivalenciaCuenta } from '../../api/diarioB'
import { claveSubcuenta } from './sumasDiarioB'

/** Lo que se teclea en el formulario de una equivalencia. */
export interface ValoresEquivalencia {
  cuenta_origen: string
  titulo_origen: string
  cuenta_destino: string
  titulo_destino: string
  observaciones: string
  flag: number
}

export function valoresDe(equivalencia: EquivalenciaCuenta | null): ValoresEquivalencia {
  return {
    cuenta_origen: equivalencia?.cuenta_origen ?? '',
    titulo_origen: equivalencia?.titulo_origen ?? '',
    cuenta_destino: equivalencia?.cuenta_destino ?? '',
    titulo_destino: equivalencia?.titulo_destino ?? '',
    observaciones: equivalencia?.observaciones ?? '',
    flag: equivalencia?.flag ?? 0,
  }
}

/**
 * Lo que se manda al guardar: en un alta, todo; al editar, solo lo que cambia,
 * Flag incluido. Los textos van sin espacios de sobra.
 */
export function datosAEnviar(
  equivalencia: EquivalenciaCuenta | null,
  valores: ValoresEquivalencia,
): DatosEquivalencia {
  const { flag, ...textos } = valores
  const limpios = Object.fromEntries(
    Object.entries(textos).map(([campo, valor]) => [campo, (valor ?? '').trim()]),
  ) as Omit<ValoresEquivalencia, 'flag'>
  if (!equivalencia) return { ...limpios, flag }
  const datos: DatosEquivalencia = Object.fromEntries(
    Object.entries(limpios).filter(
      ([campo, valor]) => (equivalencia[campo as keyof typeof limpios] ?? '') !== valor,
    ),
  )
  if (flag !== equivalencia.flag) datos.flag = flag
  return datos
}

/**
 * Las «deshermanadas»: las que no tienen cuenta de destino. El SIF no filtra
 * por eso, así que se filtra aquí.
 */
export function soloSinDestino(equivalencias: EquivalenciaCuenta[]): EquivalenciaCuenta[] {
  return equivalencias.filter((e) => (e.cuenta_destino ?? '').trim() === '')
}

/** Una cuenta de destino que ya tiene una equivalencia, y de qué cuenta viene. */
export interface DestinoUsado {
  destino: string
  origen: string
}

/** Los destinos ya usados, sin la equivalencia que se está editando. */
export function destinosUsados(
  equivalencias: EquivalenciaCuenta[],
  sinLaDe: number | null,
): DestinoUsado[] {
  return equivalencias
    .filter((e) => e.id !== sinLaDe)
    .map((e) => ({ destino: (e.cuenta_destino ?? '').trim(), origen: (e.cuenta_origen ?? '').trim() }))
}

const ES_SUBCUENTA = /^\d{6,}$/

/**
 * La cuenta de origen de la equivalencia que ya lleva a `codigo`, o nula si
 * está libre. Una cuenta de destino solo puede serlo de una equivalencia. Se
 * compara tal cual y por `claveSubcuenta`: 10000001 y 100000001 son la misma.
 */
export function yaAsignadaA(codigo: string, usados: DestinoUsado[]): string | null {
  const buscado = (codigo ?? '').trim()
  if (buscado === '') return null
  const clave = ES_SUBCUENTA.test(buscado) ? claveSubcuenta(buscado) : null
  const usado = usados.find(
    (u) =>
      u.destino === buscado ||
      (clave !== null && ES_SUBCUENTA.test(u.destino) && claveSubcuenta(u.destino) === clave),
  )
  return usado?.origen ?? null
}
