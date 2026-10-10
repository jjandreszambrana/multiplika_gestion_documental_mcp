import { ActionIcon, Menu } from '@mantine/core'
import {
  IconArchive,
  IconArchiveOff,
  IconDots,
  IconEye,
  IconEyeOff,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react'
import { estaApartada, type CuentaPlan } from '../../api/plan'
import type { Accion } from './DialogoAccionCuenta'

interface Props {
  cuenta: CuentaPlan
  alEditar: (cuenta: CuentaPlan) => void
  alPedirAccion: (cuenta: CuentaPlan, accion: Accion) => void
}

/**
 * Qué se puede hacer con una cuenta lo decide `origen`: el plan normativo no se
 * toca, así que una cuenta común se renombra u oculta, y solo las propias se
 * retiran o se borran.
 *
 * Salvo si está apartada: entonces lo único que se ofrece es recuperarla, y cuál
 * de las dos formas lo dicen `oculta` y `estado`, nunca `origen`. Ocultar una
 * cuenta común crea por dentro una fila propia que la tapa, así que llega con
 * `origen: "propia"` y ofrecerle «Reactivar» sería el botón equivocado.
 */
export default function AccionesCuenta({ cuenta, alEditar, alPedirAccion }: Props) {
  const propia = cuenta.origen === 'propia'

  if (estaApartada(cuenta)) {
    return (
      <MenuDeCuenta cuenta={cuenta}>
        {cuenta.oculta === 1 ? (
          <Menu.Item
            leftSection={<IconEye size={14} />}
            onClick={() => alPedirAccion(cuenta, 'mostrar')}
          >
            Volver a mostrar…
          </Menu.Item>
        ) : (
          <Menu.Item
            leftSection={<IconArchiveOff size={14} />}
            onClick={() => alPedirAccion(cuenta, 'reactivar')}
          >
            Reactivar…
          </Menu.Item>
        )}
      </MenuDeCuenta>
    )
  }

  return (
    <MenuDeCuenta cuenta={cuenta}>
      <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => alEditar(cuenta)}>
        Modificar denominación o tipo…
      </Menu.Item>

      {propia ? (
        <>
          <Menu.Item
            leftSection={<IconArchive size={14} />}
            onClick={() => alPedirAccion(cuenta, 'retirar')}
          >
            Retirar…
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={() => alPedirAccion(cuenta, 'borrar')}
          >
            Borrar…
          </Menu.Item>
        </>
      ) : (
        <Menu.Item
          leftSection={<IconEyeOff size={14} />}
          onClick={() => alPedirAccion(cuenta, 'ocultar')}
        >
          Ocultar en esta empresa…
        </Menu.Item>
      )}
    </MenuDeCuenta>
  )
}

function MenuDeCuenta({ cuenta, children }: { cuenta: CuentaPlan; children: React.ReactNode }) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          aria-label={`Acciones de ${cuenta.codigo}`}
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  )
}
