import { Alert, Button, Group, Modal, Radio, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import { editarCuenta, type CuentaPlan } from '../../api/plan'
import { nombreDeTipo } from '../../lib/cuenta'

interface Props {
  cuenta: CuentaPlan | null
  ejercicio: number | null
  alCerrar: () => void
  alGuardada: (cuenta: CuentaPlan) => void
}

/** Renombrar y cambiar el tipo de una cuenta. Nivel `cierre`. */
export default function DialogoEditarCuenta({ cuenta, ejercicio, alCerrar, alGuardada }: Props) {
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState('mayor')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (cuenta === null) return
    setDescripcion(cuenta.descripcion ?? '')
    setTipo(cuenta.auxiliar ? 'subcuenta' : 'mayor')
    setError(null)
  }, [cuenta])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    if (cuenta === null) return
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const guardada = await editarCuenta({
        ejercicio,
        codigo: cuenta.codigo,
        descripcion: descripcion.trim(),
        auxiliar: tipo === 'subcuenta',
      })
      alGuardada(guardada)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={cuenta !== null}
      onClose={alCerrar}
      title={cuenta === null ? '' : `Cuenta ${cuenta.codigo}`}
      centered
    >
      {cuenta !== null && (
        <form onSubmit={enviar}>
          <Stack gap="md">
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}

            {cuenta.origen === 'comun' && (
              <Alert color="blue">
                Pertenece al plan normativo, que no se modifica. Al guardar, la empresa pasa a tener
                su propia versión con el mismo código, que prevalece sobre la común.
              </Alert>
            )}

            <TextInput
              label="Título"
              value={descripcion}
              onChange={(e) => setDescripcion(e.currentTarget.value)}
              required
              autoFocus
            />

            <Radio.Group label="Tipo de cuenta" value={tipo} onChange={setTipo}>
              <Stack gap="xs" mt="xs">
                <Radio
                  value="mayor"
                  label={`${nombreDeTipo(cuenta.nivel, false)}: agrega las cuentas que dependen de ella`}
                />
                <Radio value="subcuenta" label="Subcuenta: admite apuntes" />
              </Stack>
            </Radio.Group>

            <Text size="xs" c="dimmed">
              Una subcuenta con apuntes no cambia de tipo, y una cuenta de la que dependen otras
              tampoco puede pasar a subcuenta.
            </Text>

            <Group justify="flex-end">
              <Button variant="default" onClick={alCerrar}>
                Cancelar
              </Button>
              <Button type="submit" loading={guardando}>
                Guardar
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  )
}
