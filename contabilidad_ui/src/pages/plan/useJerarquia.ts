import { useEffect, useState } from 'react'
import { ErrorApi } from '../../api/errores'
import { obtenerCuenta } from '../../api/plan'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'

/** Un ancestro del código que se está tecleando: 1, 2, 3 y 4 dígitos. */
export interface Escalon {
  codigo: string
  /** null si esa cuenta todavía no está en el plan de la empresa. */
  descripcion: string | null
}

const DIGITOS_DE_MAYOR = 4
const ESPERA_TECLEO_MS = 300

function prefijos(codigo: string): string[] {
  const digitos = codigo.replace(/\D/g, '')
  // Desde el primer dígito: uno es el grupo, dos el subgrupo, y así hasta la
  // cuenta de mayor. Nunca más allá, que ya es la subcuenta que se teclea.
  const hasta = Math.min(DIGITOS_DE_MAYOR, digitos.length)
  const salida: string[] = []
  for (let n = 1; n <= hasta; n += 1) salida.push(digitos.slice(0, n))
  return salida
}

/**
 * Dónde va a quedar anidada la cuenta que se teclea: el grupo, el subgrupo y la
 * cuenta de mayor de los que cuelga, con sus títulos.
 *
 * Con el plan en memoria se resuelve al instante y sin llamar a nadie. Solo si
 * la precarga falló se pregunta al servidor cuenta a cuenta; ahí un 404 no es
 * un fallo, significa que ese escalón no existe todavía.
 */
export function useJerarquia(codigo: string, ejercicio: number | null) {
  const plan = usePlanEnMemoria()
  const [delServidor, setDelServidor] = useState<Escalon[]>([])
  const [error, setError] = useState<string | null>(null)

  const codigos = prefijos(codigo)
  const enMemoria = plan.listo

  useEffect(() => {
    if (enMemoria || codigos.length === 0) {
      setDelServidor([])
      setError(null)
      return
    }

    let vigente = true
    const espera = setTimeout(() => {
      Promise.all(
        codigos.map((c) =>
          obtenerCuenta(c, ejercicio)
            .then((cuenta): Escalon => ({ codigo: c, descripcion: cuenta.descripcion ?? '' }))
            .catch((fallo: unknown): Escalon => {
              if (fallo instanceof ErrorApi && fallo.estado === 404) {
                return { codigo: c, descripcion: null }
              }
              throw fallo
            }),
        ),
      )
        .then((leidos) => {
          if (!vigente) return
          setDelServidor(leidos)
          setError(null)
        })
        .catch(() => {
          if (!vigente) return
          setDelServidor([])
          setError('No se pudo comprobar dónde encaja esta cuenta.')
        })
    }, ESPERA_TECLEO_MS)

    return () => {
      vigente = false
      clearTimeout(espera)
    }
    // codigos se rehace en cada render: lo que importa es el texto tecleado.
  }, [codigo, ejercicio, enMemoria]) // eslint-disable-line react-hooks/exhaustive-deps

  const escalones: Escalon[] = enMemoria
    ? codigos.map((c) => ({ codigo: c, descripcion: plan.porCodigo.get(c)?.descripcion ?? null }))
    : delServidor

  /** La cuenta existente más honda de la que cuelga: es la raíz del alta. */
  const raiz = escalones.filter((e) => e.descripcion !== null).at(-1)?.codigo ?? null

  return { escalones, raiz, error }
}
