import type { DatosEquivalencia, EquivalenciaCuenta } from '../../api/diarioB'

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
    Object.entries(textos).map(([campo, valor]) => [campo, valor.trim()]),
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
