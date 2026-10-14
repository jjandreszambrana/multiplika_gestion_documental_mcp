import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { cambiarEstado, type FichaDeclaracion } from '../../api/declaraciones'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaParaApi } from '../../lib/fecha'
import { PRESENTADA } from './declaracion'

interface Props {
  abierto: boolean
  idDeclaracion: number
  alCerrar: () => void
  alHecho: (ficha: FichaDeclaracion) => void
}

/** Pasar a presentada pide el día y el número de justificante que da la AEAT. */
export default function DialogoPresentar({ abierto, idDeclaracion, alCerrar, alHecho }: Props) {
  const [fecha, setFecha] = useState<Date | null>(new Date())
  const [justificante, setJustificante] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cerrar() {
    setJustificante('')
    setError(null)
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const ficha = await cambiarEstado(idDeclaracion, PRESENTADA, {
        fecha_presentacion: fechaParaApi(fecha),
        justificante: justificante.trim(),
      })
      setJustificante('')
      alHecho(ficha)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal opened={abierto} onClose={cerrar} title="Marcar como presentada" centered>
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <CasillaFecha label="Día de presentación" value={fecha} onChange={setFecha} required />
          <TextInput
            label="Número de justificante"
            description="El que da la AEAT al presentarla."
            value={justificante}
            onChange={(e) => setJustificante(e.currentTarget.value)}
            maxLength={30}
            required
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={guardando}
              disabled={fecha === null || justificante.trim() === ''}
            >
              Marcar como presentada
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
