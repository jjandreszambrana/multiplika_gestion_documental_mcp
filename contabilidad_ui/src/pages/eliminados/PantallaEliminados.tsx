import { Alert, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import {
  listarEliminados,
  MAXIMO_POR_PAGINA,
  type ApunteEliminado,
  type Incluir,
} from '../../api/eliminados'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import { opcionesDeTabla } from '../../components/tabla'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { formatearEntero } from '../../lib/format'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import { columnasDeEliminados } from './columnas'

interface Props {
  ejercicio: number | null
  /** Identifica a quién se le guardan las fechas en este equipo. */
  usuario: string
}

/** Una consulta por ejercicio, como en el diario: las fechas son de ese año. */
const PREFERENCIA_FECHAS = 'eliminados.fechas'
const fechasDe = (ejercicio: number | null) => `${PREFERENCIA_FECHAS}.${ejercicio ?? 'todos'}`

interface FechasGuardadas {
  desde: string
  hasta: string
  incluir: Incluir
}

const POSICIONES = [
  { value: 'todas', label: 'Todas' },
  { value: 'borradores', label: 'Borradores' },
  { value: 'confirmadas', label: 'Confirmadas' },
]

/** Lo leído del navegador, quedándose solo con lo que sea texto. */
function fechasLeidas(leido: unknown): FechasGuardadas {
  const vacio: FechasGuardadas = { desde: '', hasta: '', incluir: 'todas' }
  if (typeof leido !== 'object' || leido === null) return vacio
  const guardado = leido as Record<string, unknown>
  const incluir = guardado.incluir
  return {
    desde: typeof guardado.desde === 'string' ? guardado.desde : '',
    hasta: typeof guardado.hasta === 'string' ? guardado.hasta : '',
    incluir:
      incluir === 'confirmadas' || incluir === 'borradores' || incluir === 'todas'
        ? incluir
        : 'todas',
  }
}

const COLUMNAS = columnasDeEliminados()

/**
 * Los asientos que salieron del libro. Solo se consultan: no hay forma de
 * recuperarlos, ni aquí ni en la API, igual que un asiento confirmado no se
 * edita ni se borra.
 *
 * Las fechas filtran por la fecha contable del apunte, no por el día en que se
 * quitó: quien busca lo que se borró de marzo pregunta por los de marzo.
 */
export default function PantallaEliminados({ ejercicio, usuario }: Props) {
  const [guardadas] = useState(() =>
    fechasLeidas(leerPreferencia<unknown>(usuario, fechasDe(ejercicio))),
  )
  const [desde, setDesde] = useState(guardadas.desde)
  const [hasta, setHasta] = useState(guardadas.hasta)
  const [incluir, setIncluir] = useState<Incluir>(guardadas.incluir)
  const [apuntes, setApuntes] = useState<ApunteEliminado[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    guardarPreferencia(usuario, fechasDe(ejercicio), { desde, hasta, incluir })
  }, [usuario, ejercicio, desde, hasta, incluir])

  useEffect(() => {
    const corte = new AbortController()
    let vigente = true
    setCargando(true)
    setError(null)

    // Por tandas, como el diario: la API no deja pedir más de 500 de una vez y
    // un asiento no puede quedar partido entre dos páginas.
    async function traerTodo() {
      const acumulado: ApunteEliminado[] = []
      let cuantos = 0

      do {
        const tanda = await listarEliminados(
          { ejercicio, desde, hasta, incluir, offset: acumulado.length, limit: MAXIMO_POR_PAGINA },
          corte.signal,
        )
        if (!vigente) return

        acumulado.push(...tanda.apuntes)
        cuantos = tanda.total
        setApuntes([...acumulado])
        setTotal(cuantos)

        // Una tanda vacía con apuntes por delante: seguir sería pedir lo mismo
        // para siempre.
        if (tanda.apuntes.length === 0) break
      } while (acumulado.length < cuantos)

      if (vigente) setCargando(false)
    }

    traerTodo().catch((fallo: unknown) => {
      if (!vigente || esAbortada(fallo)) return
      setError(textoDeError(fallo))
      setCargando(false)
    })

    return () => {
      vigente = false
      corte.abort()
    }
  }, [ejercicio, desde, hasta, incluir])

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<ApunteEliminado>(),
    columns: COLUMNAS,
    data: apuntes,
    // La clave viene como «x:<pase>», distinta de la de un apunte vivo.
    getRowId: (fila) => fila.clave,
    localization: { noRecordsToDisplay: 'No hay asientos eliminados con esas fechas.' },
    state: { isLoading: cargando && apuntes.length === 0 },
  })

  const cuantos = useMemo(() => formatearEntero(total), [total])

  return (
    <Stack gap="md">
      <Title order={3}>Asientos eliminados</Title>

      <Text size="sm" c="dimmed">
        Aquí quedan los asientos que salieron del libro. Solo se consultan: un asiento eliminado no
        se recupera.
      </Text>

      <Group align="flex-end" gap="md">
        <CasillaFecha
          label="Desde"
          value={fechaDeApi(desde)}
          onChange={(valor) => setDesde(fechaParaApi(valor))}
          clearable
          w={160}
        />
        <CasillaFecha
          label="Hasta"
          value={fechaDeApi(hasta)}
          onChange={(valor) => setHasta(fechaParaApi(valor))}
          clearable
          w={160}
        />
        <Stack gap={2}>
          <Text fz="sm" fw={500}>
            Mostrar
          </Text>
          <SegmentedControl
            size="xs"
            value={incluir}
            onChange={(valor) => setIncluir(valor as Incluir)}
            data={POSICIONES}
          />
        </Stack>
      </Group>

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {!error && (
        <Text size="sm">
          {cargando && total > 0
            ? `Cargando ${formatearEntero(apuntes.length)} de ${cuantos} apuntes…`
            : `${cuantos} apuntes`}
        </Text>
      )}

      <MantineReactTable table={tabla} />
    </Stack>
  )
}
