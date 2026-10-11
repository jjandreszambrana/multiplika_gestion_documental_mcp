import { Autocomplete, Text } from '@mantine/core'
import { useMemo } from 'react'
import { usePlanEnMemoria } from '../../../components/PlanEnMemoria'
import { SEPARADOR_DE_OPCION } from '../../../lib/cuenta'
import { useFormulas } from './ContextoFormulas'
import { funcionAbierta, palabraFinal } from './formulas'

interface Props {
  valor: string | null | undefined
  alCambiar: (valor: string) => void
  label?: string
  placeholder?: string
  errores?: string[]
  size?: 'xs' | 'sm'
  /** Nombres que solo valen aquí, como `fila` e `indice` en una línea repetida. */
  extra?: string[]
  /** Sin rótulo, dentro de una celda: el `aria-label` dice qué es. */
  ariaLabel?: string
  readOnly?: boolean
  /** Nota aclaratoria debajo; mientras se escribe una función, se ve su firma en su lugar. */
  nota?: string
}

const MAXIMO = 10

/**
 * La casilla de una fórmula. Al escribir sugiere las funciones del servidor,
 * los datos y cálculos de la plantilla y, si se teclea un número, las
 * subcuentas del plan (que se escriben entre comillas). Mientras se rellenan
 * los argumentos de una función, enseña cómo se usa.
 */
export default function CasillaFormula({
  valor,
  alCambiar,
  label,
  placeholder,
  errores,
  size = 'xs',
  extra = [],
  ariaLabel,
  readOnly,
  nota,
}: Props) {
  const { catalogo, nombres } = useFormulas()
  const plan = usePlanEnMemoria()
  const texto = valor ?? ''

  // Cada sugerencia es la fórmula entera tal y como quedaría; al pintarla se
  // enseña solo lo que se añade.
  const sugerencias = useMemo(() => {
    const palabra = palabraFinal(texto)
    if (palabra === '') return new Map<string, string>()
    const antes = texto.slice(0, texto.length - palabra.length)
    const salida = new Map<string, string>()
    if (/^\d+$/.test(palabra)) {
      for (const cuenta of plan.porCodigo.values()) {
        if (!cuenta.auxiliar || !cuenta.codigo.startsWith(palabra)) continue
        salida.set(
          `${antes}'${cuenta.codigo}'`,
          `'${cuenta.codigo}'${SEPARADOR_DE_OPCION}${cuenta.descripcion ?? ''}`,
        )
        if (salida.size >= MAXIMO) break
      }
      return salida
    }
    for (const f of catalogo?.funciones ?? []) {
      if (f.nombre.startsWith(palabra)) salida.set(`${antes}${f.nombre}(`, `${f.firma}${SEPARADOR_DE_OPCION}${f.descripcion}`)
    }
    for (const n of [...nombres, ...extra]) {
      if (n.startsWith(palabra) && n !== palabra) salida.set(`${antes}${n}`, n)
    }
    return new Map([...salida].slice(0, MAXIMO))
  }, [texto, catalogo, nombres, extra, plan])

  const abierta = catalogo ? funcionAbierta(texto, catalogo.funciones) : null
  const error = errores && errores.length > 0 ? errores.join(' ') : undefined

  return (
    <Autocomplete
      size={size}
      label={label}
      aria-label={ariaLabel ?? label}
      placeholder={placeholder}
      value={texto}
      data={[...sugerencias.keys()]}
      onChange={alCambiar}
      filter={({ options }) => options}
      renderOption={({ option }) => <Text size="xs">{sugerencias.get(option.value) ?? option.value}</Text>}
      description={abierta ? abierta.firma : nota}
      error={error}
      readOnly={readOnly}
      comboboxProps={{ width: 420, position: 'bottom-start' }}
      styles={{ input: { fontFamily: 'monospace' } }}
    />
  )
}
