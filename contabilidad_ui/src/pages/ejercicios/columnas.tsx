import { Badge, Button, Group, Text } from '@mantine/core'
import type { MRT_ColumnDef } from 'mantine-react-table'
import { motivoBloqueo, type Ejercicio } from '../../api/sesion'
import { formatearEntero, formatearFecha } from '../../lib/format'
import AccionesEjercicio from './AccionesEjercicio'

/** Los contadores van pegados a la derecha, como los importes del diario. */
const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: { fz: 'sm', py: 4, style: { justifyContent: 'flex-end' } },
} as const

interface Acciones {
  alVerPeriodos: (ejercicio: Ejercicio) => void
  /** Nulo para quien no tiene nivel `cierre`: se esconde, no se apaga. */
  alPedirBloqueo: ((ejercicio: Ejercicio) => void) | null
}

/** Color de la marca de estado: lo que admite apuntes, en verde; lo demás, no. */
const COLOR_ESTADO: Record<string, string> = {
  Cerrado: 'red',
  Cerrándose: 'orange',
  Bloqueado: 'yellow',
}

export function columnasDeEjercicios(acciones: Acciones): MRT_ColumnDef<Ejercicio>[] {
  return [
    {
      accessorKey: 'ejercicio',
      header: 'Ejercicio',
      size: 100,
      grow: false,
      Cell: ({ row }) => <Text fw={500}>{row.original.ejercicio}</Text>,
    },
    {
      accessorKey: 'tipo_pgc',
      header: 'Plan contable',
      size: 130,
      grow: false,
    },
    {
      accessorKey: 'apertura',
      header: 'Desde',
      size: 110,
      grow: false,
      Cell: ({ row }) => formatearFecha(row.original.apertura),
    },
    {
      accessorKey: 'cierre',
      header: 'Hasta',
      size: 110,
      grow: false,
      Cell: ({ row }) => formatearFecha(row.original.cierre),
    },
    {
      id: 'estado',
      header: 'Estado',
      // Es la columna que explica por qué un ejercicio no admite apuntes: se
      // queda con el espacio que sobra, que es donde caben las dos marcas.
      grow: true,
      Cell: ({ row }) => {
        const bloqueo = motivoBloqueo(row.original)
        const estado = bloqueo ?? 'Abierto'
        return (
          <Group gap="xs" wrap="wrap">
            <Badge size="xs" variant="light" color={bloqueo ? COLOR_ESTADO[bloqueo] : 'green'}>
              {estado}
            </Badge>
            {row.original.primero_apertura === 1 && (
              <Badge size="xs" variant="light" color="gray">
                Sin asiento de apertura
              </Badge>
            )}
          </Group>
        )
      },
    },
    {
      accessorKey: 'apuntes',
      header: 'Apuntes',
      size: 100,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => formatearEntero(row.original.apuntes),
    },
    {
      accessorKey: 'apuntes_en_borrador',
      header: 'En borrador',
      size: 110,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => formatearEntero(row.original.apuntes_en_borrador),
    },
    {
      accessorKey: 'prox_asiento',
      header: 'Próximo asiento',
      size: 130,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => formatearEntero(row.original.prox_asiento),
    },
    {
      id: 'acciones',
      header: '',
      size: 140,
      grow: false,
      mantineTableBodyCellProps: { py: 0, style: { overflow: 'visible' } },
      Cell: ({ row }) => (
        <Group gap="xs" wrap="nowrap" justify="flex-end">
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => acciones.alVerPeriodos(row.original)}
          >
            Periodos…
          </Button>
          {acciones.alPedirBloqueo !== null && row.original.cerrado === 0 && (
            <AccionesEjercicio ejercicio={row.original} alPedirBloqueo={acciones.alPedirBloqueo} />
          )}
        </Group>
      ),
    },
  ]
}
