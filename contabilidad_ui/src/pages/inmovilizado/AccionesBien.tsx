import { ActionIcon, Menu } from '@mantine/core'
import {
  IconArchiveOff,
  IconCurrencyEuro,
  IconDots,
  IconPencil,
  IconPlus,
  IconReceiptOff,
} from '@tabler/icons-react'
import type { Bien } from '../../api/inmovilizado'

export interface AccionesDeBien {
  alCorregir: (bien: Bien) => void
  alCorregirValor: (bien: Bien) => void
  alAnadirMejora: (bien: Bien) => void
  alDejarDeAmortizar: (bien: Bien) => void
  alDarDeBaja: (bien: Bien) => void
}

/**
 * Las tres acciones de un bien, nivel `apuntes`. Van en un menú porque sus
 * rótulos no caben en la fila, y los rótulos no se acortan a propósito: las dos
 * bajas se confunden con facilidad y el nombre es lo que las distingue.
 *
 * Un bien ya dado de baja no llega aquí: no hay nada que hacerle. Sobre una
 * mejora no se ofrece añadir otra: la cadena tiene dos niveles y la API no
 * admite mejoras de mejoras.
 */
export default function AccionesBien({
  bien,
  acciones,
}: {
  bien: Bien
  acciones: AccionesDeBien
}) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          aria-label={`Acciones de ${bien.descripcion}`}
          onClick={(e) => e.stopPropagation()}
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => acciones.alCorregir(bien)}>
          Corregir…
        </Menu.Item>
        {/* Sin dotaciones el valor se cambia en «Corregir…» sin más: no hay
            nada dotado que deshacer y no hace falta ningún asiento. */}
        {bien.ultima_dotacion !== '' && (
          <Menu.Item
            leftSection={<IconCurrencyEuro size={14} />}
            onClick={() => acciones.alCorregirValor(bien)}
          >
            Corregir el valor…
          </Menu.Item>
        )}
        {!bien.es_mejora && (
          <Menu.Item
            leftSection={<IconPlus size={14} />}
            onClick={() => acciones.alAnadirMejora(bien)}
          >
            Añadir mejora…
          </Menu.Item>
        )}
        <Menu.Item
          leftSection={<IconArchiveOff size={14} />}
          onClick={() => acciones.alDejarDeAmortizar(bien)}
        >
          Dejar de amortizar…
        </Menu.Item>
        <Menu.Item
          leftSection={<IconReceiptOff size={14} />}
          onClick={() => acciones.alDarDeBaja(bien)}
        >
          Dar de baja y sacar de los libros…
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
