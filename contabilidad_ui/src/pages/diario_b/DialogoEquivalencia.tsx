import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import type { DatosEquivalencia, EquivalenciaCuenta } from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import type { CuentaPlan } from '../../api/plan'
import { expandirCuenta } from '../../lib/cuenta'
import BuscadorDelPlan from './BuscadorDelPlan'
import { useDestinosUsados } from './useDestinosUsados'
import {
  datosAEnviar,
  valoresDe,
  yaAsignadaA,
  type ValoresEquivalencia,
} from './datosEquivalencia'

interface Props {
  /** Nula para dar de alta una nueva. */
  equivalencia: EquivalenciaCuenta | null
  ancho: number
  /** Para buscar la cuenta de destino en el plan de ese ejercicio. */
  ejercicio: number | null
  alCerrar: () => void
  /** Al editar, recibe solo lo que ha cambiado. */
  alGuardar: (datos: DatosEquivalencia) => Promise<void>
}

type Campo = Exclude<keyof ValoresEquivalencia, 'flag'>

/** Alta y edición de una equivalencia: cuenta de origen → cuenta de destino. */
export default function DialogoEquivalencia({
  equivalencia,
  ancho,
  ejercicio,
  alCerrar,
  alGuardar,
}: Props) {
  const [valores, setValores] = useState<ValoresEquivalencia>(() => valoresDe(equivalencia))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [elegida, setElegida] = useState<CuentaPlan | null>(null)
  const { usados, error: errorUsados } = useDestinosUsados(equivalencia?.id ?? null)
  // Aviso en la casilla de destino cuando ya es destino de otra equivalencia.
  const [errorDestino, setErrorDestino] = useState<string | null>(null)

  const poner = (campo: Campo, valor: string) => setValores((v) => ({ ...v, [campo]: valor }))
  const expandir = (campo: Campo) =>
    setValores((v) => ({ ...v, [campo]: expandirCuenta(v[campo], ancho) }))

  // Elegida en el plan: se rellenan la cuenta y el título de destino, y se marca Flag.
  function usarElegida() {
    if (!elegida) return
    setValores((v) => ({
      ...v,
      cuenta_destino: elegida.codigo,
      titulo_destino: elegida.descripcion ?? '',
      flag: 1,
    }))
    setErrorDestino(null)
    setBuscando(false)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    // Una cuenta de destino solo puede serlo de una equivalencia. Se mira solo
    // si se ha cambiado: una repetida de antes no impide tocar lo demás.
    const destino = valores.cuenta_destino.trim()
    const origenDeOtra =
      equivalencia && destino === equivalencia.cuenta_destino.trim()
        ? null
        : yaAsignadaA(destino, usados)
    if (origenDeOtra !== null) {
      setErrorDestino(`Ya asignada a ${origenDeOtra}`)
      return
    }
    setGuardando(true)
    try {
      await alGuardar(datosAEnviar(equivalencia, valores))
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
              onChange={(e) => {
                setErrorDestino(null)
                poner('cuenta_destino', e.currentTarget.value)
              }}
              error={errorDestino}
              onBlur={() => expandir('cuenta_destino')}
              ff="monospace"
              required
              rightSection={
                <Tooltip label="Buscar en el plan…" withArrow>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label="Buscar en el plan…"
                    onClick={() => {
                      setElegida(null)
                      setBuscando(true)
                    }}
                  >
                    <IconSearch size={16} />
                  </ActionIcon>
                </Tooltip>
              }
            />
            <TextInput
              label="Título de destino"
              value={valores.titulo_destino}
              onChange={(e) => poner('titulo_destino', e.currentTarget.value)}
            />
          </SimpleGrid>

          <Checkbox
            label="Flag"
            checked={valores.flag === 1}
            onChange={(e) => {
              const marcada = e.currentTarget.checked
              setValores((v) => ({ ...v, flag: marcada ? 1 : 0 }))
            }}
          />

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

      <Modal
        opened={buscando}
        onClose={() => setBuscando(false)}
        title="Buscar la cuenta de destino"
        size="lg"
      >
        <Stack gap="sm">
          {(valores.cuenta_origen.trim() !== '' || valores.titulo_origen.trim() !== '') && (
            <Text size="sm">
              Cuenta de origen:{' '}
              <Text span ff="monospace" fw={600}>
                {valores.cuenta_origen.trim()}
              </Text>
              {valores.titulo_origen.trim() !== '' && ` ${valores.titulo_origen.trim()}`}
            </Text>
          )}
          {buscando && (
            <BuscadorDelPlan
              ejercicio={ejercicio}
              busqueda={
                valores.cuenta_destino.trim() ||
                valores.titulo_origen.trim() ||
                valores.cuenta_origen.trim()
              }
              elegida={elegida}
              alElegir={setElegida}
              usados={usados}
            />
          )}
          {errorUsados && (
            <Alert color="yellow" role="alert">
              {`No se ha podido comprobar qué cuentas de destino ya están asignadas: ${errorUsados}`}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBuscando(false)}>
              Cancelar
            </Button>
            <Button onClick={usarElegida} disabled={!elegida}>
              Elegir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Modal>
  )
}
