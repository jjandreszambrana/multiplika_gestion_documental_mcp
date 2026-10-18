import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { crearEquivalenciaCuenta } from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import { listarPlan, type CuentaPlan } from '../../api/plan'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { propsDeFilaMarcable } from './filaMarcada'

interface Props {
  ejercicio: number | null
  /** La cuenta del diario B tal como viene en sus líneas, y su descripción. */
  origen: { cuenta: string; titulo: string }
  /** Lo que se busca al abrir: la subcuenta que casa o la descripción. */
  busqueda: string
  alCerrar: () => void
  alCrear: () => void
}

/** Tope de resultados: más de esto no se lee, se afina la búsqueda. */
const MAXIMO = 50

/**
 * Asigna a una cuenta del diario B su equivalencia en el plan del SIF, desde
 * sumas y saldos. Busca en el servidor, como la pantalla del plan, y solo
 * subcuentas, que es lo único a lo que se puede llevar un apunte.
 */
export default function DialogoAsignarEquivalencia({
  ejercicio,
  origen,
  busqueda,
  alCerrar,
  alCrear,
}: Props) {
  const [texto, setTexto] = useState(busqueda)
  const [buscado] = useDebouncedValue(texto.trim(), 400)
  const [cuentas, setCuentas] = useState<CuentaPlan[]>([])
  const [cargando, setCargando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [elegida, setElegida] = useState<CuentaPlan | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (buscado === '') {
      setCuentas([])
      return
    }
    let vigente = true
    setCargando(true)
    setErrorBusqueda(null)
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
        setErrorBusqueda(textoDeError(fallo))
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [ejercicio, buscado])

  async function crear() {
    if (!elegida) return
    setGuardando(true)
    setError(null)
    try {
      await crearEquivalenciaCuenta({
        cuenta_origen: origen.cuenta,
        ...(origen.titulo !== '' && { titulo_origen: origen.titulo }),
        cuenta_destino: elegida.codigo,
        ...(elegida.descripcion && { titulo_destino: elegida.descripcion }),
      })
      alCrear()
    } catch (fallo) {
      // Un 400 del SIF (p. ej. una equivalencia que ya existe) va tal cual.
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

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
      },
    ],
    [],
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
      propsDeFilaMarcable(row.original.codigo === elegida?.codigo, () =>
        setElegida((antes) => (antes?.codigo === row.original.codigo ? null : row.original)),
      ),
    localization: { noRecordsToDisplay: 'No hay subcuentas con esa búsqueda.' },
    state: { isLoading: cargando && cuentas.length === 0 },
  })

  return (
    <Modal opened onClose={alCerrar} title="Asignar equivalencia" size="lg">
      <Stack gap="sm">
        <Text size="sm">
          Cuenta del diario B:{' '}
          <Text span ff="monospace" fw={600}>
            {origen.cuenta}
          </Text>
          {origen.titulo !== '' && ` ${origen.titulo}`}
        </Text>
        <TextInput
          label="Buscar por cuenta o título"
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value)}
          data-autofocus
        />
        {errorBusqueda && (
          <Alert color="red" role="alert">
            {errorBusqueda}
          </Alert>
        )}
        <MantineReactTable table={tabla} />
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void crear()} disabled={!elegida} loading={guardando}>
            Crear equivalencia
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
