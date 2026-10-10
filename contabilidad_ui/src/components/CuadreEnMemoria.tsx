import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { textoDeError } from '../api/errores'
import { revisarCuadre, type RespuestaRevisar } from '../api/sincronizacion'

interface Cuadre {
  revision: RespuestaRevisar | null
  cargando: boolean
  error: string | null
  refrescar: () => void
}

const Contexto = createContext<Cuadre | null>(null)

/**
 * La revisión del cuadre con gestión, hecha una vez al entrar en la empresa y
 * de fondo. Solo lee, así que no molesta a nadie; si algo no cuadra, el menú lo
 * enseña con un número y quien quiera entra a mirarlo.
 *
 * No se repite sola: se rehace al conmutar de empresa, porque el armazón se
 * remonta, y cuando la pantalla crea las cuentas que faltaban.
 */
export function ProveedorCuadre({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState<RespuestaRevisar | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)

  const refrescar = useCallback(() => setVuelta((n) => n + 1), [])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)

    revisarCuadre()
      .then((leida) => vigente && setRevision(leida))
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
  }, [vuelta])

  return (
    <Contexto.Provider value={{ revision, cargando, error, refrescar }}>
      {children}
    </Contexto.Provider>
  )
}

export function useCuadre(): Cuadre {
  const cuadre = useContext(Contexto)
  if (cuadre === null) throw new Error('useCuadre fuera de ProveedorCuadre')
  return cuadre
}
