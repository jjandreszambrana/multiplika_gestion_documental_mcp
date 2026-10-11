import { createContext, useContext } from 'react'
import type { Catalogo } from '../../../api/plantillas'

export interface Formulas {
  catalogo: Catalogo | null
  /** Claves de los datos y de los cálculos, para sugerirlas al escribir. */
  nombres: string[]
}

export const ContextoFormulas = createContext<Formulas>({ catalogo: null, nombres: [] })

export function useFormulas(): Formulas {
  return useContext(ContextoFormulas)
}
