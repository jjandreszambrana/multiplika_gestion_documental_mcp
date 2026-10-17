import { useCallback, useState } from 'react'

/**
 * Pestañas que se montan la primera vez que se abren y luego se quedan
 * montadas, ocultas: al volver a una, sigue como se dejó. Las que no se han
 * abierto nunca no se montan, para no pedir datos que nadie ha mirado.
 *
 * Se usa con `keepMounted` en las `Tabs` y pintando el contenido de cada panel
 * solo si `vista(valor)`.
 */
export function usePestanas(inicial: string, alCambiar?: (valor: string) => void) {
  const [pestana, setPestana] = useState(inicial)
  const [vistas, setVistas] = useState<ReadonlySet<string>>(() => new Set([inicial]))

  const cambiar = useCallback(
    (valor: string | null) => {
      if (valor === null) return
      setPestana(valor)
      setVistas((antes) => (antes.has(valor) ? antes : new Set(antes).add(valor)))
      alCambiar?.(valor)
    },
    [alCambiar],
  )

  return { pestana, cambiar, vista: (valor: string) => vistas.has(valor) }
}
