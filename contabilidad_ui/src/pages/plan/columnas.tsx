import { Badge, Text } from '@mantine/core'
import type { MRT_ColumnDef } from 'mantine-react-table'
import type { CuentaPlan } from '../../api/plan'
import { nombreDeTipo } from '../../lib/cuenta'
import { CELDA_QUE_CRECE } from '../../components/tabla'
import AccionesCuenta from './AccionesCuenta'
import type { Accion } from './DialogoAccionCuenta'

/** Sangría por dígito del código, para que el árbol se lea de un vistazo. */
const SANGRIA_POR_NIVEL = 8
/** Lo que ocupa un dígito en la fuente monoespaciada de la tabla, a tamaño `sm`. */
const ANCHO_DE_DIGITO = 10
/** Relleno de la celda, la sangría del nivel más hondo y un respiro. */
const MARGEN_DE_CELDA = 90
/** Por debajo de esto la columna queda apretada aunque las cuentas sean cortas. */
const ANCHO_MINIMO = 200

interface Mantenimiento {
  alEditar: (cuenta: CuentaPlan) => void
  alPedirAccion: (cuenta: CuentaPlan, accion: Accion) => void
}

/** La columna de acciones solo se monta con nivel `cierre`: se esconde, no se apaga. */
/**
 * @param ancho Dígitos de una cuenta de apuntes, de la configuración de la
 *   empresa. La columna se dimensiona con él: cada empresa tiene el suyo y con
 *   un ancho fijo se recortaban los últimos dígitos justo en las subcuentas.
 */
export function columnasDelPlan(
  mantenimiento: Mantenimiento | null,
  ancho: number,
): MRT_ColumnDef<CuentaPlan>[] {
  const columnas: MRT_ColumnDef<CuentaPlan>[] = [
    {
      accessorKey: 'codigo',
      header: 'Cuenta',
      size: Math.max(ANCHO_MINIMO, ancho * ANCHO_DE_DIGITO + MARGEN_DE_CELDA),
      grow: false,
      Cell: ({ row }) => (
        <Text ff="monospace" fz="sm" pl={row.original.nivel * SANGRIA_POR_NIVEL} style={{ whiteSpace: 'nowrap' }}>
          {row.original.codigo}
        </Text>
      ),
    },
    {
      accessorKey: 'descripcion',
      header: 'Título',
      // Es el único texto largo: se queda con el espacio que sobra.
      grow: true,
      mantineTableBodyCellProps: CELDA_QUE_CRECE,
    },
    {
      accessorKey: 'auxiliar',
      header: 'Tipo',
      size: 120,
      grow: false,
      Cell: ({ row }) => nombreDeTipo(row.original.nivel, Boolean(row.original.auxiliar)),
    },
    {
      accessorKey: 'origen',
      header: 'Origen',
      size: 90,
      grow: false,
      Cell: ({ row }) => (
        <Badge size="xs" variant="light" color={row.original.origen === 'propia' ? 'blue' : 'gray'}>
          {row.original.origen}
        </Badge>
      ),
    },
    {
      id: 'apartada',
      header: '',
      size: 80,
      grow: false,
      // Vacía mientras no se pidan las apartadas, que es lo normal. Se decide
      // por `oculta` y `estado`: una cuenta común oculta llega como propia.
      Cell: ({ row }) =>
        row.original.oculta === 1 ? (
          <Badge size="xs" variant="light" color="gray">
            Oculta
          </Badge>
        ) : row.original.estado === 0 ? (
          <Badge size="xs" variant="light" color="orange">
            Retirada
          </Badge>
        ) : null,
    },
  ]

  if (mantenimiento !== null) {
    columnas.push({
      id: 'acciones',
      header: '',
      size: 50,
      grow: false,
      mantineTableBodyCellProps: { py: 0, style: { overflow: 'visible' } },
      Cell: ({ row }) => (
        <AccionesCuenta
          cuenta={row.original}
          alEditar={mantenimiento.alEditar}
          alPedirAccion={mantenimiento.alPedirAccion}
        />
      ),
    })
  }

  return columnas
}
