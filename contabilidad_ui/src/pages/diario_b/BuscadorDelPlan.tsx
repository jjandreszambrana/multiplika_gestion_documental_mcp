import { Alert, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { listarPlan, type CuentaPlan } from '../../api/plan'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { yaAsignadaA, type DestinoUsado } from './datosEquivalencia'
import { propsDeFilaMarcable } from './filaMarcada'

interface Props {
  ejercicio: number | null
  /** Lo que se busca al abrir. */
  busqueda: string
  elegida: CuentaPlan | null
  alElegir: (cuenta: CuentaPlan | null) => void
  /**
   * Cuentas que ya son destino de otra equivalencia: salen apagadas y no se
   * pueden elegir, porque una cuenta de destino solo puede serlo de una.
   */
  usados?: DestinoUsado[]
}

/** Tope de resultados: más de esto no se lee, se afina la búsqueda. */
const MAXIMO = 50

/**
 * Buscador de subcuentas en el plan del SIF, por código o por título, como la
 * pantalla del plan (`/plan/listar` con `texto`). Solo subcuentas: es lo único
 * a lo que se puede llevar un apunte. Se marca una fila pulsándola.
 */
export default function BuscadorDelPlan({
  ejercicio,
  busqueda,
  elegida,
  alElegir,
  usados = [],
}: Props) {
  const [texto, setTexto] = useState(busqueda)
  const [buscado] = useDebouncedValue(texto.trim(), 400)
  const [cuentas, setCuentas] = useState<CuentaPlan[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (buscado === '') {
      setCuentas([])
      return
    }
    let vigente = true
    setCargando(true)
    setError(null)
    listarPlan({
      ejercicio,
      texto: buscado,
      soloAuxiliares: true,
      incluirApartadas: false,
      offset: 0,
      limit: MAXIMO,
    })
      .then((respuesta) => {
        if (!vigente) return
        setCuentas(respuesta.cuentas ?? [])
        setCargando(false)
      })
      .catch((fallo: unknown) => {
        if (!vigente) return
        setError(textoDeError(fallo))
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [ejercicio, buscado])

  const columnas = useMemo<MRT_ColumnDef<CuentaPlan>[]>(
    () => [
      {
        accessorKey: 'codigo',
        header: 'Cuenta',
        size: 130,
        grow: false,
        Cell: ({ row }) => (
          <Text fz="sm" ff="monospace">
            {row.original.codigo}
          </Text>
        ),
      },
      {
        accessorKey: 'descripcion',
        header: 'Título',
        grow: true,
        mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
        Cell: ({ row }) => {
          const origen = yaAsignadaA(row.original.codigo, usados)
          return (
            <Text fz="sm">
              {row.original.descripcion ?? ''}
              {origen !== null && (
                <Text span fz="xs" c="dimmed" ml="xs">
                  {`Ya asignada a ${origen}`}
                </Text>
              )}
            </Text>
          )
        },
      },
    ],
    [usados],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<CuentaPlan>(),
    columns: columnas,
    data: cuentas,
    getRowId: (fila) => fila.codigo,
    enablePagination: false,
    enableBottomToolbar: false,
    mantineTableContainerProps: { style: { maxHeight: '45vh' } },
    mantineTableBodyRowProps: ({ row }) =>
      yaAsignadaA(row.original.codigo, usados) !== null
        ? { style: { opacity: 0.5, cursor: 'not-allowed' }, 'aria-disabled': true }
        : propsDeFilaMarcable(row.original.codigo === elegida?.codigo, () =>
            alElegir(elegida?.codigo === row.original.codigo ? null : row.original),
          ),
    localization: { noRecordsToDisplay: 'No hay subcuentas con esa búsqueda.' },
    state: { isLoading: cargando && cuentas.length === 0 },
  })

  return (
    <Stack gap="sm">
      <TextInput
        label="Buscar por cuenta o título"
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
        data-autofocus
      />
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      <MantineReactTable table={tabla} />
    </Stack>
  )
}
