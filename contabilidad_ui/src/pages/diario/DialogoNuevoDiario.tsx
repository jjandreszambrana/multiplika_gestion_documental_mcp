import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { crearDiario, type DiarioContable } from '../../api/diarios'
import { textoDeError } from '../../api/errores'

interface Props {
  abierto: boolean
  alCerrar: () => void
  alCreado: (diario: DiarioContable) => void
}

export default function DialogoNuevoDiario({ abierto, alCerrar, alCreado }: Props) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  function cerrar() {
    setCodigo('')
    setNombre('')
    setError(null)
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setCreando(true)
    try {
      const diario = await crearDiario(codigo.trim().toUpperCase(), nombre.trim())
      setCodigo('')
      setNombre('')
      alCreado(diario)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setCreando(false)
    }
  }

  return (
    <Modal opened={abierto} onClose={cerrar} title="Nuevo diario" centered>
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <TextInput
            label="Código"
            description="Lo llevarán escrito los apuntes, y después ya no se cambia"
            value={codigo}
            onChange={(e) => setCodigo(e.currentTarget.value)}
            required
            autoFocus
          />

          <TextInput
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.currentTarget.value)}
            required
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={creando}>
              Crear
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
