import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'

interface Props {
  titulo: string
  texto: string
  etiqueta: string
  /** Si se pone, se pide un motivo y no se deja seguir sin él. */
  pideMotivo?: boolean
  alConfirmar: (motivo: string) => Promise<void>
  alCerrar: () => void
}

/** Pregunta antes de una acción que no se deshace, y enseña el motivo si la API la rechaza. */
export default function Confirmar({ titulo, texto, etiqueta, pideMotivo = false, alConfirmar, alCerrar }: Props) {
  const [motivo, setMotivo] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setTrabajando(true)
    setError(null)
    try {
      await alConfirmar(motivo.trim())
      alCerrar()
    } catch (fallo) {
      setError(textoDeError(fallo))
      setTrabajando(false)
    }
  }

  return (
    <Modal opened onClose={alCerrar} title={titulo}>
      <Stack gap="sm">
        <Text>{texto}</Text>
        {pideMotivo && (
          <Textarea label="Motivo" autosize minRows={2} value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} />
        )}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button color="red" loading={trabajando} disabled={pideMotivo && motivo.trim() === ''} onClick={() => void confirmar()}>
            {etiqueta}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
