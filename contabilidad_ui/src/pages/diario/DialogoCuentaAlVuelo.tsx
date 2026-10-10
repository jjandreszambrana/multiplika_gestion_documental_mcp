import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import { crearSubcuenta, type CuentaPlan } from '../../api/plan'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'

interface Props {
  /** Código ya expandido que se va a dar de alta; nulo con el diálogo cerrado. */
  codigo: string | null
  ejercicio: number | null
  alCerrar: () => void
  alCreada: (cuenta: CuentaPlan) => void
}

const DIGITOS_DE_MAYOR = 3

/** Alta de subcuenta sin salir del asiento, para no perder lo tecleado. */
export default function DialogoCuentaAlVuelo({ codigo, ejercicio, alCerrar, alCreada }: Props) {
  const plan = usePlanEnMemoria()
  const [titulo, setTitulo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    setTitulo('')
    setError(null)
  }, [codigo])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (codigo === null) return
    setError(null)
    setCreando(true)
    try {
      const cuenta = await crearSubcuenta({
        ejercicio,
        // La cuenta de mayor de la que cuelga; el servidor comprueba que encaja.
        raiz: codigo.slice(0, DIGITOS_DE_MAYOR),
        descripcion: titulo.trim(),
        codigo,
      })
      plan.refrescar()
      alCreada(cuenta)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setCreando(false)
    }
  }

  return (
    <Modal opened={codigo !== null} onClose={alCerrar} title="Nueva cuenta" centered>
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text size="sm" ff="monospace">
            {codigo}
          </Text>

          <TextInput
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.currentTarget.value)}
            required
            autoFocus
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
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
