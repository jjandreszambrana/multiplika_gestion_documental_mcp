import { Paper, Stack, Table, Text, Title } from '@mantine/core'
import type { Suma, Totales } from '../../api/asientos'
import { formatearImporte } from '../../lib/format'

interface Props {
  /** Lo marcado con su casilla. Se suma aquí: es una columna a la vista. */
  seleccion: Suma | null
  /** Consulta y ejercicio, del servidor. Nulo mientras se están pidiendo. */
  totales: Totales | null
  error: string | null
}

/**
 * Las sumas del diario, un alcance por fila. Las dos últimas llegan del
 * servidor y se piden de fondo: aparecen cuando están y no bloquean la
 * pantalla.
 */
export default function PieDeTotales({ seleccion, totales, error }: Props) {
  if (error !== null) {
    return (
      <Paper withBorder p="xs">
        <Text size="sm" c="red" role="alert">
          {error}
        </Text>
      </Paper>
    )
  }

  return (
    <Paper withBorder p="xs">
      <Stack gap={2}>
        <Title order={6}>Acumulados</Title>
        <Table
          withRowBorders={false}
          striped="odd"
          stripedColor="var(--mantine-color-gray-2)"
          verticalSpacing={1}
          horizontalSpacing="md"
          w="auto"
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              <Cabecera>Debe</Cabecera>
              <Cabecera>Haber</Cabecera>
              <Cabecera>Descuadre</Cabecera>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Fila titulo="Seleccionados" suma={seleccion} vacio="Ninguno seleccionado" />
            <Fila titulo="Consulta" suma={totales?.consulta ?? null} />
            <Fila
              titulo="Ejercicio"
              suma={totales === null ? null : totales.ejercicio}
              vacio={totales !== null && totales.ejercicio === null ? 'No aplica' : undefined}
            />
          </Table.Tbody>
        </Table>
      </Stack>
    </Paper>
  )
}

function Cabecera({ children }: { children: string }) {
  return (
    <Table.Th ta="right" fw={400}>
      <Text fz="xs" c="dimmed">
        {children}
      </Text>
    </Table.Th>
  )
}

function Fila({
  titulo,
  suma,
  vacio,
}: {
  titulo: string
  suma: Suma | null
  /** Qué poner cuando no hay suma. Sin esto, es que se está calculando. */
  vacio?: string
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="xs" c="dimmed" tt="uppercase">
          {titulo}
        </Text>
      </Table.Td>
      {suma === null ? (
        <Table.Td colSpan={3}>
          <Text fz="sm" c="dimmed">
            {vacio ?? 'Calculando…'}
          </Text>
        </Table.Td>
      ) : (
        <>
          <Cifra valor={suma.debe} />
          <Cifra valor={suma.haber} />
          <Cifra valor={suma.diferencia} color={suma.diferencia.isZero() ? undefined : 'red'} />
        </>
      )}
    </Table.Tr>
  )
}

function Cifra({ valor, color }: { valor: Suma['debe']; color?: string }) {
  return (
    <Table.Td ta="right">
      <Text fz="sm" fw={600} ff="monospace" c={color}>
        {formatearImporte(valor)}
      </Text>
    </Table.Td>
  )
}
