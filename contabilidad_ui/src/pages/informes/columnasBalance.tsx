import { Text } from '@mantine/core'
import type Decimal from 'decimal.js'
import type { MRT_ColumnDef } from 'mantine-react-table'
import type { LineaSumasYSaldos } from '../../api/informes'
import { CELDA_QUE_CRECE } from '../../components/tabla'
import { formatearImporte } from '../../lib/format'

/** Los importes van pegados a la derecha y en monospace, como en el diario. */
const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: {
    fz: 'sm',
    py: 4,
    ff: 'monospace',
    style: { justifyContent: 'flex-end' },
  },
} as const

function columnaDeImporte(
  id: string,
  cabecera: string,
  valorDe: (linea: LineaSumasYSaldos) => Decimal,
): MRT_ColumnDef<LineaSumasYSaldos> {
  return {
    id,
    header: cabecera,
    size: 130,
    grow: false,
    ...A_LA_DERECHA,
    Cell: ({ row }) => formatearImporte(valorDe(row.original)),
  }
}

export function columnasDeBalance(): MRT_ColumnDef<LineaSumasYSaldos>[] {
  return [
    {
      accessorKey: 'cuenta',
      header: 'Cuenta',
      size: 130,
      grow: false,
      Cell: ({ row }) => (
        <Text fz="sm" ff="monospace" fw={500}>
          {row.original.cuenta}
        </Text>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Título',
      // La única que crece: es lo que hace legible un balance.
      grow: true,
      mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
    },
    columnaDeImporte('saldo_anterior', 'Saldo anterior', (l) => l.saldo_anterior),
    columnaDeImporte('debe', 'Debe', (l) => l.debe),
    columnaDeImporte('haber', 'Haber', (l) => l.haber),
    {
      id: 'saldo',
      header: 'Saldo',
      size: 130,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => (
        <Text fz="sm" ff="monospace" fw={600}>
          {formatearImporte(row.original.saldo)}
        </Text>
      ),
    },
  ]
}
