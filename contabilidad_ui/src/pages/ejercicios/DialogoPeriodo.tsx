import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { fijarPeriodo, type Periodo } from '../../api/ejercicios'
import { textoDeError } from '../../api/errores'
import { nombreDePeriodo } from './periodos'

interface Props {
  ejercicio: number
  periodo: Periodo | null
  alCerrar: () => void
  alHecho: () => void
}

/** Encima del panel de periodos, que ya es un diálogo. */
const POR_ENCIMA_DEL_PANEL = 300

/** Cerrar un periodo a nuevos apuntes, y reabrirlo. Nivel `cierre`. */
export default function DialogoPeriodo({ ejercicio, periodo, alCerrar, alHecho }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const presentado = periodo?.deshabilitado === 1

  async function confirmar() {
    if (periodo === null) return
    setError(null)
    setTrabajando(true)
    try {
      await fijarPeriodo(ejercicio, periodo.periodo, !presentado)
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal
      opened={periodo !== null}
      onClose={alCerrar}
      title={presentado ? 'Reabrir el periodo' : 'Cerrar el periodo'}
      zIndex={POR_ENCIMA_DEL_PANEL}
      centered
    >
      {periodo !== null && (
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text fw={500}>
            {nombreDePeriodo(periodo.periodo)} de {ejercicio}
          </Text>

          <Text size="sm">
            {presentado
              ? 'Vuelve a admitir apuntes con fecha de ese mes.'
              : 'Queda presentado: no admite más apuntes con fecha de ese mes. Es lo que evita que una factura que llega tarde se cuele en una declaración ya enviada.'}
          </Text>

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button color={presentado ? 'blue' : 'orange'} loading={trabajando} onClick={confirmar}>
              {presentado ? 'Reabrir' : 'Cerrar el periodo'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
