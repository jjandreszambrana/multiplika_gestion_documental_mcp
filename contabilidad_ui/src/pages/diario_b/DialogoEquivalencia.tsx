import { Alert, Button, Group, Modal, SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import type { DatosEquivalencia, EquivalenciaCuenta } from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import { expandirCuenta } from '../../lib/cuenta'

interface Props {
  /** Nula para dar de alta una nueva. */
  equivalencia: EquivalenciaCuenta | null
  ancho: number
  alCerrar: () => void
  /** Al editar, recibe solo lo que ha cambiado. */
  alGuardar: (datos: DatosEquivalencia) => Promise<void>
}

/** Alta y edición de una equivalencia: cuenta de origen → cuenta de destino. */
export default function DialogoEquivalencia({ equivalencia, ancho, alCerrar, alGuardar }: Props) {
  const [valores, setValores] = useState({
    cuenta_origen: equivalencia?.cuenta_origen ?? '',
    titulo_origen: equivalencia?.titulo_origen ?? '',
    cuenta_destino: equivalencia?.cuenta_destino ?? '',
    titulo_destino: equivalencia?.titulo_destino ?? '',
    observaciones: equivalencia?.observaciones ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  type Campo = keyof typeof valores
  const poner = (campo: Campo, valor: string) => setValores((v) => ({ ...v, [campo]: valor }))
  const expandir = (campo: Campo) => setValores((v) => ({ ...v, [campo]: expandirCuenta(v[campo], ancho) }))

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    const limpios = Object.fromEntries(
      Object.entries(valores).map(([campo, valor]) => [campo, valor.trim()]),
    ) as Record<Campo, string>
    const datos = equivalencia
      ? (Object.fromEntries(
          Object.entries(limpios).filter(([campo, valor]) => (equivalencia[campo as Campo] ?? '') !== valor),
        ) as DatosEquivalencia)
      : limpios
    try {
      await alGuardar(datos)
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened
      onClose={alCerrar}
      title={equivalencia ? 'Cambiar la equivalencia' : 'Nueva equivalencia'}
      size="lg"
      centered
    >
      <form onSubmit={(e) => void enviar(e)}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Cuenta de origen"
              value={valores.cuenta_origen}
              onChange={(e) => poner('cuenta_origen', e.currentTarget.value)}
              onBlur={() => expandir('cuenta_origen')}
              ff="monospace"
              required
              data-autofocus
            />
            <TextInput
              label="Título de origen"
              value={valores.titulo_origen}
              onChange={(e) => poner('titulo_origen', e.currentTarget.value)}
            />
            <TextInput
              label="Cuenta de destino"
              value={valores.cuenta_destino}
              onChange={(e) => poner('cuenta_destino', e.currentTarget.value)}
              onBlur={() => expandir('cuenta_destino')}
              ff="monospace"
              required
            />
            <TextInput
              label="Título de destino"
              value={valores.titulo_destino}
              onChange={(e) => poner('titulo_destino', e.currentTarget.value)}
            />
          </SimpleGrid>

          <Textarea
            label="Observaciones"
            value={valores.observaciones}
            onChange={(e) => poner('observaciones', e.currentTarget.value)}
            autosize
            minRows={3}
          />

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
    </Modal>
  )
}
