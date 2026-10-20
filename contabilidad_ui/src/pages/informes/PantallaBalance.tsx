import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconFileSpreadsheet } from '@tabler/icons-react'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import {
  balanceEnExcel,
  sumasYSaldos,
  type FiltroSumasYSaldos,
  type LineaSumasYSaldos,
  type NivelDeBalance,
  type SumasYSaldos,
} from '../../api/informes'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import CasillaDeCuenta from '../../components/CasillaDeCuenta'
import { CasillaFecha } from '../../components/CasillaFecha'
import { opcionesDeTabla } from '../../components/tabla'
import { guardarFichero, nombreDeFichero } from '../../lib/descarga'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import { formatearEntero, formatearImporte } from '../../lib/format'
import { columnasDeBalance } from './columnasBalance'
import ModalMayor from './ModalMayor'

interface Props {
  ejercicio: number | null
  /** Dígitos de una subcuenta en esta empresa, para el comodín del punto. */
  ancho: number
  /** Para recordarle a cada uno cómo dejó el filtro. */
  usuario: string
}

/** Lo que se recuerda del filtro. Las fechas, como las manda la API. */
interface FiltroGuardado {
  nivel: NivelDeBalance
  cuentaDesde: string
  cuentaHasta: string
  desde: string
  hasta: string
  borradores: boolean
}

const PREFERENCIA = 'balance.filtro'

/** Por cuántos dígitos se agrupa. Sin agrupar es cuenta a cuenta. */
const NIVELES = [
  { value: '1', label: 'Grupo' },
  { value: '2', label: 'Subgrupo' },
  { value: '3', label: 'Cuenta de mayor' },
  { value: '0', label: 'Subcuenta' },
]

/**
 * El balance de sumas y saldos: lo que se ha movido en cada cuenta y cómo queda.
 *
 * **El debe y el haber son los del periodo pedido**, no acumulados; lo que la
 * cuenta traía al empezar va aparte, en su propia columna. Sin acotar fechas el
 * periodo es el ejercicio, así que el saldo anterior sale a cero.
 *
 * Los borradores **no entran de entrada**, al revés que en el mayor: un balance
 * suele mandarse fuera, y ahí lo que no está confirmado no cuenta salvo que se
 * pida a propósito.
 */
export default function PantallaBalance({ ejercicio, ancho, usuario }: Props) {
  const guardado = leerPreferencia<FiltroGuardado>(usuario, PREFERENCIA)

  // Entra agrupado por cuenta de mayor, que es como se mira habitualmente:
  // grupo y subgrupo son para el resumen y subcuenta para el detalle.
  const [nivel, setNivel] = useState<NivelDeBalance>(guardado?.nivel ?? 3)
  const [cuentaDesde, setCuentaDesde] = useState(guardado?.cuentaDesde ?? '')
  const [cuentaHasta, setCuentaHasta] = useState(guardado?.cuentaHasta ?? '')
  const [desde, setDesde] = useState<Date | null>(fechaDeApi(guardado?.desde))
  const [hasta, setHasta] = useState<Date | null>(fechaDeApi(guardado?.hasta))
  const [borradores, setBorradores] = useState(guardado?.borradores ?? false)
  /** Lo que se está viendo, que no cambia mientras se retoca el filtro. */
  const [consulta, setConsulta] = useState<FiltroSumasYSaldos | null>(null)
  const [balance, setBalance] = useState<SumasYSaldos | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bajando, setBajando] = useState(false)
  /** La cuenta cuyo mayor se está mirando, sin salir del balance. */
  const [mayorDe, setMayorDe] = useState('')

  const cargar = useCallback(
    async (senal: AbortSignal) => {
      if (consulta === null) return
      setCargando(true)
      setError(null)
      try {
        setBalance(await sumasYSaldos(consulta, senal))
      } catch (fallo) {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setBalance(null)
      } finally {
        setCargando(false)
      }
    },
    [consulta],
  )

  useEffect(() => {
    const corte = new AbortController()
    void cargar(corte.signal)
    return () => corte.abort()
  }, [cargar])

  function ver() {
    if (ejercicio === null) return
    guardarPreferencia(usuario, PREFERENCIA, {
      nivel,
      cuentaDesde: cuentaDesde.trim(),
      cuentaHasta: cuentaHasta.trim(),
      desde: fechaParaApi(desde),
      hasta: fechaParaApi(hasta),
      borradores,
    })
    setConsulta({
      ejercicio,
      nivel,
      cuentaDesde: cuentaDesde.trim(),
      cuentaHasta: cuentaHasta.trim(),
      desde: fechaParaApi(desde),
      hasta: fechaParaApi(hasta),
      incluirBorradores: borradores,
    })
  }

  async function bajarExcel() {
    if (consulta === null) return
    setError(null)
    setBajando(true)
    try {
      guardarFichero(
        await balanceEnExcel(consulta),
        nombreDeFichero(`sumas_y_saldos_${consulta.ejercicio}`, 'xlsx'),
      )
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setBajando(false)
    }
  }

  // El enlace va con lo que se está viendo, no con el selector: hasta pulsar Ver
  // las líneas siguen siendo las de antes.
  const porSubcuenta = consulta?.nivel === 0
  const columnas = useMemo(
    () => columnasDeBalance(porSubcuenta ? setMayorDe : undefined),
    [porSubcuenta],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<LineaSumasYSaldos>(),
    columns: columnas,
    data: balance?.lineas ?? [],
    enablePagination: false,
    enableBottomToolbar: false,
    // Solo la primera vez: en una recarga las líneas de antes se quedan puestas
    // hasta que llegan las nuevas, y así la tabla no parpadea.
    state: { isLoading: cargando && balance === null },
    localization: { noRecordsToDisplay: 'No hay movimientos con ese filtro.' },
  })

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Title order={3}>Sumas y saldos</Title>
        <BotonDeAyuda clave="informes" />
      </Group>

      <Group align="flex-end" gap="md" wrap="wrap">
        <Select
          label="Agrupar por"
          data={NIVELES}
          value={String(nivel)}
          onChange={(valor) => setNivel(Number(valor ?? 3) as NivelDeBalance)}
          allowDeselect={false}
          w={180}
        />
        <CasillaDeCuenta
          id="cuenta-desde"
          label="Cuenta desde"
          obligatoria={false}
          valor={cuentaDesde}
          ancho={ancho}
          alCambiar={setCuentaDesde}
          alCrear={() => undefined}
        />
        <CasillaDeCuenta
          id="cuenta-hasta"
          label="Cuenta hasta"
          obligatoria={false}
          valor={cuentaHasta}
          ancho={ancho}
          alCambiar={setCuentaHasta}
          alCrear={() => undefined}
        />
        <CasillaFecha
          label="Desde"
          value={desde}
          onChange={(valor) => setDesde(valor as Date | null)}
          clearable
          w={150}
        />
        <CasillaFecha
          label="Hasta"
          value={hasta}
          onChange={(valor) => setHasta(valor as Date | null)}
          clearable
          w={150}
        />
        <Checkbox
          label="Incluir borradores"
          checked={borradores}
          onChange={(e) => setBorradores(e.currentTarget.checked)}
          pb={8}
        />
        <Button onClick={ver} disabled={ejercicio === null}>
          Ver
        </Button>
        <Tooltip label="Descargar en Excel" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Descargar en Excel"
            loading={bajando}
            disabled={balance === null || balance.lineas.length === 0}
            onClick={() => void bajarExcel()}
            mb={4}
          >
            <IconFileSpreadsheet size={20} color="var(--mantine-color-green-7)" />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" role="alert" title="No se pudo cargar el balance">
          {error}
        </Alert>
      )}

      {consulta === null && !error && (
        <Text size="sm" c="dimmed">
          Elige cómo agrupar y pulsa Ver.
        </Text>
      )}

      {consulta !== null && !error && <MantineReactTable table={tabla} />}

      {balance !== null && !error && (
        <Group gap="xl" wrap="wrap">
          <Dato rotulo="Total debe" valor={formatearImporte(balance.total_debe)} />
          <Dato rotulo="Total haber" valor={formatearImporte(balance.total_haber)} />
          <Text size="sm" c="dimmed">
            {`${formatearEntero(balance.lineas.length)} líneas`}
          </Text>
          {cargando && <Loader size="xs" />}
        </Group>
      )}

      <ModalMayor
        cuenta={mayorDe}
        ejercicio={consulta?.ejercicio ?? null}
        alCerrar={() => setMayorDe('')}
      />
    </Stack>
  )
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Group gap={6}>
      <Text size="sm" c="dimmed">
        {rotulo}
      </Text>
      <Text size="sm" fw={600} ff="monospace">
        {valor}
      </Text>
    </Group>
  )
}
