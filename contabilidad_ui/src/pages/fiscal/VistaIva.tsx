import { Group, Paper, Stack, Table, Text } from '@mantine/core'
import type { ResumenIva, TramoIva } from '../../api/fiscal'
import { aDecimal } from '../../lib/dinero'
import { formatearFecha, formatearImporte } from '../../lib/format'
import { sumarTramos } from './sumasIva'

const NOTA_DEL_303 =
  'Son las bases y las cuotas del periodo, no las casillas del 303. Para ver el modelo con ' +
  'sus casillas, ve a Modelo 303.'

function TablaDeTramos({ titulo, tramos }: { titulo: string; tramos: TramoIva[] }) {
  const suma = sumarTramos(tramos)

  return (
    <Paper withBorder p="md">
      <Stack gap="xs">
        <Text fw={700}>{titulo}</Text>

        {tramos.length === 0 ? (
          <Text size="sm" c="dimmed">
            No hay operaciones de este tipo en el periodo.
          </Text>
        ) : (
          <Table fz="sm" verticalSpacing={2} withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={90}>Tipo</Table.Th>
                <Table.Th ta="right">Base</Table.Th>
                <Table.Th ta="right">Cuota</Table.Th>
                <Table.Th ta="right">Recargo</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tramos.map((fila) => (
                <Table.Tr key={fila.tipo}>
                  <Table.Td ff="monospace">{formatearImporte(aDecimal(fila.tipo))} %</Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    {formatearImporte(fila.base)}
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    {formatearImporte(fila.cuota)}
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    {formatearImporte(fila.recargo)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th>Total</Table.Th>
                <Table.Th ta="right" ff="monospace">
                  {formatearImporte(suma.base)}
                </Table.Th>
                <Table.Th ta="right" ff="monospace">
                  {formatearImporte(suma.cuota)}
                </Table.Th>
                <Table.Th ta="right" ff="monospace">
                  {formatearImporte(suma.recargo)}
                </Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        )}
      </Stack>
    </Paper>
  )
}

/**
 * El IVA repercutido y el soportado del periodo, por tipo, y el resultado.
 *
 * **El resultado y las dos cuotas totales los da la API**: aquí solo se suman
 * la base y el recargo, que son columnas a la vista que la API no totaliza.
 */
export default function VistaIva({ iva }: { iva: ResumenIva }) {
  const aIngresar = !iva.resultado.isNegative()

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Del {formatearFecha(iva.desde)} al {formatearFecha(iva.hasta)}.
      </Text>

      <TablaDeTramos titulo="IVA repercutido" tramos={iva.repercutido} />
      <TablaDeTramos titulo="IVA soportado" tramos={iva.soportado} />

      <Paper withBorder p="md">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700}>Resultado del periodo</Text>
          <Group gap="sm" wrap="nowrap">
            <Text fw={700} ff="monospace">
              {formatearImporte(iva.resultado)}
            </Text>
            <Text size="sm" c="dimmed">
              {aIngresar ? 'a ingresar' : 'a compensar o devolver'}
            </Text>
          </Group>
        </Group>
      </Paper>

      <Text size="sm" c="dimmed">
        {NOTA_DEL_303}
      </Text>
    </Stack>
  )
}
