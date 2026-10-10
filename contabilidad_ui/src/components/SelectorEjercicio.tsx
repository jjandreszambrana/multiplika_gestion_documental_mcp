import { Select } from '@mantine/core'
import { motivoBloqueo, type Ejercicio } from '../api/sesion'

interface Props {
  ejercicios: Ejercicio[]
  elegido: number | null
  alElegir: (ejercicio: number) => void
}

/** El ejercicio viaja en casi todas las llamadas del módulo. */
export default function SelectorEjercicio({ ejercicios, elegido, alElegir }: Props) {
  const opciones = ejercicios.map((e) => {
    const bloqueo = motivoBloqueo(e)
    return {
      value: String(e.ejercicio),
      label: bloqueo ? `${e.ejercicio} · ${bloqueo}` : String(e.ejercicio),
    }
  })

  return (
    <Select
      aria-label="Ejercicio"
      data={opciones}
      value={elegido === null ? null : String(elegido)}
      onChange={(valor) => valor && alElegir(Number(valor))}
      allowDeselect={false}
      w={160}
    />
  )
}
