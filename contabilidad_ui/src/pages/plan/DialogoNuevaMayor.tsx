import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import { crearCuenta, type CuentaPlan } from '../../api/plan'
import { nombreDeTipo } from '../../lib/cuenta'
import JerarquiaCuenta from './JerarquiaCuenta'
import { useJerarquia } from './useJerarquia'

interface Props {
  abierto: boolean
  ejercicio: number | null
  /** Con qué código se abre, cuando viene de una casilla ya tecleada. */
  codigoInicial?: string
  alCerrar: () => void
  alCreada: (cuenta: CuentaPlan) => void
}

/** Un grupo tiene 1 dígito, un subgrupo 2 y una cuenta de mayor 3 o 4. */
const MAXIMO_DIGITOS = 4

/**
 * Amplía el árbol del plan: grupo, subgrupo o cuenta de mayor. Nivel `cierre`,
 * porque cambia la forma del plan y con ella cómo agregan el balance y la
 * cuenta de resultados. Aquí no se crean subcuentas: para eso está su alta.
 */
export default function DialogoNuevaMayor({
  abierto,
  ejercicio,
  codigoInicial = '',
  alCerrar,
  alCreada,
}: Props) {
  const [codigo, setCodigo] = useState(codigoInicial)
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  // Al abrirlo desde una casilla, el número ya está tecleado y no se repite.
  useEffect(() => {
    if (abierto) setCodigo(codigoInicial)
  }, [abierto, codigoInicial])

  const { escalones, error: errorJerarquia } = useJerarquia(codigo, ejercicio)

  function limpiar() {
    setCodigo(codigoInicial)
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
      const cuenta = await crearCuenta({
        ejercicio,
        codigo,
        descripcion: descripcion.trim(),
        auxiliar: false,
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
    <Modal
      opened={abierto}
      onClose={cerrar}
      title="Nuevo grupo, subgrupo o cuenta de mayor"
      centered
    >
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <TextInput
            label="Número de cuenta"
            description="Un dígito, grupo; dos, subgrupo; tres o cuatro, cuenta de mayor"
            value={codigo}
            // Solo dígitos y como mucho cuatro: aquí no se crean subcuentas.
            onChange={(e) =>
              setCodigo(e.currentTarget.value.replace(/\D/g, '').slice(0, MAXIMO_DIGITOS))
            }
            required
            autoFocus
          />

          {codigo !== '' && (
            <Text size="sm">
              Se va a crear un{' '}
              <Text span fw={600}>
                {nombreDeTipo(codigo.length, false).toLowerCase()}
              </Text>
              .
            </Text>
          )}

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
