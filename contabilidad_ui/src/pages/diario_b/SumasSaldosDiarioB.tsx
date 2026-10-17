import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import type Decimal from 'decimal.js'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { diarioBEntero, equivalenciasEnteras } from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import type { NivelDeBalance } from '../../api/informes'
import { CasillaFecha } from '../../components/CasillaFecha'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { fechaParaApi } from '../../lib/fecha'
import { formatearEntero, formatearImporte } from '../../lib/format'
import { sumarDiarioB, type SumaDeCuenta, type SumasDiarioB } from './sumasDiarioB'

interface Props {
  ejercicio: number | null
}

/** Lo que se está viendo, que no cambia mientras se retoca el filtro. */
interface Consulta {
  ejercicio: number
  desde: string
  hasta: string
  ver: string
  conEquivalencias: boolean
  nivel: NivelDeBalance
}

/** Los mismos que en sumas y saldos. Aquí entra por subcuenta, que es el detalle. */
const NIVELES = [
  { value: '1', label: 'Grupo' },
  { value: '2', label: 'Subgrupo' },
  { value: '3', label: 'Cuenta de mayor' },
  { value: '0', label: 'Subcuenta' },
]

const VER = [
  { value: 'todas', label: 'Todas' },
  { value: '1', label: 'Del libro' },
  { value: '0', label: 'Borradores' },
]

/** Los importes pegados a la derecha y en monospace, como en sumas y saldos. */
const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: {
    fz: 'sm',
    py: 4,
    ff: 'monospace',
    style: { justifyContent: 'flex-end' },
  },
  mantineTableFooterCellProps: { ff: 'monospace', style: { justifyContent: 'flex-end' } },
} as const

type Importes = SumasDiarioB['total']

function columnaDeImporte(
  id: keyof Importes,
  cabecera: string,
  total: Importes | null,
): MRT_ColumnDef<SumaDeCuenta> {
  return {
    id,
    header: cabecera,
    size: 130,
    grow: false,
    ...A_LA_DERECHA,
    Cell: ({ row }) => importeOVacio(row.original[id]),
    Footer: () => (total ? formatearImporte(total[id]) : ''),
  }
}

function importeOVacio(valor: Decimal): string {
  return valor.isZero() ? '' : formatearImporte(valor)
}

/**
 * Sumas y saldos del diario B, cuenta a cuenta. El SIF no lo da hecho, así que
 * se traen todas las líneas del filtro y se suman aquí (ver `sumarDiarioB`).
 */
export default function SumasSaldosDiarioB({ ejercicio }: Props) {
  const plan = usePlanEnMemoria()
  const [desde, setDesde] = useState<Date | null>(null)
  const [hasta, setHasta] = useState<Date | null>(null)
  const [ver, setVer] = useState('todas')
  const [conEquivalencias, setConEquivalencias] = useState(false)
  const [nivel, setNivel] = useState<NivelDeBalance>(0)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [sumas, setSumas] = useState<SumasDiarioB | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (consulta === null) return
    const corte = new AbortController()
    setCargando(true)
    setError(null)
    Promise.all([
      diarioBEntero(
        {
          ejercicio: consulta.ejercicio,
          asiento: null,
          cuenta: '',
          fecha_desde: consulta.desde,
          fecha_hasta: consulta.hasta,
          contabilizado: consulta.ver === 'todas' ? null : Number(consulta.ver),
        },
        corte.signal,
      ),
      consulta.conEquivalencias ? equivalenciasEnteras(corte.signal) : Promise.resolve(null),
    ])
      .then(([lineas, equivalencias]) => {
        setSumas(
          sumarDiarioB(
            lineas,
            equivalencias,
            (cuenta) => plan.porCodigo.get(cuenta)?.descripcion,
            consulta.nivel,
          ),
        )
        setCargando(false)
      })
      .catch((fallo: unknown) => {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setSumas(null)
        setCargando(false)
      })
    return () => corte.abort()
    // El plan no entra: si llega más tarde, los títulos se ponen al volver a pulsar Ver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta])

  function verSumas() {
    if (ejercicio === null) return
    setConsulta({
      ejercicio,
      desde: fechaParaApi(desde),
      hasta: fechaParaApi(hasta),
      ver,
      conEquivalencias,
      nivel,
    })
  }

  const total = sumas?.total ?? null
  const columnas = useMemo<MRT_ColumnDef<SumaDeCuenta>[]>(
    () => [
      {
        accessorKey: 'cuenta',
        header: 'Cuenta',
        size: 130,
        grow: false,
        Cell: ({ row }) => (
          <Text fz="sm" ff="monospace" fw={500}>
            {row.original.cuenta}
          </Text>
        ),
        Footer: () => 'Totales',
      },
      {
        accessorKey: 'titulo',
        header: 'Título',
        grow: true,
        mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
      },
      columnaDeImporte('debe', 'Suma debe', total),
      columnaDeImporte('haber', 'Suma haber', total),
      columnaDeImporte('deudor', 'Saldo deudor', total),
      columnaDeImporte('acreedor', 'Saldo acreedor', total),
    ],
    [total],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<SumaDeCuenta>(),
    columns: columnas,
    data: sumas?.cuentas ?? [],
    getRowId: (fila) => fila.cuenta,
    enablePagination: false,
    enableBottomToolbar: false,
    enableStickyFooter: true,
    // Solo la primera vez: en una recarga las cuentas de antes se quedan puestas
    // hasta que llegan las nuevas, y así la tabla no parpadea.
    state: { isLoading: cargando && sumas === null },
    localization: { noRecordsToDisplay: 'No hay movimientos con ese filtro.' },
  })

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="md" wrap="wrap">
        <Select
          label="Agrupar por"
          data={NIVELES}
          value={String(nivel)}
          onChange={(valor) => setNivel(Number(valor ?? 0) as NivelDeBalance)}
          allowDeselect={false}
          w={180}
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
        <Stack gap={2}>
          <Text fz="sm" fw={500}>
            Ver
          </Text>
          <SegmentedControl size="xs" value={ver} onChange={setVer} data={VER} />
        </Stack>
        <Checkbox
          label="Aplicar equivalencias de cuentas"
          checked={conEquivalencias}
          onChange={(e) => setConEquivalencias(e.currentTarget.checked)}
          pb={8}
        />
        <Button onClick={verSumas} disabled={ejercicio === null} loading={cargando}>
          Ver
        </Button>
      </Group>

      {error && (
        <Alert color="red" role="alert" title="No se pudieron calcular las sumas y saldos">
          {error}
        </Alert>
      )}

      {consulta === null && !error && (
        <Text size="sm" c="dimmed">
          {ejercicio === null
            ? 'Elige un ejercicio arriba.'
            : `Ejercicio ${ejercicio}. Elige el filtro y pulsa Ver.`}
        </Text>
      )}

      {consulta !== null && !error && <MantineReactTable table={tabla} />}

      {sumas !== null && !error && (
        <Group gap="xl" wrap="wrap">
          <Text size="sm" c="dimmed">
            {`${formatearEntero(sumas.cuentas.length)} cuentas`}
          </Text>
          {cargando && <Loader size="xs" />}
        </Group>
      )}
    </Stack>
  )
}
