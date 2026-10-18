import {
  Alert,
  Button,
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
import { planEntero } from '../../api/plan'
import { textoDeError } from '../../api/errores'
import type { NivelDeBalance } from '../../api/informes'
import { CasillaFecha } from '../../components/CasillaFecha'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { fechaParaApi } from '../../lib/fecha'
import { formatearEntero, formatearImporte } from '../../lib/format'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import DialogoOpcionesSumas, {
  normalizarOpciones,
  type OpcionesSumas,
} from './DialogoOpcionesSumas'
import {
  quitarSinSaldo,
  sumarDiarioB,
  type ImportesDiarioB,
  type SumaDeCuenta,
  type SumasDiarioB,
} from './sumasDiarioB'

interface Props {
  ejercicio: number | null
  /** Usuario y empresa, para recordar las opciones. */
  quienGuarda: string
}

const PREFERENCIA_OPCIONES = 'diario_b.sumas.opciones'

/** Lo que se está viendo, que no cambia mientras se retoca el filtro. */
interface Consulta extends OpcionesSumas {
  ejercicio: number
  desde: string
  hasta: string
  ver: string
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

function columnaDeImporte(
  id: keyof ImportesDiarioB,
  cabecera: string,
  total: ImportesDiarioB | null,
): MRT_ColumnDef<SumaDeCuenta> {
  return {
    id,
    header: cabecera,
    size: 130,
    grow: false,
    ...A_LA_DERECHA,
    Cell: ({ row }) => <ImporteOVacio valor={row.original[id]} />,
    Footer: () => (total ? <ImporteOVacio valor={total[id]} conCero /> : ''),
  }
}

/** En blanco si es cero; en rojo si es negativo, que solo pasa en el saldo inicial. */
function ImporteOVacio({ valor, conCero = false }: { valor: Decimal; conCero?: boolean }) {
  if (valor.isZero() && !conCero) return null
  return (
    <Text fz="sm" ff="monospace" c={valor.isNegative() && !valor.isZero() ? 'red' : undefined}>
      {formatearImporte(valor)}
    </Text>
  )
}

/**
 * Sumas y saldos del diario B, cuenta a cuenta. El SIF no lo da hecho, así que
 * se traen todas las líneas del filtro y se suman aquí (ver `sumarDiarioB`).
 */
export default function SumasSaldosDiarioB({ ejercicio, quienGuarda }: Props) {
  const plan = usePlanEnMemoria()
  const [desde, setDesde] = useState<Date | null>(null)
  const [hasta, setHasta] = useState<Date | null>(null)
  const [ver, setVer] = useState('todas')
  const [nivel, setNivel] = useState<NivelDeBalance>(0)
  const [opciones, setOpciones] = useState<OpcionesSumas>(() =>
    normalizarOpciones(leerPreferencia<unknown>(quienGuarda, PREFERENCIA_OPCIONES)),
  )
  const [viendoOpciones, setViendoOpciones] = useState(false)
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
          // El ejercicio entero: lo anterior a «desde» hace falta para el saldo
          // inicial, y las fechas se separan al sumar.
          fecha_desde: '',
          fecha_hasta: '',
          contabilizado: consulta.ver === 'todas' ? null : Number(consulta.ver),
        },
        corte.signal,
      ),
      // Para saber qué cuentas no tienen equivalencia también hacen falta.
      consulta.conEquivalencias ||
      consulta.soloSinEquivalencia ||
      consulta.descripcionSinEquivalencia
        ? equivalenciasEnteras(corte.signal)
        : Promise.resolve(null),
      // El plan en memoria deja fuera las cuentas ocultas y retiradas: para
      // buscar descripciones se trae entero.
      consulta.descripcionSinEquivalencia
        ? planEntero(consulta.ejercicio)
        : Promise.resolve(null),
    ])
      .then(([lineas, equivalencias, planCompleto]) => {
        const titulos = new Map((planCompleto ?? []).map((c) => [c.codigo, c.descripcion ?? '']))
        setSumas(
          sumarDiarioB(lineas, {
            equivalencias: consulta.conEquivalencias ? equivalencias : null,
            soloSinEquivalencia: consulta.soloSinEquivalencia ? equivalencias : null,
            descripcionSinEquivalencia:
              consulta.descripcionSinEquivalencia && equivalencias
                ? { equivalencias, buscar: (codigo) => titulos.get(codigo) }
                : null,
            tituloDelPlan: (cuenta) => plan.porCodigo.get(cuenta)?.descripcion,
            nivel: consulta.nivel,
            desde: consulta.desde,
            hasta: consulta.hasta,
            sinRegularizacion: consulta.sinRegularizacion,
          }),
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
      nivel,
      ...opciones,
    })
  }

  function aplicarOpciones(nuevas: OpcionesSumas) {
    setViendoOpciones(false)
    setOpciones(nuevas)
    guardarPreferencia(quienGuarda, PREFERENCIA_OPCIONES, nuevas)
    // Si ya hay algo calculado, se rehace con las opciones nuevas.
    setConsulta((actual) => (actual === null ? null : { ...actual, ...nuevas }))
  }

  // Ocultar las cuentas sin saldo solo quita filas: los totales siguen siendo
  // los de todas las líneas que entran, para que debe y haber cuadren.
  const filas = useMemo(
    () =>
      sumas && consulta?.ocultarSinSaldo ? quitarSinSaldo(sumas.cuentas) : (sumas?.cuentas ?? []),
    [sumas, consulta?.ocultarSinSaldo],
  )
  const ocultas = (sumas?.cuentas.length ?? 0) - filas.length

  const total = sumas?.total ?? null
  // Las dos primeras van en un grupo sin cabecera: así la fila de cabeceras de
  // grupo no deja en el pie una segunda fila vacía.
  const columnas = useMemo<MRT_ColumnDef<SumaDeCuenta>[]>(
    () => [
      {
        id: 'cuenta_y_descripcion',
        header: '',
        columns: [
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
            header: 'Descripción',
            grow: true,
            mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
          },
        ],
      },
      {
        id: 'periodo',
        header: 'Periodo',
        mantineTableHeadCellProps: { style: { justifyContent: 'center' } },
        columns: [
          columnaDeImporte('inicial', 'Saldo inicial', total),
          columnaDeImporte('debe', 'Debe', total),
          columnaDeImporte('haber', 'Haber', total),
        ],
      },
      {
        id: 'acumulados',
        header: 'Acumulados',
        mantineTableHeadCellProps: { style: { justifyContent: 'center' } },
        columns: [
          columnaDeImporte('acumDebe', 'Debe', total),
          columnaDeImporte('acumHaber', 'Haber', total),
          columnaDeImporte('deudor', 'Saldo deudor', total),
          columnaDeImporte('acreedor', 'Saldo acreedor', total),
        ],
      },
    ],
    [total],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<SumaDeCuenta>(),
    columns: columnas,
    data: filas,
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
        <Button variant="default" onClick={() => setViendoOpciones(true)}>
          Opciones…
        </Button>
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
            {`${formatearEntero(filas.length)} cuentas`}
          </Text>
          {ocultas > 0 && (
            <Text size="xs" c="dimmed">
              {`${formatearEntero(ocultas)} cuentas sin saldo ocultas. Los totales las incluyen.`}
            </Text>
          )}
          {cargando && <Loader size="xs" />}
        </Group>
      )}

      <DialogoOpcionesSumas
        abierto={viendoOpciones}
        opciones={opciones}
        alAplicar={aplicarOpciones}
      />
    </Stack>
  )
}
