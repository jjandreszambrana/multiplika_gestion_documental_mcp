import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import { crearSubcuenta, type CuentaPlan } from '../../api/plan'
import { expandirCuenta } from '../../lib/cuenta'
import JerarquiaCuenta from './JerarquiaCuenta'
import { useJerarquia } from './useJerarquia'

interface Props {
  abierto: boolean
  ejercicio: number | null
  /** Dígitos de una subcuenta en esta empresa, de la configuración. */
  ancho: number
  alCerrar: () => void
  alCreada: (cuenta: CuentaPlan) => void
}

/**
 * Alta de subcuenta: la rutina diaria, nivel `apuntes`. Se teclea el número
 * entero y debajo se va viendo de qué grupo, subgrupo y cuenta de mayor cuelga,
 * para saber dónde queda antes de crearla.
 */
export default function DialogoNuevaSubcuenta({
  abierto,
  ejercicio,
  ancho,
  alCerrar,
  alCreada,
}: Props) {
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const { escalones, raiz, error: errorJerarquia } = useJerarquia(codigo, ejercicio)

  function limpiar() {
    setCodigo('')
    setDescripcion('')
    setError(null)
  }

  function cerrar() {
    limpiar()
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setCreando(true)
    try {
      // La raíz es la cuenta existente más honda de la que cuelga el código
      // tecleado; el servidor comprueba que encaja y rechaza lo que no.
      const cuenta = await crearSubcuenta({
        ejercicio,
        raiz: raiz ?? codigo.trim().slice(0, 3),
        descripcion: descripcion.trim(),
        codigo: codigo.trim(),
      })
      limpiar()
      alCreada(cuenta)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setCreando(false)
    }
  }

  return (
    <Modal opened={abierto} onClose={cerrar} title="Nueva subcuenta" centered>
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <TextInput
            label="Número de cuenta"
            description={`El punto se rellena con ceros hasta ${ancho} dígitos: 430.12 es la ${expandirCuenta('430.12', ancho)}`}
            value={codigo}
            onChange={(e) => setCodigo(e.currentTarget.value)}
            onBlur={() => setCodigo(expandirCuenta(codigo, ancho))}
            required
            autoFocus
          />

          <JerarquiaCuenta escalones={escalones} error={errorJerarquia} />

          <TextInput
            label="Título"
            value={descripcion}
            onChange={(e) => setDescripcion(e.currentTarget.value)}
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
