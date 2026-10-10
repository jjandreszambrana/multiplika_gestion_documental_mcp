import { Group, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { listarTerceros, type Tercero, type TipoTercero } from '../../api/terceros'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { formatearEntero } from '../../lib/format'

const ESPERA_TECLEO_MS = 300
const POR_PAGINA = 200

/**
 * Qué subcuenta tiene cada cliente y cada proveedor. Es la pregunta que hasta
 * ahora solo se podía contestar entrando en la base de datos.
 *
 * `razon` y `cif` son los del momento del alta y no se refrescan desde
 * gestión: un asiento antiguo tiene que imprimirse con el nombre de entonces.
 */
export default function TercerosEnlazados() {
  const [tipo, setTipo] = useState<'todos' | TipoTercero>('todos')
  const [buscar, setBuscar] = useState('')
  const [buscarAplicado] = useDebouncedValue(buscar, ESPERA_TECLEO_MS)

  const [terceros, setTerceros] = useState<Tercero[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)

    listarTerceros({
      tipo: tipo === 'todos' ? null : tipo,
      texto: buscarAplicado,
      offset: 0,
      limit: POR_PAGINA,
    })
      .then((respuesta) => {
        if (!vigente) return
        setTerceros(respuesta.terceros ?? [])
        setTotal(respuesta.total)
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
  }, [tipo, buscarAplicado])

  const columnas = useMemo<MRT_ColumnDef<Tercero>[]>(
    () => [
      { accessorKey: 'cuenta', header: 'Subcuenta', size: 130, grow: false },
      {
        accessorKey: 'razon',
        header: 'Razón social en el alta',
        grow: true,
        mantineTableBodyCellProps: CELDA_QUE_CRECE,
      },
      { accessorKey: 'cif', header: 'NIF', size: 130, grow: false },
      {
        accessorKey: 'tipo',
        header: 'Clase',
        size: 110,
        grow: false,
        Cell: ({ row }) => (row.original.tipo === 'cliente' ? 'Cliente' : 'Proveedor'),
      },
    ],
    [],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<Tercero>(),
    columns: columnas,
    data: terceros,
    localization: {
      noRecordsToDisplay:
        buscarAplicado === ''
          ? 'Ningún tercero tiene subcuenta todavía'
          : 'Ningún tercero coincide con la búsqueda',
    },
    state: { isLoading: cargando, showAlertBanner: error !== null },
    mantineToolbarAlertBannerProps: error ? { color: 'red', children: error } : undefined,
  })

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="md">
        <SegmentedControl
          value={tipo}
          onChange={(valor) => setTipo(valor as 'todos' | TipoTercero)}
          data={[
            { value: 'todos', label: 'Todos' },
            { value: 'cliente', label: 'Clientes' },
            { value: 'proveedor', label: 'Proveedores' },
          ]}
        />
        <TextInput
          label="Buscar"
          placeholder="Cuenta, razón social o NIF"
          value={buscar}
          onChange={(e) => setBuscar(e.currentTarget.value)}
          w={280}
        />
      </Group>

      <Text size="sm">
        {formatearEntero(total)} terceros con subcuenta.
        {total > POR_PAGINA && ` Se muestran los ${formatearEntero(POR_PAGINA)} primeros.`}
      </Text>

      <MantineReactTable table={tabla} />
    </Stack>
  )
}
