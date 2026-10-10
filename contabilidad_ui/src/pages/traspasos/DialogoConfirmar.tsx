import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'

interface Props {
  abierto: boolean
  titulo: string
  /** Qué va a pasar, con la cuenta y el mes de verdad. */
  texto: string
  /** Texto del botón que ejecuta. Sin puntos suspensivos: pasa ya. */
  rotulo: string
  alCerrar: () => void
  alConfirmar: () => Promise<void>
}

/**
 * Las tres acciones de traspasos preguntan antes: generan asientos, y un
 * asiento confirmado no se edita ni se borra. La forma es siempre la misma,
 * así que el diálogo también.
 */
export default function DialogoConfirmar({
  abierto,
  titulo,
  texto,
  rotulo,
  alCerrar,
  alConfirmar,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  async function ejecutar() {
    setError(null)
    setTrabajando(true)
    try {
      await alConfirmar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal
      opened={abierto}
      onClose={alCerrar}
      title={titulo}
      centered
      // Al cerrarse se olvida lo que falló la vez anterior.
      onExitTransitionEnd={() => setError(null)}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Text size="sm">{texto}</Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void ejecutar()} loading={trabajando}>
            {rotulo}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
