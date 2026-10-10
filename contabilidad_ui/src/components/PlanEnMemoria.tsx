import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { textoDeError } from '../api/errores'
import { listarPlan, MAXIMO_POR_PAGINA, type CuentaPlan } from '../api/plan'

interface Plan {
  /** Todas las cuentas del ejercicio, por código. Vacío mientras se carga. */
  porCodigo: Map<string, CuentaPlan>
  listo: boolean
  /** Si la precarga falló, quien la use pregunta al servidor cuenta a cuenta. */
  error: string | null
  /** Se llama después de crear, cambiar o borrar una cuenta. */
  refrescar: () => void
}

const Contexto = createContext<Plan | null>(null)

/** Tope de vueltas, para que un `total` raro no deje el navegador dando vueltas. */
const MAXIMO_PAGINAS = 50

async function cargarTodo(ejercicio: number | null): Promise<CuentaPlan[]> {
  const todas: CuentaPlan[] = []
  for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina += 1) {
    const respuesta = await listarPlan({
      ejercicio,
      texto: '',
      soloAuxiliares: false,
      // Sin las apartadas a propósito: de aquí salen los escalones que se
      // ofrecen al teclear una cuenta, y una cuenta apartada no se ofrece.
      incluirApartadas: false,
      offset: pagina * MAXIMO_POR_PAGINA,
      limit: MAXIMO_POR_PAGINA,
    })
    todas.push(...(respuesta.cuentas ?? []))
    if (todas.length >= respuesta.total || (respuesta.cuentas ?? []).length === 0) break
  }
  return todas
}

/**
 * El plan entero en memoria, traído de fondo al entrar en la empresa. Son
 * pocos cientos de cuentas y caben de sobra; a cambio, teclear un número de
 * cuenta no espera a ninguna llamada.
 *
 * Se vuelve a traer al cambiar de ejercicio y cada vez que una pantalla crea,
 * cambia o borra una cuenta. La empresa no hace falta vigilarla: al conmutar,
 * el armazón entero se vuelve a montar.
 */
export function ProveedorPlan({
  ejercicio,
  children,
}: {
  ejercicio: number | null
  children: ReactNode
}) {
  const [porCodigo, setPorCodigo] = useState<Map<string, CuentaPlan>>(new Map())
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)

  const refrescar = useCallback(() => setVuelta((n) => n + 1), [])

  useEffect(() => {
    let vigente = true
    setListo(false)
    setError(null)

    cargarTodo(ejercicio)
      .then((cuentas) => {
        if (!vigente) return
        setPorCodigo(new Map(cuentas.map((c) => [c.codigo, c])))
        setListo(true)
      })
      .catch((fallo: unknown) => {
        if (!vigente) return
        setPorCodigo(new Map())
        setError(textoDeError(fallo))
      })

    return () => {
      vigente = false
    }
  }, [ejercicio, vuelta])

  return (
    <Contexto.Provider value={{ porCodigo, listo, error, refrescar }}>{children}</Contexto.Provider>
  )
}

export function usePlanEnMemoria(): Plan {
  const plan = useContext(Contexto)
  if (plan === null) throw new Error('usePlanEnMemoria fuera de ProveedorPlan')
  return plan
}
