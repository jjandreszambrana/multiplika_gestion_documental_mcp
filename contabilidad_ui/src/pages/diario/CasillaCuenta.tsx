import { Autocomplete } from '@mantine/core'
import { useMemo } from 'react'
import type { CuentaPlan } from '../../api/plan'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { codigoDeOpcion, expandirCuenta, SEPARADOR_DE_OPCION } from '../../lib/cuenta'

interface Props {
  valor: string
  ancho: number
  alCambiar: (valor: string) => void
  /**
   * Se llama al elegir «Crear la cuenta…», con el código ya expandido. Sin
   * esto no se ofrece dar de alta: en un filtro no hay nada que crear.
   */
  alCrear?: (codigo: string) => void
  /** Rótulo encima. En la línea de un asiento va la cabecera de la columna. */
  label?: string
  /** `xs` en la tabla del diario, donde la fila va apretada. */
  size?: 'xs' | 'sm'
}

/** Tope de sugerencias: más de esto no se lee, se teclea otra letra. */
const MAXIMO = 12

const CREAR = 'Crear la cuenta '

function etiqueta(cuenta: CuentaPlan): string {
  return `${cuenta.codigo}${SEPARADOR_DE_OPCION}${cuenta.descripcion ?? ''}`
}

/**
 * La casilla de cuenta de una línea, con las coincidencias del plan que ya está
 * en memoria: se busca por número y por título sin esperar a ninguna llamada.
 *
 * Solo se ofrecen las que admiten apuntes, que son las únicas que puede llevar
 * una línea. Y si lo tecleado no existe, la última opción da de alta la cuenta
 * sin salir del asiento.
 */
export default function CasillaCuenta({
  valor,
  ancho,
  alCambiar,
  alCrear,
  label,
  size = 'xs',
}: Props) {
  const plan = usePlanEnMemoria()

  const opciones = useMemo(() => {
    const buscado = valor.trim().toLowerCase()
    if (buscado === '') return []

    const encontradas: string[] = []
    for (const cuenta of plan.porCodigo.values()) {
      if (!cuenta.auxiliar) continue
      const codigo = cuenta.codigo.toLowerCase()
      const titulo = (cuenta.descripcion ?? '').toLowerCase()
      if (codigo.startsWith(buscado) || titulo.includes(buscado)) {
        encontradas.push(etiqueta(cuenta))
        if (encontradas.length >= MAXIMO) break
      }
    }

    if (alCrear === undefined) return encontradas

    const expandido = expandirCuenta(valor, ancho)
    const existe = plan.porCodigo.has(expandido)
    return existe ? encontradas : [...encontradas, `${CREAR}${expandido}…`]
  }, [valor, ancho, plan, alCrear])

  function elegir(elegido: string) {
    if (elegido.startsWith(CREAR)) {
      alCrear?.(elegido.slice(CREAR.length).replace('…', ''))
      return
    }
    alCambiar(codigoDeOpcion(elegido))
  }

  return (
    <Autocomplete
      size={size}
      label={label}
      value={valor}
      data={opciones}
      // Elegir «Crear la cuenta…» también avisa por aquí, y ese texto no es un
      // código: lo trata `onOptionSubmit` y aquí se ignora.
      onChange={(nuevo) => !nuevo.startsWith(CREAR) && alCambiar(codigoDeOpcion(nuevo))}
      onOptionSubmit={elegir}
      onBlur={() => alCambiar(expandirCuenta(valor, ancho))}
      comboboxProps={{ width: 320, position: 'bottom-start' }}
      styles={{ input: { fontFamily: 'monospace' } }}
      // Las coincidencias ya están elegidas arriba, por número y por título: si
      // Mantine vuelve a filtrar aquí, lo buscado por título se pierde.
      filter={({ options }) => options}
    />
  )
}
