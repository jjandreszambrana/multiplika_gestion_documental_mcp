import { Anchor, Text, Tooltip } from '@mantine/core'
import type { MRT_ColumnDef, MRT_VisibilityState } from 'mantine-react-table'
import type { Apunte } from '../../api/asientos'
import { CELDA_QUE_CRECE } from '../../components/tabla'
import { formatearFecha, formatearImporte } from '../../lib/format'

/**
 * Las que no se pueden apagar son las que hacen que esto sea un diario: sin
 * ellas la pantalla no dice nada. El resto se enciende desde «Columnas» y la
 * elección se guarda en el equipo de cada usuario.
 */
export const COLUMNAS_DE_FABRICA: MRT_VisibilityState = {
  documento: false,
  diario: false,
  id_obra: false,
  usuario: false,
  registro: false,
}

/**
 * El orden guardado de un usuario se completa con lo que falte: si algún día
 * se añade una columna, aparece al final en vez de desaparecer, y si se quita,
 * el orden viejo no la arrastra.
 */
export function ordenarColumnas(guardado: string[] | null, deFabrica: string[]): string[] {
  if (guardado === null) return deFabrica
  const validas = guardado.filter((id) => deFabrica.includes(id))
  return [...validas, ...deFabrica.filter((id) => !validas.includes(id))]
}

/** Lo que se pinta donde un borrador todavía no tiene número. */
const SIN_NUMERO = '—'

/**
 * Importes pegados a la derecha, que es como se leen dos columnas de dinero:
 * las unidades quedan una debajo de otra. Con `layoutMode: 'grid'` la celda es
 * una caja flexible, así que no basta con alinear el texto: hay que empujar su
 * contenido, y en la cabecera igual.
 */
const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: {
    fz: 'sm',
    py: 4,
    style: { justifyContent: 'flex-end' },
  },
} as const

function Importe({ valor }: { valor: Apunte['debe'] }) {
  // El cero no se pinta: en un diario cada línea lleva importe en una columna
  // o en la otra, y los ceros de la que sobra solo estorban al leer.
  if (valor.isZero()) return null
  return (
    <Text fz="sm" ta="right" ff="monospace">
      {formatearImporte(valor)}
    </Text>
  )
}

/**
 * `alVerMayor` abre el mayor de esa cuenta sin salir del diario. Es lo que se
 * mira al toparse con un apunte y querer saber qué lleva esa cuenta.
 */
export function columnasDelDiario(alVerMayor: (cuenta: string) => void): MRT_ColumnDef<Apunte>[] {
  return [
    {
      accessorKey: 'fecha',
      header: 'Fecha',
      size: 110,
      grow: false,
      enableHiding: false,
      Cell: ({ row }) => formatearFecha(row.original.fecha),
    },
    {
      accessorKey: 'asiento',
      header: 'Asiento',
      size: 90,
      grow: false,
      enableHiding: false,
      // Un borrador nace ya con su número, del mismo contador que el libro, y lo
      // conserva al confirmarse. Solo llega 0 en un borrador de un ejercicio que
      // todavía no existe, y ahí va el guion.
      Cell: ({ row }) => (row.original.asiento === 0 ? SIN_NUMERO : row.original.asiento),
    },
    {
      accessorKey: 'pase',
      header: 'Pase',
      size: 90,
      grow: false,
      enableHiding: false,
      // Desde que los borradores viven en el diario, cada línea trae su pase
      // aunque no esté confirmada: es el número que llevará el apunte.
    },
    {
      id: 'estado',
      header: 'Estado',
      size: 100,
      grow: false,
      enableHiding: false,
      // Un emoji en vez de una etiqueta: la columna es estrecha y la fila va
      // apretada, y lo que hace falta es reconocerlo de un vistazo al recorrer
      // el listado, no leerlo.
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
      enableHiding: false,
      Cell: ({ row }) => (
        <Tooltip label="Ver el mayor…" withArrow openDelay={400}>
          <Anchor
            fz="sm"
            ff="monospace"
            underline="hover"
            onClick={(e) => {
              // La fila tiene su propio clic para marcarla: verlo no la marca.
              e.stopPropagation()
              alVerMayor(row.original.cuenta)
            }}
          >
            {row.original.cuenta}
          </Anchor>
        </Tooltip>
      ),
    },
    {
      accessorKey: 'concepto',
      header: 'Concepto',
      // Es el único texto largo: se queda con el espacio que sobra.
      grow: true,
      enableHiding: false,
      mantineTableBodyCellProps: CELDA_QUE_CRECE,
    },
    { accessorKey: 'documento', header: 'Documento', size: 140, grow: false },
    { accessorKey: 'diario', header: 'Diario', size: 90, grow: false },
    { accessorKey: 'id_obra', header: 'Obra', size: 80, grow: false },
    { accessorKey: 'usuario', header: 'Usuario', size: 120, grow: false },
    {
      accessorKey: 'registro',
      header: 'Fecha de registro',
      size: 150,
      grow: false,
      Cell: ({ row }) => formatearFecha(row.original.registro),
    },
    {
      accessorKey: 'debe',
      header: 'Debe',
      size: 120,
      grow: false,
      enableHiding: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => <Importe valor={row.original.debe} />,
    },
    {
      accessorKey: 'haber',
      header: 'Haber',
      size: 120,
      grow: false,
      enableHiding: false,
      ...A_LA_DERECHA,
      Cell: ({ row }) => <Importe valor={row.original.haber} />,
    },
  ]
}
