import { ActionIcon, Badge, Button, Group, Stack, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
} from 'mantine-react-table'
import { useMemo, useState } from 'react'
import type { CampoImportable, Mapeo } from '../../api/importador'
import { opcionesDeTabla } from '../../components/tabla'

export interface Fila {
  clave: string
  campo: CampoImportable
}

interface Props {
  campos: Record<string, CampoImportable>
  /** Las claves en el orden en que están las columnas del archivo. */
  orden: string[]
  alCambiar: (orden: string[]) => void
}

/**
 * El orden de las filas ES el orden de las columnas del archivo: la primera
 * fila es la columna 1. Lo que el archivo no trae se quita de la lista, y
 * «Restaurar» devuelve la lista entera en el orden que da el servidor.
 */
export default function MapeoPorPosicion({ campos, orden, alCambiar }: Props) {
  // La fila que se arrastra llega entera; la de debajo, parcial. De las dos
  // solo se usa el `id`, que es la clave del campo.
  const [arrastrando, setArrastrando] = useState<MRT_Row<Fila> | null>(null)
  const [encima, setEncima] = useState<Partial<MRT_Row<Fila>> | null>(null)

  const filas = useMemo(
    () =>
      orden
        .filter((clave) => campos[clave] !== undefined)
        .map((clave) => ({ clave, campo: campos[clave]! })),
    [orden, campos],
  )

  const columnas = useMemo<MRT_ColumnDef<Fila>[]>(
    () => [
      {
        id: 'posicion',
        header: 'Columna',
        size: 90,
        grow: false,
        Cell: ({ row }) => (
          <Text fz="sm" ff="monospace">
            {row.index + 1}
          </Text>
        ),
      },
      {
        id: 'dato',
        header: 'Dato',
        grow: true,
        Cell: ({ row }) => {
          const { titulo, detalle } = partirDescripcion(row.original.campo.descripcion)
          return (
            <Stack gap={0}>
              <Group gap="xs" wrap="nowrap" align="baseline">
                <Text fz="sm" fw={500}>
                  {titulo}
                </Text>
                {row.original.campo.obligatorio && (
                  <Badge size="xs" variant="light" color="gray">
                    Obligatorio
                  </Badge>
                )}
              </Group>
              {detalle !== '' && (
                <Text fz="xs" c="dimmed">
                  {detalle}
                </Text>
              )}
            </Stack>
          )
        },
      },
      {
        id: 'quitar',
        header: '',
        size: 50,
        grow: false,
        Cell: ({ row }) => (
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            aria-label={`Quitar ${row.original.clave}`}
            onClick={() => alCambiar(orden.filter((clave) => clave !== row.original.clave))}
          >
            <IconX size={16} />
          </ActionIcon>
        ),
      },
    ],
    [orden, alCambiar],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<Fila>(),
    columns: columnas,
    data: filas,
    getRowId: (fila) => fila.clave,
    enablePagination: false,
    enableRowOrdering: true,
    enableRowDragging: true,
    state: { draggingRow: arrastrando, hoveredRow: encima },
    onDraggingRowChange: setArrastrando,
    onHoveredRowChange: setEncima,
    mantineRowDragHandleProps: {
      onDragEnd: () => {
        const movida = arrastrando?.id
        const soltada = encima?.id
        if (movida === undefined || soltada === undefined) return
        const colocado = orden.filter((clave) => clave !== movida)
        const destino = colocado.indexOf(String(soltada))
        colocado.splice(destino < 0 ? colocado.length : destino, 0, movida)
        alCambiar(colocado)
        setArrastrando(null)
        setEncima(null)
      },
    },
    mantineTableContainerProps: { style: { maxHeight: '40vh' } },
  })

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Text fw={500}>Qué columna es cada dato</Text>
          <Text fz="xs" c="dimmed">
            El orden de las filas es el orden de las columnas del archivo. Arrastra para
            colocarlas y quita las que tu archivo no traiga.
          </Text>
        </Stack>
        <Button variant="default" size="xs" onClick={() => alCambiar(Object.keys(campos))}>
          Restaurar
        </Button>
      </Group>

      <MantineReactTable table={tabla} />
    </Stack>
  )
}

/**
 * La descripción del campo llega del servidor en una frase seguida. La primera
 * oración sirve de título de la fila y el resto, de aclaración: así la tabla se
 * recorre de un vistazo en vez de leerse entera.
 */
function partirDescripcion(descripcion: string): { titulo: string; detalle: string } {
  const corte = descripcion.indexOf('.')
  if (corte < 0) return { titulo: descripcion, detalle: '' }
  return { titulo: descripcion.slice(0, corte), detalle: descripcion.slice(corte + 1).trim() }
}

/** El mapeo que se guarda: cada dato con el número de columna que le toca. */
export function mapeoDeOrden(orden: string[]): Mapeo {
  return Object.fromEntries(orden.map((clave, indice) => [clave, String(indice + 1)]))
}

/** Al abrir un modelo guardado, se recolocan las filas por su número de columna. */
export function ordenDeMapeo(mapeo: Mapeo, campos: Record<string, CampoImportable>): string[] {
  const conNumero = Object.entries(mapeo)
    .map(([clave, valor]) => ({ clave, posicion: Number(valor) }))
    .filter(({ clave, posicion }) => campos[clave] !== undefined && Number.isFinite(posicion))
  conNumero.sort((uno, otro) => uno.posicion - otro.posicion)
  return conNumero.map(({ clave }) => clave)
}
