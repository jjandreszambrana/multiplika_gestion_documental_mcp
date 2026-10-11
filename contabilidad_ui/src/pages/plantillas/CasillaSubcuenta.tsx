import { ActionIcon, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconBook } from '@tabler/icons-react'
import { useState } from 'react'
import { expandirCuenta } from '../../lib/cuenta'
import CasillaCuenta from '../diario/CasillaCuenta'
import DialogoCuentaAlVuelo from '../diario/DialogoCuentaAlVuelo'
import ModalMayor from '../informes/ModalMayor'

interface Props {
  label?: string
  description?: string
  error?: string
  size: 'xs' | 'sm'
  valor: string
  /** Dígitos de una subcuenta en esta empresa. */
  ancho: number
  /** Ejercicio en el que se da de alta una subcuenta nueva y se mira su mayor. */
  ejercicio: number | null
  alCambiar: (valor: string) => void
}

/**
 * Una subcuenta dentro de una plantilla, igual que en la entrada de asientos:
 * se busca por número o por título, si no existe se crea sin salir («Crear la
 * cuenta…») y con el libro se mira su mayor.
 */
export default function CasillaSubcuenta({
  label,
  description,
  error,
  size,
  valor,
  ancho,
  ejercicio,
  alCambiar,
}: Props) {
  const [nueva, setNueva] = useState<string | null>(null)
  const [mayorDe, setMayorDe] = useState('')

  return (
    <Stack gap={2}>
      <Group gap={4} wrap="nowrap" align="flex-end">
        <div style={{ flex: 1 }}>
          <CasillaCuenta
            size={size}
            label={label}
            valor={valor}
            ancho={ancho}
            alCambiar={alCambiar}
            alCrear={setNueva}
          />
        </div>
        <Tooltip label="Ver el mayor">
          <ActionIcon
            variant="subtle"
            size={size === 'xs' ? 'sm' : 'md'}
            mb={size === 'xs' ? 2 : 4}
            aria-label="Ver el mayor"
            disabled={valor.trim() === ''}
            onClick={() => setMayorDe(expandirCuenta(valor, ancho))}
          >
            <IconBook size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
      <DialogoCuentaAlVuelo
        codigo={nueva}
        ejercicio={ejercicio}
        alCerrar={() => setNueva(null)}
        alCreada={(cuenta) => {
          alCambiar(cuenta.codigo)
          setNueva(null)
        }}
      />
      <ModalMayor cuenta={mayorDe} ejercicio={ejercicio} alCerrar={() => setMayorDe('')} />
    </Stack>
  )
}
