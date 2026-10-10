import type { MRT_RowData, MRT_TableOptions } from 'mantine-react-table'

/**
 * Aspecto común de todas las rejillas del programa. Se decidió sobre la
 * pantalla del plan y vale para el resto: son listados largos que se recorren
 * buscando una fila.
 *
 * - Densidad `xs` y relleno vertical de 4px: cuantas más filas quepan de una
 *   vez, menos paginación. Los controles que van dentro de una fila (botones,
 *   marcas) se ponen pequeños para que quepan; si no, la celda los recorta.
 * - Cabecera fija y scroll solo en las filas, para no perder de vista qué
 *   columna es cuál.
 * - `layoutMode: 'grid'`, que es lo que hace caso a los anchos de columna.
 *
 * Lo que cada pantalla pone de su parte: los datos, `rowCount`, el estado de
 * carga y el aviso de error. Los anchos van en las columnas: ancho corto y
 * fijo (`grow: false`) para códigos, marcas y acciones, y `grow: true` en la
 * única columna de texto largo, que se queda con el espacio que sobra.
 */
export function opcionesDeTabla<T extends MRT_RowData>(): Partial<MRT_TableOptions<T>> {
  return {
    enableColumnActions: false,
    enableSorting: false,
    enableTopToolbar: false,
    enableStickyHeader: true,
    layoutMode: 'grid',
    initialState: { density: 'xs' },
    mantineTableProps: { highlightOnHover: true },
    mantineTableBodyCellProps: { fz: 'sm', py: 4 },
    mantineTableHeadCellProps: { fz: 'sm', py: 6 },
    mantineTableContainerProps: { style: { maxHeight: '60vh' } },
  }
}

/**
 * Para la columna de texto largo: parte en varias líneas en vez de recortar.
 * El resto de columnas se quedan en una línea a propósito.
 */
export const CELDA_QUE_CRECE = {
  style: { whiteSpace: 'normal', wordBreak: 'break-word' },
} as const
