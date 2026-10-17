import { Alert, Button, Group, NumberInput, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from 'mantine-react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import {
  crearLineaB,
  editarLineaB,
  eliminarLineaB,
  listarDiarioB,
  type LineaDiarioB,
} from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import { CasillaFecha } from '../../components/CasillaFecha'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { formatearEntero, formatearFecha, formatearImporte } from '../../lib/format'
import DialogoConfirmar from '../traspasos/DialogoConfirmar'
import DialogoLineaB from './DialogoLineaB'
import { IconosDeFila, propsDeFilaMarcable } from './filaMarcada'

interface Props {
  ejercicio: number | null
  nivel: string
  ancho: number
}

const VER = [
  { value: 'todas', label: 'Todas' },
  { value: '1', label: 'Del libro' },
  { value: '0', label: 'Borradores' },
]

const POR_PAGINA = 100

const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: { fz: 'sm', py: 4, style: { justifyContent: 'flex-end' } },
} as const

function Importe({ valor }: { valor: LineaDiarioB['debe'] }) {
  if (valor.isZero()) return null
  return (
    <Text fz="sm" ta="right" ff="monospace">
      {formatearImporte(valor)}
    </Text>
  )
}

/** Las líneas del diario B, filtradas y paginadas en el servidor. */
export default function TablaDiarioB({ ejercicio, nivel, ancho }: Props) {
  const puedeTocar = alcanza(nivel, 'apuntes')
  const [anio, setAnio] = useState<number | string>(ejercicio ?? '')
  const [asiento, setAsiento] = useState<number | string>('')
  const [cuenta, setCuenta] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [ver, setVer] = useState('todas')
  const [pagina, setPagina] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: POR_PAGINA })
  const [lineas, setLineas] = useState<LineaDiarioB[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  // Nula: diálogo cerrado; 'nueva': alta; una línea: edición.
  const [editando, setEditando] = useState<LineaDiarioB | 'nueva' | null>(null)
  const [borrando, setBorrando] = useState<LineaDiarioB | null>(null)
  // La fila marcada, por su número. Si deja de estar en la página, no hay ninguna.
  const [marcada, setMarcada] = useState<number | null>(null)

  // Lo que se teclea espera a que se deje de escribir para no pedir en cada letra.
  // Uno a uno y nunca un objeto: un objeto nuevo en cada pintada contaría como
  // cambio y volvería a pedir sin parar.
  const [anioTecleado] = useDebouncedValue(anio, 400)
  const [asientoTecleado] = useDebouncedValue(asiento, 400)
  const [cuentaTecleada] = useDebouncedValue(cuenta.trim(), 400)

  const filtro = useMemo(
    () => ({
      ejercicio: anioTecleado === '' ? null : Number(anioTecleado),
      asiento: asientoTecleado === '' ? null : Number(asientoTecleado),
      cuenta: cuentaTecleada,
      fecha_desde: desde,
      fecha_hasta: hasta,
      contabilizado: ver === 'todas' ? null : Number(ver),
    }),
    [anioTecleado, asientoTecleado, cuentaTecleada, desde, hasta, ver],
  )

  // Un filtro nuevo vuelve a la primera página.
  useEffect(() => setPagina((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 })), [filtro])

  useEffect(() => {
    const corte = new AbortController()
    setCargando(true)
    setError(null)
    listarDiarioB(
      { ...filtro, offset: pagina.pageIndex * pagina.pageSize, limit: pagina.pageSize },
      corte.signal,
    )
      .then((respuesta) => {
        setLineas(respuesta.lineas)
        setTotal(respuesta.total)
        setCargando(false)
      })
      .catch((fallo: unknown) => {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setCargando(false)
      })
    return () => corte.abort()
  }, [filtro, pagina, recarga])

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])

  const columnas = useMemo<MRT_ColumnDef<LineaDiarioB>[]>(
    () => [
      { accessorKey: 'ejercicio', header: 'Ejercicio', size: 90, grow: false },
      { accessorKey: 'asiento', header: 'Asiento', size: 90, grow: false },
      {
        accessorKey: 'fecha',
        header: 'Fecha',
        size: 110,
        grow: false,
        Cell: ({ row }) => formatearFecha(row.original.fecha),
      },
      {
        accessorKey: 'cuenta',
        header: 'Cuenta',
        size: 130,
        grow: false,
        Cell: ({ row }) => (
          <Text fz="sm" ff="monospace">
            {row.original.cuenta}
          </Text>
        ),
      },
      {
        accessorKey: 'concepto',
        header: 'Concepto',
        grow: true,
        mantineTableBodyCellProps: CELDA_QUE_CRECE,
      },
      { accessorKey: 'documento', header: 'Documento', size: 140, grow: false },
      {
        accessorKey: 'debe',
        header: 'Debe',
        size: 120,
        grow: false,
        ...A_LA_DERECHA,
        Cell: ({ row }) => <Importe valor={row.original.debe} />,
      },
      {
        accessorKey: 'haber',
        header: 'Haber',
        size: 120,
        grow: false,
        ...A_LA_DERECHA,
        Cell: ({ row }) => <Importe valor={row.original.haber} />,
      },
      ...(puedeTocar
        ? [
            {
              id: 'acciones',
              header: '',
              size: 70,
              grow: false,
              Cell: ({ row }: { row: { original: LineaDiarioB } }) => (
                <IconosDeFila
                  alCambiar={() => setEditando(row.original)}
                  alBorrar={() => setBorrando(row.original)}
                />
              ),
            } satisfies MRT_ColumnDef<LineaDiarioB>,
          ]
        : []),
    ],
    [puedeTocar],
  )

  const seleccionada = lineas.find((f) => f.pase === marcada) ?? null

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<LineaDiarioB>(),
    columns: columnas,
    data: lineas,
    getRowId: (fila) => String(fila.pase),
    manualPagination: true,
    autoResetPageIndex: false,
    rowCount: total,
    onPaginationChange: setPagina,
    mantinePaginationProps: { showRowsPerPage: false },
    // Una sola a la vez: pulsar la marcada la desmarca.
    mantineTableBodyRowProps: ({ row }) =>
      propsDeFilaMarcable(row.original.pase === marcada, () =>
        setMarcada((m) => (m === row.original.pase ? null : row.original.pase)),
      ),
    localization: { noRecordsToDisplay: 'No hay líneas con estos filtros.' },
    state: { isLoading: cargando && lineas.length === 0, pagination: pagina },
  })

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="md">
        <NumberInput
          label="Ejercicio"
          value={anio}
          onChange={setAnio}
          allowDecimal={false}
          allowNegative={false}
          w={100}
        />
        <NumberInput
          label="Asiento"
          value={asiento}
          onChange={setAsiento}
          allowDecimal={false}
          allowNegative={false}
          w={100}
        />
        <TextInput
          label="Cuenta que empieza por"
          value={cuenta}
          onChange={(e) => setCuenta(e.currentTarget.value)}
          w={180}
        />
        <CasillaFecha
          label="Desde"
          value={fechaDeApi(desde)}
          onChange={(valor) => setDesde(fechaParaApi(valor))}
          clearable
          w={150}
        />
        <CasillaFecha
          label="Hasta"
          value={fechaDeApi(hasta)}
          onChange={(valor) => setHasta(fechaParaApi(valor))}
          clearable
          w={150}
        />
        <Stack gap={2}>
          <Text fz="sm" fw={500}>
            Ver
          </Text>
          <SegmentedControl size="xs" value={ver} onChange={setVer} data={VER} />
        </Stack>
        {puedeTocar && (
          <Group gap="xs" ml="auto">
            {seleccionada && (
              <>
                <Button variant="default" onClick={() => setEditando(seleccionada)}>
                  Cambiar…
                </Button>
                <Button variant="light" color="red" onClick={() => setBorrando(seleccionada)}>
                  Borrar…
                </Button>
              </>
            )}
            <Button onClick={() => setEditando('nueva')}>Nueva línea…</Button>
          </Group>
        )}
      </Group>

      {error ? (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      ) : (
        <Text size="sm">{formatearEntero(total)} líneas</Text>
      )}

      <MantineReactTable table={tabla} />

      {editando !== null && (
        <DialogoLineaB
          linea={editando === 'nueva' ? null : editando}
          ejercicio={filtro.ejercicio ?? ejercicio}
          ancho={ancho}
          alCerrar={() => setEditando(null)}
          alGuardar={async (datos) => {
            if (editando === 'nueva') await crearLineaB(datos)
            else await editarLineaB(editando.pase, datos)
            setEditando(null)
            recargar()
          }}
        />
      )}

      <DialogoConfirmar
        abierto={borrando !== null}
        titulo="Borrar la línea"
        texto={
          borrando
            ? `Se borra la línea de la cuenta ${borrando.cuenta} del asiento ${borrando.asiento}. No se puede deshacer.`
            : ''
        }
        rotulo="Borrar"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          if (!borrando) return
          await eliminarLineaB(borrando.pase)
          setBorrando(null)
          recargar()
        }}
      />
    </Stack>
  )
}
