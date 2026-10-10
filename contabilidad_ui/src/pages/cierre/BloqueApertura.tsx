import { Alert, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import {
  confirmarApertura,
  deshacerApertura,
  prepararApertura,
  type VistaDeLaApertura,
} from '../../api/cierre'
import { textoDeError } from '../../api/errores'
import { formatearEntero, formatearFecha, formatearImporte } from '../../lib/format'

interface Props {
  /** El que se acaba de cerrar. */
  ejercicioCerrado: number
  /** Nulo si el cierre todavía no está confirmado. */
  puedePrepararse: boolean
  alHecho: () => void
}

const AVISO_SIN_CIERRE =
  'La apertura solo se puede preparar con el cierre del ejercicio anterior ya confirmado.'

/**
 * El asiento de apertura del ejercicio siguiente, con los mismos tres pasos que
 * el cierre: se prepara en borrador, se mira y se confirma.
 *
 * El ejercicio nuevo es el siguiente al cerrado. La API se niega a prepararla
 * mientras el cierre esté solo preparado, porque arrastra sus saldos y en
 * borrador todavía pueden cambiar.
 */
export default function BloqueApertura({ ejercicioCerrado, puedePrepararse, alHecho }: Props) {
  const [vista, setVista] = useState<VistaDeLaApertura | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const nuevo = ejercicioCerrado + 1

  async function hacer(que: 'preparar' | 'confirmar' | 'deshacer') {
    setError(null)
    setTrabajando(true)
    try {
      if (que === 'preparar') {
        setVista(await prepararApertura(ejercicioCerrado, nuevo, false))
      } else if (que === 'confirmar') {
        await confirmarApertura(ejercicioCerrado, nuevo)
        setVista(null)
        alHecho()
      } else {
        await deshacerApertura(ejercicioCerrado, nuevo)
        setVista(null)
      }
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Text fw={600}>Apertura del ejercicio siguiente</Text>

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {!puedePrepararse ? (
          <Text size="sm" c="dimmed">
            {AVISO_SIN_CIERRE}
          </Text>
        ) : vista === null ? (
          <Group>
            <Button loading={trabajando} onClick={() => void hacer('preparar')}>
              Preparar la apertura…
            </Button>
          </Group>
        ) : (
          <>
            <Text size="sm">
              {`Se arrastran ${formatearEntero(vista.cuentas)} cuentas por ${formatearImporte(vista.importe)} al ejercicio ${vista.ejercicio}, con fecha ${formatearFecha(vista.fecha)}.`}
            </Text>
            <Group>
              <Button variant="default" loading={trabajando} onClick={() => void hacer('deshacer')}>
                Deshacer…
              </Button>
              <Button loading={trabajando} onClick={() => void hacer('confirmar')}>
                Confirmar la apertura…
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  )
}
