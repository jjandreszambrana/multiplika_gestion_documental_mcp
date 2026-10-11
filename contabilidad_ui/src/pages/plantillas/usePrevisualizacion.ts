import { useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import {
  falloDePlantilla,
  previsualizar,
  type ErrorCampo,
  type Fuente,
  type Parametro,
  type Previsualizacion,
  type ValoresPlantilla,
} from '../../api/plantillas'
import { valoresIniciales, valoresParaEnviar, type ValorDato } from './valores'

/** Lo que se espera desde la última tecla antes de pedir el cálculo. */
const ESPERA_MS = 300

export interface EstadoPrevisualizacion {
  valores: Record<string, ValorDato>
  tocados: ReadonlySet<string>
  cambiar: (clave: string, valor: ValorDato) => void
  previa: Previsualizacion | null
  /** No se pudo calcular: la red, o la plantilla está rota. */
  errorPrevia: string | null
  /** Hay cambios que todavía no ha calculado el servidor. */
  pendiente: boolean
  /** Lo que hay que mandar al servidor, para grabar. */
  paraEnviar: () => ValoresPlantilla
  /** Pone los errores que devuelve el servidor al grabar, en su sitio. */
  fijarErrores: (errores: ErrorCampo[]) => void
}

/** Los mensajes de una plantilla rota, en un solo texto. */
function textoDeDefinicionRota(fallo: unknown): string {
  const deLaPlantilla = falloDePlantilla(fallo)
  if (deLaPlantilla?.clave !== 'plantilla_definicion' || deLaPlantilla.errores.length === 0)
    return textoDeError(fallo)
  return [textoDeError(fallo), ...deLaPlantilla.errores.map((e) => e.mensaje)].join(
    '\n',
  )
}

/**
 * Los datos tecleados y su cálculo. Cada cambio se manda a calcular, esperando
 * a que se deje de teclear, y lo que estaba en camino se corta. La pantalla no
 * resuelve nada: defectos, qué se ve e importes llegan del servidor.
 *
 * `fuente` nula = todavía no hay plantilla. Al cambiar `llave` se empieza de cero.
 */
export function usePrevisualizacion(
  fuente: Fuente | null,
  parametros: Parametro[],
  llave: string,
): EstadoPrevisualizacion {
  const [valores, setValores] = useState<Record<string, ValorDato>>({})
  const [tocados, setTocados] = useState<ReadonlySet<string>>(new Set())
  const [previa, setPrevia] = useState<Previsualizacion | null>(null)
  const [errorPrevia, setErrorPrevia] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState(false)

  useEffect(() => {
    setValores(valoresIniciales(parametros))
    setTocados(new Set())
    setPrevia(null)
    setErrorPrevia(null)
    // Solo al cambiar de plantilla: los parámetros vienen con ella.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llave])

  const enviar = useMemo(
    () => valoresParaEnviar(parametros, valores, tocados),
    [parametros, valores, tocados],
  )

  useEffect(() => {
    if (fuente === null) return
    setPendiente(true)
    const control = new AbortController()
    const espera = setTimeout(() => {
      previsualizar(fuente, enviar, control.signal)
        .then((r) => {
          setPrevia(r)
          setErrorPrevia(null)
          setPendiente(false)
        })
        .catch((fallo: unknown) => {
          if (esAbortada(fallo)) return
          setPrevia(null)
          setErrorPrevia(textoDeDefinicionRota(fallo))
          setPendiente(false)
        })
    }, ESPERA_MS)
    return () => {
      clearTimeout(espera)
      control.abort()
    }
  }, [fuente, enviar])

  return {
    valores,
    tocados,
    cambiar: (clave, valor) => {
      setValores((actual) => ({ ...actual, [clave]: valor }))
      setTocados((actual) => (actual.has(clave) ? actual : new Set(actual).add(clave)))
    },
    previa,
    errorPrevia,
    pendiente,
    paraEnviar: () => enviar,
    fijarErrores: (errores) =>
      setPrevia((actual) => (actual === null ? actual : { ...actual, errores, valido: false })),
  }
}
