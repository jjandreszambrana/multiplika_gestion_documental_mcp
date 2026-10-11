import { Alert, Badge, Select, Stack, Text } from '@mantine/core'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { listarEjecuciones, type EjecucionPlantilla, type ResumenPlantilla } from '../../api/plantillas'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { formatearEntero, formatearFecha } from '../../lib/format'
import { resumenDeDatos } from './datos'

interface Props {
  plantillas: ResumenPlantilla[]
}

const ESTADOS: Record<string, { texto: string; color: string }> = {
  borrador: { texto: 'Borrador', color: 'yellow' },
  contabilizado: { texto: 'Contabilizado', color: 'green' },
  descartado: { texto: 'Descartado', color: 'gray' },
}

function dondeQuedo(e: EjecucionPlantilla): string {
  const quien = e.papel === 'reversion' ? ' (reversión)' : ''
  if (e.estado === 'contabilizado') return `Asiento ${e.asiento} de ${e.ejercicio}${quien}`
  if (e.estado === 'borrador') return `Borrador ${e.id_borrador}${quien}`
  return ''
}

const COLUMNAS: MRT_ColumnDef<EjecucionPlantilla>[] = [
  {
    id: 'cuando',
    header: 'Cuándo',
    size: 140,
    grow: false,
    Cell: ({ row }) =>
      `${formatearFecha(row.original.fecha_alta)} ${(row.original.fecha_alta ?? '').slice(11, 16)}`,
  },
  {
    id: 'plantilla',
    header: 'Plantilla',
    size: 220,
    grow: false,
    Cell: ({ row }) => `${row.original.codigo} · ${row.original.nombre}`,
  },
  { accessorKey: 'version', header: 'Versión', size: 80, grow: false },
  { id: 'quien', header: 'Quién', size: 120, grow: false, Cell: ({ row }) => row.original.usuario ?? '' },
  { id: 'asiento', header: 'Asiento', size: 190, grow: false, Cell: ({ row }) => dondeQuedo(row.original) },
  {
    id: 'estado',
    header: 'Estado',
    size: 120,
    grow: false,
    Cell: ({ row }) => {
      const estado = ESTADOS[row.original.estado]
      return (
        <Badge size="xs" color={estado?.color ?? 'gray'}>
          {estado?.texto ?? row.original.estado}
        </Badge>
      )
    },
  },
  {
    id: 'datos',
    header: 'Datos tecleados',
    grow: true,
    mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
    Cell: ({ row }) => resumenDeDatos(row.original.parametros),
  },
]

/**
 * Qué se ha hecho con las plantillas: con cuál y qué versión, quién, cuándo,
 * qué asiento o borrador salió y con qué datos. Un borrador que se tiró sale
 * como descartado: es rastro, no se esconde.
 */
export default function HistorialUso({ plantillas }: Props) {
  const [idPlantilla, setIdPlantilla] = useState<number | null>(null)
  const [ejecuciones, setEjecuciones] = useState<EjecucionPlantilla[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarEjecuciones(idPlantilla)
      .then((lista) => vigente && setEjecuciones(lista))
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [idPlantilla])

  const datos = useMemo(() => (error ? [] : ejecuciones), [error, ejecuciones])
  const tabla = useMantineReactTable({
    ...opcionesDeTabla<EjecucionPlantilla>(),
    columns: COLUMNAS,
    data: datos,
    enablePagination: false,
    enableBottomToolbar: false,
    state: { isLoading: cargando },
    getRowId: (e) => String(e.id),
    renderEmptyRowsFallback: () => (
      <Text size="sm" c="dimmed" p="md">
        Todavía no se ha hecho ningún asiento con plantillas.
      </Text>
    ),
  })

  return (
    <Stack gap="sm">
      <Select
        label="Plantilla"
        placeholder="Todas"
        data={plantillas.map((p) => ({ value: String(p.id), label: `${p.codigo} · ${p.nombre}` }))}
        value={idPlantilla === null ? null : String(idPlantilla)}
        onChange={(v) => setIdPlantilla(v === null ? null : Number(v))}
        clearable
        searchable
        w={360}
      />
      {error && <Alert color="red">{error}</Alert>}
      {!error && <Text size="sm">{`${formatearEntero(ejecuciones.length)} asientos`}</Text>}
      <MantineReactTable table={tabla} />
    </Stack>
  )
}
