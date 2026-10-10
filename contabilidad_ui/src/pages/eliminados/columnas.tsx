import { Text, Tooltip } from '@mantine/core'
import type { MRT_ColumnDef } from 'mantine-react-table'
import type { ApunteEliminado } from '../../api/eliminados'
import { CELDA_QUE_CRECE } from '../../components/tabla'
import { formatearFecha, formatearImporte } from '../../lib/format'

const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: {
    fz: 'sm',
    py: 4,
    style: { justifyContent: 'flex-end' },
  },
} as const

function Importe({ valor }: { valor: ApunteEliminado['debe'] }) {
  if (valor.isZero()) return null
  return (
    <Text fz="sm" ta="right" ff="monospace">
      {formatearImporte(valor)}
    </Text>
  )
}

/**
 * Las mismas columnas del libro, para que un asiento se lea igual esté dentro o
 * fuera, más las tres que solo tienen sentido aquí: cuándo se quitó, quién lo
 * quitó y por qué.
 *
 * `fecha_borrado` trae fecha y hora; se enseña solo la fecha, que es lo que se
 * busca al mirar esta pantalla.
 */
export function columnasDeEliminados(): MRT_ColumnDef<ApunteEliminado>[] {
  return [
    {
      accessorKey: 'fecha',
      header: 'Fecha',
      size: 110,
      grow: false,
      Cell: ({ row }) => formatearFecha(row.original.fecha),
    },
    // Es el número que tenía cuando se borró, no el de ahora: al renumerar, los
    // asientos del libro cambian de número y los borrados conservan el suyo, así
    // que ese número puede ser ya de otro asiento.
    { accessorKey: 'asiento', header: 'Asiento al borrarse', size: 150, grow: false },
    {
      id: 'estado',
      header: 'Estado',
      size: 100,
      grow: false,
      // Igual que en el diario: la marca solo aparece en lo que era borrador.
      Cell: ({ row }) =>
        row.original.es_borrador ? (
          <Tooltip label="Asiento en borrador" withArrow>
            <span aria-label="Asiento en borrador">📝</span>
          </Tooltip>
        ) : null,
    },
    {
      accessorKey: 'cuenta',
      header: 'Cuenta',
      size: 130,
      grow: false,
      Cell: ({ row }) => (
        <Text fz="sm" ff="monospace">
          {row.original.cuenta}
        </Text>
      ),
    },
    {
      accessorKey: 'concepto',
      header: 'Concepto',
      // El único texto largo: se queda con el espacio que sobra.
      grow: true,
      mantineTableBodyCellProps: CELDA_QUE_CRECE,
    },
    { accessorKey: 'documento', header: 'Documento', size: 140, grow: false },
    { accessorKey: 'diario', header: 'Diario', size: 90, grow: false },
    {
      accessorKey: 'debe',
      header: 'Debe',
      size: 120,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => <Importe valor={row.original.debe} />,
    },
    {
      accessorKey: 'haber',
      header: 'Haber',
      size: 120,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => <Importe valor={row.original.haber} />,
    },
    {
      accessorKey: 'fecha_borrado',
      header: 'Borrado el',
      size: 120,
      grow: false,
      Cell: ({ row }) => formatearFecha(row.original.fecha_borrado),
    },
    { accessorKey: 'usuario_borrado', header: 'Quién', size: 120, grow: false },
    { accessorKey: 'motivo', header: 'Motivo', size: 200, grow: false },
  ]
}
