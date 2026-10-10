import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { bloquearEjercicio } from '../../api/ejercicios'
import { textoDeError } from '../../api/errores'
import type { Ejercicio } from '../../api/sesion'

interface Props {
  ejercicio: Ejercicio | null
  alCerrar: () => void
  alHecho: () => void
}

/** Bloquear un ejercicio para una revisión, y liberarlo. Nivel `cierre`. */
export default function DialogoBloqueo({ ejercicio, alCerrar, alHecho }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const bloqueado = ejercicio?.bloqueado === 1

  async function confirmar() {
    if (ejercicio === null) return
    setError(null)
    setTrabajando(true)
    try {
      await bloquearEjercicio(ejercicio.ejercicio, !bloqueado)
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal
      opened={ejercicio !== null}
      onClose={alCerrar}
      title={bloqueado ? 'Desbloquear el ejercicio' : 'Bloquear el ejercicio'}
      centered
    >
      {ejercicio !== null && (
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text fw={500}>Ejercicio {ejercicio.ejercicio}</Text>

          <Text size="sm">
            {bloqueado
              ? 'Vuelve a admitir apuntes.'
              : 'Deja de admitir apuntes mientras dure una revisión. Se puede desbloquear después.'}
          </Text>

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button color={bloqueado ? 'blue' : 'yellow'} loading={trabajando} onClick={confirmar}>
              {bloqueado ? 'Desbloquear' : 'Bloquear'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
