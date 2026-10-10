import { Anchor, Text, Tooltip } from '@mantine/core'
import type { MRT_ColumnDef } from 'mantine-react-table'
import type { ApunteMayor } from '../../api/informes'
import { CELDA_QUE_CRECE } from '../../components/tabla'
import { formatearFecha, formatearImporte } from '../../lib/format'

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

/**
 * `alEditarBorrador` hace del número de asiento un enlace en las filas que
 * todavía están en borrador. Sin él, el número se queda como texto: es lo que
 * pasa dentro del editor de asientos, donde abrir otro haría perder lo tecleado.
 */
export function columnasDeMayor(
  alEditarBorrador?: (idBorrador: number) => void,
): MRT_ColumnDef<ApunteMayor>[] {
  return [
    {
      accessorKey: 'fecha',
      header: 'Fecha',
      size: 110,
      grow: false,
      Cell: ({ row }) => formatearFecha(row.original.fecha),
    },
    {
      accessorKey: 'asiento',
      header: 'Asiento',
      size: 90,
      grow: false,
      Cell: ({ row }) => {
        const apunte = row.original
        if (alEditarBorrador === undefined || !apunte.es_borrador || apunte.id_borrador === 0) {
          return apunte.asiento
        }
        return (
          <Tooltip label="Corregir el borrador…" withArrow openDelay={400}>
            <Anchor
              fz="sm"
              underline="hover"
              onClick={(e) => {
                // La fila tiene su propia casilla para marcarla: abrir el
                // borrador no la marca.
                e.stopPropagation()
                alEditarBorrador(apunte.id_borrador)
              }}
            >
              {apunte.asiento}
            </Anchor>
          </Tooltip>
        )
      },
    },
    {
      accessorKey: 'concepto',
      header: 'Concepto',
      // La única que crece: es lo que se lee al recorrer el mayor.
      grow: true,
      mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
    },
    {
      accessorKey: 'documento',
      header: 'Documento',
      size: 140,
      grow: false,
    },
    {
      id: 'debe',
      header: 'Debe',
      size: 120,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => (row.original.debe.isZero() ? '' : formatearImporte(row.original.debe)),
    },
    {
      id: 'haber',
      header: 'Haber',
      size: 120,
      grow: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => (row.original.haber.isZero() ? '' : formatearImporte(row.original.haber)),
    },
    {
      id: 'saldo',
      header: 'Saldo',
      size: 130,
      grow: false,
      ...A_LA_DERECHA,
      // Lo calcula la API: aquí no se acumula nada por la columna.
      Cell: ({ row }) => (
        <Text fw={500} ff="monospace">
          {formatearImporte(row.original.saldo)}
        </Text>
      ),
    },
    {
      // Lo mismo y con la misma marca que en el diario: los borradores salen
      // mezclados con lo firme y hay que reconocerlos de un vistazo.
      id: 'borrador',
      header: '',
      size: 44,
      grow: false,
      Cell: ({ row }) =>
        row.original.es_borrador ? (
          <Tooltip label="Asiento en borrador" withArrow>
            <span aria-label="Asiento en borrador">📝</span>
          </Tooltip>
        ) : null,
    },
  ]
}
