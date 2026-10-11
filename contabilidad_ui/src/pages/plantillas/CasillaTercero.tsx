import { Autocomplete } from '@mantine/core'
import { useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { listarTerceros } from '../../api/terceros'
import { codigoDeOpcion, SEPARADOR_DE_OPCION } from '../../lib/cuenta'

interface Props {
  label?: string
  description?: string
  required?: boolean
  error?: string
  size?: 'xs' | 'sm'
  /** La subcuenta del cliente o proveedor. */
  valor: string
  alCambiar: (subcuenta: string) => void
}

const MAXIMO = 12
const ESPERA_MS = 250

/**
 * Un cliente o un proveedor, buscado por subcuenta, razón social o NIF. Lo que
 * queda en la casilla es su subcuenta, que es lo que la plantilla necesita.
 */
export default function CasillaTercero({ valor, alCambiar, error, ...resto }: Props) {
  const [opciones, setOpciones] = useState<string[]>([])
  const [falloBusqueda, setFalloBusqueda] = useState<string | null>(null)

  useEffect(() => {
    const buscado = valor.trim()
    if (buscado === '') {
      setOpciones([])
      return
    }
    let vigente = true
    const espera = setTimeout(() => {
      listarTerceros({ tipo: null, texto: buscado, offset: 0, limit: MAXIMO })
        .then((r) => {
          if (!vigente) return
          setFalloBusqueda(null)
          setOpciones(
            (r.terceros ?? []).map((t) => `${t.cuenta}${SEPARADOR_DE_OPCION}${t.razon ?? ''}`),
          )
        })
        .catch((fallo: unknown) => {
          if (!vigente) return
          setOpciones([])
          setFalloBusqueda(textoDeError(fallo))
        })
    }, ESPERA_MS)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [valor])

  return (
    <Autocomplete
      {...resto}
      error={error ?? falloBusqueda ?? undefined}
      value={valor}
      data={opciones}
      onChange={(nuevo) => alCambiar(codigoDeOpcion(nuevo))}
      filter={({ options }) => options}
      comboboxProps={{ width: 360, position: 'bottom-start' }}
    />
  )
}
