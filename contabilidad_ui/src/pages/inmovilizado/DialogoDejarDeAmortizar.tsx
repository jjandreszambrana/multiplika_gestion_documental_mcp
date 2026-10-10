import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import { dejarDeAmortizar, type Bien } from '../../api/inmovilizado'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaParaApi } from '../../lib/fecha'

interface Props {
  /** Nulo con el diálogo cerrado. */
  bien: Bien | null
  alCerrar: () => void
  alHecho: () => void
}

const AVISO_YA_DOTADO =
  'Este bien ya tiene meses amortizados y seguirá figurando en los libros: su valor en la ' +
  'cuenta del activo y lo amortizado en la de amortización acumulada. Esta opción es para ' +
  'el bien que se dio de alta por error y nunca llegó a amortizarse. Para sacarlo de los ' +
  'libros, usa «Dar de baja y sacar de los libros».'

/**
 * La baja que **no toca los libros**: el bien deja de entrar en las dotaciones
 * y nada más. Nivel `apuntes`.
 *
 * Si el bien ya se ha amortizado algún mes, esta baja lo deja dentro de los
 * libros y no lo va a echar de menos nadie. Por eso el aviso.
 */
export default function DialogoDejarDeAmortizar({ bien, alCerrar, alHecho }: Props) {
  const [fecha, setFecha] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dando, setDando] = useState(false)

  function cerrar() {
    setFecha(null)
    setError(null)
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (bien === null) return
    setError(null)
    setDando(true)
    try {
      await dejarDeAmortizar(bien.id, fechaParaApi(fecha))
      setFecha(null)
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setDando(false)
    }
  }

  return (
    <Modal opened={bien !== null} onClose={cerrar} title="Dejar de amortizar" centered>
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text fw={600}>{bien?.descripcion}</Text>

          <Text size="sm">El bien deja de aparecer en las dotaciones. Los libros no se tocan.</Text>

          {bien !== null && bien.mejoras.length > 0 && (
            <Text size="sm">Sus mejoras también dejan de amortizarse.</Text>
          )}

          {bien !== null && bien.ultima_dotacion !== '' && (
            <Alert color="yellow" role="status">
              {AVISO_YA_DOTADO}
            </Alert>
          )}

          <CasillaFecha
            label="Fecha de baja"
            value={fecha}
            onChange={(valor) => setFecha(valor as Date | null)}
            clearable
            required
            autoFocus
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={dando}>
              Dejar de amortizar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
