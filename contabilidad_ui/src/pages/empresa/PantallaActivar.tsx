import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  activarContabilidad,
  listarObligados,
  type ObligadoResumen,
  type OrigenTerceros,
} from '../../api/empresa'
import { textoDeError } from '../../api/errores'

interface Props {
  /** Se llama tras activar, para rehacer el arranque con la empresa ya lista. */
  alActivada: () => void
  alVolver: (() => void) | null
  /** Empresa ya elegida, cuando se llega desde una que no tiene contabilidad. */
  idInicial?: number
  /** Dentro de la GD: la empresa ya está elegida y no se puede cambiar (el
   * proxy no deja listar empresas). Su nombre, para enseñarlo. */
  empresaFija?: string
}

const EJERCICIO_MINIMO = 1990
const EJERCICIO_MAXIMO = 2999

export default function PantallaActivar({ alActivada, alVolver, idInicial, empresaFija }: Props) {
  const [obligados, setObligados] = useState<ObligadoResumen[] | null>(null)
  const [fallaListado, setFallaListado] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<string | null>(
    idInicial === undefined ? null : String(idInicial),
  )
  const [ejercicio, setEjercicio] = useState<number | string>(new Date().getFullYear())
  const [origenTerceros, setOrigenTerceros] = useState<OrigenTerceros>('gestion')
  const [error, setError] = useState<string | null>(null)
  const [activando, setActivando] = useState(false)

  useEffect(() => {
    if (empresaFija !== undefined) return
    listarObligados()
      .then(setObligados)
      .catch((fallo: unknown) => {
        setObligados([])
        setFallaListado(textoDeError(fallo))
      })
  }, [])

  const opciones = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (obligados ?? [])
      .filter((o) => !texto || `${o.nombre ?? ''} ${o.nif ?? ''} ${o.id}`.toLowerCase().includes(texto))
      .map((o) => ({
        value: String(o.id),
        label: `${o.id} · ${o.nombre ?? 'Sin nombre'}${o.nif ? ` · ${o.nif}` : ''}`,
      }))
  }, [obligados, busqueda])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const id = Number(elegido)
    const anio = Number(ejercicio)
    if (!Number.isInteger(id) || id <= 0) {
      setError('Falta elegir la empresa.')
      return
    }
    setError(null)
    setActivando(true)
    try {
      await activarContabilidad(id, anio, origenTerceros)
      alActivada()
    } catch (fallo) {
      setError(textoDeError(fallo))
      setActivando(false)
    }
  }

  return (
    <Paper withBorder shadow="sm" p="xl" maw={560} mx="auto" mt="10vh">
      <form onSubmit={enviar}>
        <Stack gap="md">
          <Title order={3}>Activar la contabilidad de una empresa</Title>
          <Text size="sm" c="dimmed">
            Crea la configuración contable, las cuentas por defecto y el diario general, y
            abre el primer ejercicio.
          </Text>

          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          {fallaListado && (
            <Alert color="yellow" title="No se pudo listar las empresas">
              {fallaListado} Escribe el número de la empresa a mano.
            </Alert>
          )}

          {empresaFija !== undefined && <Text fw={600}>{empresaFija}</Text>}

          {empresaFija === undefined && !fallaListado && (
            <TextInput
              label="Buscar empresa"
              value={busqueda}
              onChange={(e) => setBusqueda(e.currentTarget.value)}
              autoFocus
            />
          )}

          {empresaFija !== undefined ? null : fallaListado ? (
            <NumberInput
              label="Número de empresa"
              value={elegido ?? ''}
              onChange={(v) => setElegido(v === '' ? null : String(v))}
              min={1}
              allowDecimal={false}
              required
            />
          ) : (
            <Select
              label="Empresa"
              data={opciones}
              value={elegido}
              onChange={setElegido}
              searchable
              nothingFoundMessage="Ninguna empresa coincide"
              disabled={obligados === null}
              required
            />
          )}

          <NumberInput
            label="Primer ejercicio"
            value={ejercicio}
            onChange={setEjercicio}
            min={EJERCICIO_MINIMO}
            max={EJERCICIO_MAXIMO}
            allowDecimal={false}
            required
          />

          <Radio.Group
            label="¿Dónde se guarda la cuenta de cada cliente y proveedor?"
            description="Se puede cambiar más adelante"
            value={origenTerceros}
            onChange={(valor) => setOrigenTerceros(valor as OrigenTerceros)}
          >
            <Stack gap="xs" mt="xs">
              <Radio value="gestion" label="En su ficha de facturación" />
              <Radio value="contabilidad" label="Aquí, en contabilidad" />
            </Stack>
          </Radio.Group>

          <Group justify="flex-end">
            {alVolver && (
              <Button variant="default" onClick={alVolver}>
                Volver
              </Button>
            )}
            <Button type="submit" loading={activando}>
              Activar
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}
