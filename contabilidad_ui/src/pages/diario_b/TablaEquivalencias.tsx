import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
} from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import {
  crearEquivalenciaCuenta,
  editarEquivalenciaCuenta,
  eliminarEquivalenciaCuenta,
  listarEquivalenciasCuenta,
  type EquivalenciaCuenta,
} from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { formatearEntero } from '../../lib/format'
import DialogoConfirmar from '../traspasos/DialogoConfirmar'
import DialogoEquivalencia from './DialogoEquivalencia'
import { IconosDeFila, propsDeFilaMarcable } from './filaMarcada'

interface Props {
  nivel: string
  ancho: number
}

const POR_PAGINA = 100

const CODIGO = (cuenta: string) => (
  <Text fz="sm" ff="monospace">
    {cuenta}
  </Text>
)

/** Las equivalencias de cuentas de la empresa, con un buscador. */
export default function TablaEquivalencias({ nivel, ancho }: Props) {
  const puedeTocar = alcanza(nivel, 'cierre')
  const [texto, setTexto] = useState('')
  const [buscado] = useDebouncedValue(texto.trim(), 400)
  const [pagina, setPagina] = useState<MRT_PaginationState>({ pageIndex: 0, pageSize: POR_PAGINA })
  const [filas, setFilas] = useState<EquivalenciaCuenta[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [editando, setEditando] = useState<EquivalenciaCuenta | 'nueva' | null>(null)
  const [borrando, setBorrando] = useState<EquivalenciaCuenta | null>(null)
  // La fila marcada, por su número. Si deja de estar en la página, no hay ninguna.
  const [marcada, setMarcada] = useState<number | null>(null)

  useEffect(() => setPagina((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 })), [buscado])

  useEffect(() => {
    const corte = new AbortController()
    setCargando(true)
    setError(null)
    listarEquivalenciasCuenta(
      buscado,
      pagina.pageIndex * pagina.pageSize,
      pagina.pageSize,
      corte.signal,
    )
      .then((respuesta) => {
        setFilas(respuesta.equivalencias)
        setTotal(respuesta.total)
        setCargando(false)
      })
      .catch((fallo: unknown) => {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setCargando(false)
      })
    return () => corte.abort()
  }, [buscado, pagina, recarga])

  const columnas = useMemo<MRT_ColumnDef<EquivalenciaCuenta>[]>(
    () => [
      {
        accessorKey: 'cuenta_origen',
        header: 'Cuenta de origen',
        size: 140,
        grow: false,
        Cell: ({ row }) => CODIGO(row.original.cuenta_origen),
      },
      { accessorKey: 'titulo_origen', header: 'Título de origen', size: 220, grow: false },
      {
        accessorKey: 'cuenta_destino',
        header: 'Cuenta de destino',
        size: 140,
        grow: false,
        Cell: ({ row }) => CODIGO(row.original.cuenta_destino),
      },
      { accessorKey: 'titulo_destino', header: 'Título de destino', size: 220, grow: false },
      {
        accessorKey: 'observaciones',
        header: 'Observaciones',
        grow: true,
        mantineTableBodyCellProps: CELDA_QUE_CRECE,
      },
      ...(puedeTocar
        ? [
            {
              id: 'acciones',
              header: '',
              size: 70,
              grow: false,
              Cell: ({ row }: { row: { original: EquivalenciaCuenta } }) => (
                <IconosDeFila
                  alCambiar={() => setEditando(row.original)}
                  alBorrar={() => setBorrando(row.original)}
                />
              ),
            } satisfies MRT_ColumnDef<EquivalenciaCuenta>,
          ]
        : []),
    ],
    [puedeTocar],
  )

  const seleccionada = filas.find((f) => f.id === marcada) ?? null

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<EquivalenciaCuenta>(),
    columns: columnas,
    data: filas,
    getRowId: (fila) => String(fila.id),
    manualPagination: true,
    autoResetPageIndex: false,
    rowCount: total,
    onPaginationChange: setPagina,
    mantinePaginationProps: { showRowsPerPage: false },
    // Una sola a la vez: pulsar la marcada la desmarca.
    mantineTableBodyRowProps: ({ row }) =>
      propsDeFilaMarcable(row.original.id === marcada, () =>
        setMarcada((m) => (m === row.original.id ? null : row.original.id)),
      ),
    localization: { noRecordsToDisplay: 'No hay equivalencias.' },
    state: { isLoading: cargando && filas.length === 0, pagination: pagina },
  })

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="md">
        <TextInput
          label="Buscar por cuenta o título"
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value)}
          w={300}
        />
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
            <Button onClick={() => setEditando('nueva')}>Nueva equivalencia…</Button>
          </Group>
        )}
      </Group>

      {error ? (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      ) : (
        <Text size="sm">{formatearEntero(total)} equivalencias</Text>
      )}

      <MantineReactTable table={tabla} />

      {editando !== null && (
        <DialogoEquivalencia
          equivalencia={editando === 'nueva' ? null : editando}
          ancho={ancho}
          alCerrar={() => setEditando(null)}
          alGuardar={async (datos) => {
            if (editando === 'nueva') await crearEquivalenciaCuenta(datos)
            else await editarEquivalenciaCuenta(editando.id, datos)
            setEditando(null)
            setRecarga((n) => n + 1)
          }}
        />
      )}

      <DialogoConfirmar
        abierto={borrando !== null}
        titulo="Borrar la equivalencia"
        texto={
          borrando
            ? `Se borra la equivalencia de ${borrando.cuenta_origen} a ${borrando.cuenta_destino}.`
            : ''
        }
        rotulo="Borrar"
        alCerrar={() => setBorrando(null)}
        alConfirmar={async () => {
          if (!borrando) return
          await eliminarEquivalenciaCuenta(borrando.id)
          setBorrando(null)
          setRecarga((n) => n + 1)
        }}
      />
    </Stack>
  )
}
