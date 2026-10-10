import { ActionIcon, Menu } from '@mantine/core'
import { IconDots, IconLock, IconLockOpen } from '@tabler/icons-react'
import type { Ejercicio } from '../../api/sesion'

/**
 * Bloquear y desbloquear son la misma acción con dos sentidos, así que se
 * ofrece la contraria a como esté. Un ejercicio cerrado no llega hasta aquí:
 * el cierre no se levanta quitando el bloqueo y la API responde 400.
 */
export default function AccionesEjercicio({
  ejercicio,
  alPedirBloqueo,
}: {
  ejercicio: Ejercicio
  alPedirBloqueo: (ejercicio: Ejercicio) => void
}) {
  const bloqueado = ejercicio.bloqueado === 1

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          aria-label={`Acciones del ejercicio ${ejercicio.ejercicio}`}
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={bloqueado ? <IconLockOpen size={14} /> : <IconLock size={14} />}
          onClick={() => alPedirBloqueo(ejercicio)}
        >
          {bloqueado ? 'Desbloquear…' : 'Bloquear…'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
