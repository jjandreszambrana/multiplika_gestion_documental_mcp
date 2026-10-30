import { Badge, Group, Text } from '@mantine/core'
import type Decimal from 'decimal.js'
import type { MRT_ColumnDef } from 'mantine-react-table'
import type { Bien } from '../../api/inmovilizado'
import { colorDelTexto } from '../../lib/coloresBien'
import { aDecimal } from '../../lib/dinero'
import { formatearFecha, formatearImporte } from '../../lib/format'
import { CELDA_QUE_CRECE } from '../../components/tabla'
import AccionesBien, { type AccionesDeBien } from './AccionesBien'

/** Los importes van pegados a la derecha, como en el diario. */
const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: { fz: 'sm', py: 4, style: { justifyContent: 'flex-end' } },
} as const

function columnaDeImporte(
  id: string,
  cabecera: string,
  valorDe: (bien: Bien) => Decimal,
  ancho = 100,
): MRT_ColumnDef<Bien> {
  return {
    id,
    header: cabecera,
    size: ancho,
    grow: false,
    ...A_LA_DERECHA,
    Cell: ({ row }) => formatearImporte(valorDe(row.original)),
  }
}

/** Nulo para quien no tiene nivel `apuntes`: se esconde, no se apaga. */
export function columnasDeInmovilizado(acciones: AccionesDeBien | null): MRT_ColumnDef<Bien>[] {
  return [
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      // La única que crece: es lo que identifica el bien de un vistazo.
      grow: true,
      mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
      Cell: ({ row }) => (
        <Group gap="xs" wrap="nowrap">
          <Text fw={row.original.es_mejora ? 400 : 500} c={colorDelTexto(row.original.color)}>{row.original.descripcion}</Text>
          {!!row.original.traslado_pendiente && (
            <Badge size="xs" variant="light" color="orange">
              Traslado pendiente
            </Badge>
          )}
          {row.original.es_mejora && (
            <Badge size="xs" variant="light" color="blue">
              Mejora
            </Badge>
          )}
        </Group>
      ),
    },
    {
      accessorKey: 'fecha_compra',
      header: 'Año compra',
      size: 105,
      grow: false,
      Cell: ({ row }) => row.original.fecha_compra?.slice(0, 4) ?? '',
    },
    // En un bien con mejoras, el número del inventario es el del conjunto: lo
    // que cuesta y lo que lleva amortizado incluyen las suyas.
    {
      accessorKey: 'cuenta_activo',
      header: 'Cta. activo',
      size: 100,
      grow: false,
    },
    {
      accessorKey: 'cuenta_amortizacion',
      header: 'Cta. amort.',
      size: 100,
      grow: false,
    },
    {
      accessorKey: 'cuenta_gasto',
      header: 'Cta. gasto',
      size: 100,
      grow: false,
    },
    columnaDeImporte('valor', 'Valor', (b) => b.valor_con_mejoras),
    columnaDeImporte('amortizado', 'Amortizado', (b) => b.amortizado_con_mejoras),
    columnaDeImporte('pendiente', 'Pendiente', (b) => b.pendiente_de_amortizar),
    {
      accessorKey: 'porcentaje_anual',
      header: '% anual',
      size: 85,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => formatearImporte(aDecimal(row.original.porcentaje_anual), 2),
    },
    {
      accessorKey: 'anotaciones',
      header: 'Anotaciones',
      size: 120,
      grow: false,
      Cell: ({ row }) => (
        <Text size="sm" lineClamp={2} title={row.original.anotaciones ?? ''}>
          {row.original.anotaciones ?? ''}
        </Text>
      ),
    },
    columnaDeImporte('cuota', 'Cuota anual', (b) => b.dotacion_anual, 105),
    {
      id: 'estado',
      header: 'Estado',
      size: 115,
      grow: false,
      Cell: ({ row }) => {
        const bien = row.original
        // Una mejora solo sale suelta cuando su bien no está en la consulta;
        // si no, cuelga de él. Se dice, en vez de dejarla sin explicación.
        if (bien.es_mejora && row.depth === 0) {
          return (
            <Text size="xs" c="dimmed">
              Mejora de un bien que no está en esta lista
            </Text>
          )
        }
        if (bien.estado === 1) {
          return (
            <Badge size="xs" variant="light" color="green">
              En uso
            </Badge>
          )
        }
        return (
          <Badge size="xs" variant="light" color="gray">
            {`Baja ${formatearFecha(bien.fecha_baja)}`.trim()}
          </Badge>
        )
      },
    },
    {
      id: 'acciones',
      header: '',
      size: 60,
      grow: false,
      mantineTableBodyCellProps: { py: 0, style: { overflow: 'visible' } },
      Cell: ({ row }) =>
        acciones !== null && row.original.estado === 1 ? (
          <AccionesBien bien={row.original} acciones={acciones} />
        ) : null,
    },
  ]
}
