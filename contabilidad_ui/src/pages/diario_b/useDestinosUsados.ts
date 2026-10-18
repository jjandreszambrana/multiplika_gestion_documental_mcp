import { useEffect, useState } from 'react'
import { equivalenciasEnteras } from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import { destinosUsados, type DestinoUsado } from './datosEquivalencia'

/**
 * Las cuentas que ya son destino de alguna equivalencia, sin la que se está
 * editando. Se piden todas al abrir el diálogo. Si falla, `error` lo dice y la
 * lista queda vacía: el SIF sigue siendo quien decide al guardar.
 */
export function useDestinosUsados(sinLaDe: number | null): {
  usados: DestinoUsado[]
  error: string | null
} {
  const [usados, setUsados] = useState<DestinoUsado[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const corte = new AbortController()
    equivalenciasEnteras(corte.signal)
      .then((todas) => setUsados(destinosUsados(todas, sinLaDe)))
      .catch((fallo: unknown) => {
        if (!corte.signal.aborted) setError(textoDeError(fallo))
      })
    return () => corte.abort()
  }, [sinLaDe])

  return { usados, error }
}
