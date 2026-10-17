import { ActionIcon, Group, Tooltip } from '@mantine/core'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import type { MouseEvent } from 'react'

/**
 * Lo común a las dos rejillas del diario B: una sola fila marcada a la vez,
 * que se marca y desmarca al pulsarla, y los iconos de cambiar y borrar.
 */

/** Propiedades de la fila: el clic la marca o la desmarca; marcada, en azul como en el diario. */
export function propsDeFilaMarcable(marcada: boolean, alPulsar: () => void) {
  return {
    onClick: alPulsar,
    style: {
      cursor: 'pointer',
      ...(marcada && { backgroundColor: 'var(--mantine-color-blue-1)' }),
    },
  }
}

/** El clic en un icono no marca ni desmarca la fila. */
function sinMarcar(accion: () => void) {
  return (e: MouseEvent) => {
    e.stopPropagation()
    accion()
  }
}

export function IconosDeFila({
  alCambiar,
  alBorrar,
}: {
  alCambiar: () => void
  alBorrar: () => void
}) {
  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label="Cambiar…" withArrow>
        <ActionIcon size="sm" variant="subtle" aria-label="Cambiar…" onClick={sinMarcar(alCambiar)}>
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Borrar…" withArrow>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          aria-label="Borrar…"
          onClick={sinMarcar(alBorrar)}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}
