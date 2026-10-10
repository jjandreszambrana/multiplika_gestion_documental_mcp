import { Autocomplete } from '@mantine/core'
import { useMemo } from 'react'
import type { CuentaPlan } from '../api/plan'
import { usePlanEnMemoria } from './PlanEnMemoria'
import { codigoDeOpcion, expandirCuenta, SEPARADOR_DE_OPCION } from '../lib/cuenta'

interface Props {
  id: string
  /** Rótulo encima. En la configuración va fuera, así que puede no venir. */
  label?: string
  obligatoria: boolean
  valor: string
  /** Dígitos de una cuenta de apuntes en esta empresa. */
  ancho: number
  alCambiar: (valor: string) => void
  /** Se llama al elegir «Crear la cuenta…», con el código ya expandido. */
  alCrear: (codigo: string) => void
  /** Para el campo que no se puede tocar, como los que la API rechaza. */
  deshabilitada?: boolean
}

/** Tope de sugerencias: más de esto no se lee, se teclea otra cifra. */
const MAXIMO = 12

const CREAR = 'Crear la cuenta '

function etiqueta(cuenta: CuentaPlan): string {
  return `${cuenta.codigo}${SEPARADOR_DE_OPCION}${cuenta.descripcion ?? ''}`
}

/**
 * La casilla de una cuenta por defecto, con las coincidencias del plan que ya
 * está en memoria: se busca por número y por título sin esperar a ninguna
 * llamada.
 *
 * Se ofrecen todas las cuentas del plan, de mayor y de apuntes, porque aquí van
 * las dos cosas. Y si lo tecleado no existe, la última opción la da de alta sin
 * salir de la configuración.
 */
export default function CasillaDeCuenta({
  id,
  label,
  obligatoria,
  valor,
  ancho,
  alCambiar,
  alCrear,
  deshabilitada,
}: Props) {
  const plan = usePlanEnMemoria()

  const opciones = useMemo(() => {
    const buscado = valor.trim().toLowerCase()
    if (buscado === '') return []

    const encontradas: string[] = []
    for (const cuenta of plan.porCodigo.values()) {
      const codigo = cuenta.codigo.toLowerCase()
      const titulo = (cuenta.descripcion ?? '').toLowerCase()
      if (codigo.startsWith(buscado) || titulo.includes(buscado)) {
        encontradas.push(etiqueta(cuenta))
        if (encontradas.length >= MAXIMO) break
      }
    }

    const expandido = expandirCuenta(valor, ancho)
    const existe = plan.porCodigo.has(expandido)
    return existe ? encontradas : [...encontradas, `${CREAR}${expandido}…`]
  }, [valor, ancho, plan])

  return (
    <Autocomplete
      id={id}
      label={label}
      required={obligatoria}
      disabled={deshabilitada}
      value={valor}
      data={opciones}
      // Las coincidencias ya están elegidas arriba: si vuelve a filtrar aquí,
      // lo buscado por título se pierde.
      filter={({ options }) => options}
      // Al elegir «Crear la cuenta…» la casilla recibe también ese texto: no
      // es un código y no se escribe.
      // Lo tecleado no se filtra a dígitos: así se puede buscar «caja» por el
      // título. Solo se corta el título cuando se acepta una opción.
      onChange={(nuevo) => !nuevo.startsWith(CREAR) && alCambiar(codigoDeOpcion(nuevo))}
      onOptionSubmit={(elegido) =>
        elegido.startsWith(CREAR)
          ? alCrear(elegido.slice(CREAR.length).replace('…', ''))
          : alCambiar(codigoDeOpcion(elegido))
      }
      // El punto se rellena con ceros al salir del campo, para que se vea el
      // código resultante antes de guardarlo.
      onBlur={() => alCambiar(expandirCuenta(valor, ancho))}
      comboboxProps={{ width: 320, position: 'bottom-end' }}
    />
  )
}
