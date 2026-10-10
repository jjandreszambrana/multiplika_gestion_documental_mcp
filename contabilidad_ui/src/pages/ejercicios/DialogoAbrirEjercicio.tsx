import { Alert, Button, Group, Modal, NumberInput, Stack } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { abrirEjercicio } from '../../api/ejercicios'
import { textoDeError } from '../../api/errores'

interface Props {
  abierto: boolean
  /** Para proponer el año siguiente al más reciente que ya existe. */
  ultimoEjercicio: number | null
  alCerrar: () => void
  alAbierto: (ejercicio: number) => void
}

/** Los que admite la API. Fuera de esto responde 422. */
const AÑO_MINIMO = 1990
const AÑO_MAXIMO = 2999

/**
 * Alta de un ejercicio, nivel `cierre`. El plan contable no se pregunta: lo
 * hereda de la empresa, y cambiarlo es lo que se hace al abrir el ejercicio
 * siguiente con otro plan, que hoy no se puede por API.
 */
export default function DialogoAbrirEjercicio({
  abierto,
  ultimoEjercicio,
  alCerrar,
  alAbierto,
}: Props) {
  const propuesto = ultimoEjercicio === null ? null : ultimoEjercicio + 1
  const [año, setAño] = useState<number | string>(propuesto ?? '')
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  function cerrar() {
    setAño(propuesto ?? '')
    setError(null)
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const valor = Number(año)
    if (!Number.isInteger(valor)) return
    setError(null)
    setTrabajando(true)
    try {
      const { ejercicio } = await abrirEjercicio(valor)
      setError(null)
      alAbierto(ejercicio)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal opened={abierto} onClose={cerrar} title="Abrir un ejercicio nuevo" centered>
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <NumberInput
            label="Año"
            description="El año natural que se va a llevar. Se crean sus doce periodos."
            value={año}
            onChange={setAño}
            min={AÑO_MINIMO}
            max={AÑO_MAXIMO}
            allowDecimal={false}
            allowNegative={false}
            hideControls={false}
            thousandSeparator={false}
            w={160}
            data-autofocus
          />

          <Alert color="blue">
            Se abre vacío. Los saldos del ejercicio anterior no pasan solos: los trae el asiento de
            apertura.
          </Alert>

          <Group justify="flex-end">
            <Button variant="default" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={trabajando}>
              Abrir ejercicio
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
