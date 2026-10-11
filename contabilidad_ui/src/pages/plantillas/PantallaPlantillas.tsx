import { Alert, Badge, Button, Checkbox, Group, Menu, ActionIcon, Stack, Tabs, Text, Title } from '@mantine/core'
import { IconDots } from '@tabler/icons-react'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { cambiarActiva, listarPlantillas, type ResumenPlantilla } from '../../api/plantillas'
import { alcanza } from '../../api/sesion'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { formatearFecha } from '../../lib/format'
import DialogoDuplicar from './DialogoDuplicar'
import EditorPlantilla from './editor/EditorPlantilla'
import HistorialUso from './HistorialUso'

interface Props {
  nivel: string
  /** Dígitos de una subcuenta en esta empresa. */
  ancho: number
  ejercicio: number | null
  /** Para la petición a la IA: se dice en qué empresa. */
  nombreEmpresa: string
  /** Dentro del panel de la GD, que tiene el chat de IA. Fuera no hay a quién pedírselo. */
  conIA: boolean
}

/**
 * Abre el chat del panel de la GD con la petición empezada, sin enviarla: el
 * contable termina de contar qué asiento quiere. El panel escucha este evento.
 */
function pedirALaIA(nombreEmpresa: string) {
  const texto =
    `Quiero crear una plantilla de asiento (asiento predefinido) para ${nombreEmpresa}. ` +
    'Prepárala, pruébala y enséñame el asiento antes de guardarla. El asiento es: '
  window.dispatchEvent(new CustomEvent('gd:preguntar-ia', { detail: { texto } }))
}

/** Abierta en el editor: un id, o `nueva`. */
type Editando = number | 'nueva' | null

/**
 * Las plantillas de asiento de la empresa y lo que se ha hecho con ellas.
 * Diseñarlas es de quien lleva el cierre; el resto las ve sin tocarlas. Usarlas
 * se hace desde la entrada de asientos.
 */
export default function PantallaPlantillas({ nivel, ancho, ejercicio, nombreEmpresa, conIA }: Props) {
  const puedeDisenar = alcanza(nivel, 'cierre')
  const [conRetiradas, setConRetiradas] = useState(false)
  const [plantillas, setPlantillas] = useState<ResumenPlantilla[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [editando, setEditando] = useState<Editando>(null)
  const [duplicando, setDuplicando] = useState<ResumenPlantilla | null>(null)
  const [recarga, setRecarga] = useState(0)

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    listarPlantillas(conRetiradas)
      .then((lista) => {
        if (!vigente) return
        setPlantillas(lista)
        setError(null)
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [conRetiradas, recarga])

  const columnas = useMemo<MRT_ColumnDef<ResumenPlantilla>[]>(
    () => [
      {
        accessorKey: 'codigo',
        header: 'Código',
        size: 130,
        grow: false,
        Cell: ({ row }) => <Text size="sm" ff="monospace">{row.original.codigo}</Text>,
      },
      {
        accessorKey: 'nombre',
        header: 'Nombre',
        grow: true,
        mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
        Cell: ({ row }) => (
          <Stack gap={0}>
            <Text size="sm">{row.original.nombre}</Text>
            {row.original.descripcion && (
              <Text size="xs" c="dimmed">
                {row.original.descripcion}
              </Text>
            )}
          </Stack>
        ),
      },
      { accessorKey: 'version_actual', header: 'Versión', size: 80, grow: false },
      {
        id: 'actualizada',
        header: 'Cambiada',
        size: 110,
        grow: false,
        Cell: ({ row }) =>
          formatearFecha(row.original.fecha_hora_actualizacion ?? row.original.fecha_alta),
      },
      {
        id: 'estado',
        header: '',
        size: 90,
        grow: false,
        Cell: ({ row }) =>
          row.original.activa ? null : (
            <Badge size="xs" color="gray">
              Retirada
            </Badge>
          ),
      },
      {
        id: 'acciones',
        header: '',
        size: 50,
        grow: false,
        Cell: ({ row }) =>
          puedeDisenar && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon size="sm" variant="subtle" aria-label="Más" onClick={(e) => e.stopPropagation()}>
                  <IconDots size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                <Menu.Item onClick={() => setDuplicando(row.original)}>Duplicar…</Menu.Item>
                <Menu.Item
                  onClick={() => {
                    setErrorAccion(null)
                    cambiarActiva(row.original.id, !row.original.activa)
                      .then(recargar)
                      .catch((fallo: unknown) => setErrorAccion(textoDeError(fallo)))
                  }}
                >
                  {row.original.activa ? 'Retirar' : 'Volver a ponerla en uso'}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ),
      },
    ],
    [puedeDisenar, recargar],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<ResumenPlantilla>(),
    columns: columnas,
    data: error ? [] : plantillas,
    enablePagination: false,
    enableBottomToolbar: false,
    state: { isLoading: cargando },
    getRowId: (p) => String(p.id),
    mantineTableBodyRowProps: ({ row }) => ({
      onClick: () => setEditando(row.original.id),
      style: { cursor: 'pointer' },
    }),
    renderEmptyRowsFallback: () => (
      <Text size="sm" c="dimmed" p="md">
        Esta empresa no tiene asientos predefinidos todavía.
      </Text>
    ),
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Asientos predefinidos</Title>
          <BotonDeAyuda clave="plantillas_de_asiento" />
        </Group>
      </Group>

      <Tabs defaultValue="plantillas" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="plantillas">Plantillas</Tabs.Tab>
          <Tabs.Tab value="historial">Historial de uso</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="plantillas" pt="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Checkbox
                label="Ver también las retiradas"
                checked={conRetiradas}
                onChange={(e) => setConRetiradas(e.currentTarget.checked)}
              />
              {puedeDisenar && (
                <Group gap="xs">
                  {conIA && (
                    <Button variant="default" onClick={() => pedirALaIA(nombreEmpresa)}>
                      Crear con ayuda de la IA…
                    </Button>
                  )}
                  <Button onClick={() => setEditando('nueva')}>Plantilla nueva…</Button>
                </Group>
              )}
            </Group>
            {error && <Alert color="red">{error}</Alert>}
            {errorAccion && (
              <Alert color="red" withCloseButton onClose={() => setErrorAccion(null)}>
                {errorAccion}
              </Alert>
            )}
            <MantineReactTable table={tabla} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="historial" pt="md">
          <HistorialUso plantillas={plantillas} />
        </Tabs.Panel>
      </Tabs>

      {editando !== null && (
        <EditorPlantilla
          idPlantilla={editando === 'nueva' ? null : editando}
          soloLectura={!puedeDisenar}
          ancho={ancho}
          ejercicio={ejercicio}
          alCerrar={(huboCambios) => {
            setEditando(null)
            if (huboCambios) recargar()
          }}
        />
      )}
      {duplicando && (
        <DialogoDuplicar
          plantilla={duplicando}
          alCerrar={(hecho) => {
            setDuplicando(null)
            if (hecho) recargar()
          }}
        />
      )}
    </Stack>
  )
}
