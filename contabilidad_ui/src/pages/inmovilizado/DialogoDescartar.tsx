import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import { marcarRevisado, type ApuntePideFicha } from '../../api/inmovilizado'
import { aCadenaApi } from '../../lib/dinero'

interface Props {
  /** Nulo con el diálogo cerrado. */
  apunte: ApuntePideFicha | null
  alCerrar: () => void
  alHecho: () => void
}

/**
 * Marcar que un apunte en una cuenta de inmovilizado no era un bien, para que
 * el aviso deje de salir. Nivel `apuntes`.
 *
 * El motivo se guarda: quien lo mire dentro de un año tiene que poder saber qué
 * se decidió y por qué, en vez de encontrarse un apunte silenciado sin más.
 */
export default function DialogoDescartar({ apunte, alCerrar, alHecho }: Props) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cerrar() {
    setMotivo('')
    setError(null)
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (apunte === null) return
    setError(null)
    setGuardando(true)
    try {
      await marcarRevisado({
        pase: apunte.pase,
        ref_tipo: apunte.ref_tipo,
        ref_id: apunte.ref_id,
        cuenta: apunte.cuenta,
        importe: aCadenaApi(apunte.importe),
        resultado: 'descartado',
        motivo: motivo.trim(),
      })
      setMotivo('')
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal opened={apunte !== null} onClose={cerrar} title="No es un bien" centered>
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text size="sm">{apunte?.concepto}</Text>

          <Stack gap={4}>
            <Textarea
              label="Por qué no es un bien"
              value={motivo}
              onChange={(e) => setMotivo(e.currentTarget.value)}
              autosize
              minRows={2}
              autoFocus
            />
            <Text size="xs" c="dimmed">
              No se volverá a preguntar por este apunte.
            </Text>
          </Stack>

          <Group justify="flex-end">
            <Button variant="default" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
