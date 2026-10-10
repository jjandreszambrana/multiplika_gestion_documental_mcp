import { Alert, Paper, Stack, Table, Text } from '@mantine/core'
import type { Retenciones } from '../../api/fiscal'
import { formatearEntero, formatearImporte } from '../../lib/format'

/**
 * Lo retenido en el periodo, por proveedor y porcentaje. Es la base de los
 * modelos 111 y 115.
 *
 * **El `aviso` viene redactado de la API y se enseña tal cual**: dice que los
 * dos modelos no van separados, y sin eso la lista se leería mal.
 */
export default function VistaRetenciones({ retenciones }: { retenciones: Retenciones }) {
  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="xs">
          {retenciones.perceptores.length === 0 ? (
            <Text size="sm" c="dimmed">
              No se ha practicado ninguna retención en el periodo.
            </Text>
          ) : (
            <Table fz="sm" verticalSpacing={2} withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={130}>NIF</Table.Th>
                  <Table.Th>Perceptor</Table.Th>
                  <Table.Th ta="right" w={90}>
                    %
                  </Table.Th>
                  <Table.Th ta="right" w={100}>
                    Facturas
                  </Table.Th>
                  <Table.Th ta="right" w={130}>
                    Retenido
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {retenciones.perceptores.map((fila, indice) => (
                  // Un proveedor sale varias veces si se le retuvo a dos
                  // porcentajes, así que el id solo no identifica la fila.
                  <Table.Tr key={`${fila.id_emisor ?? indice}.${fila.tipo.toString()}`}>
                    <Table.Td ff="monospace">{fila.NIF_emisor ?? ''}</Table.Td>
                    <Table.Td>{fila.NombreRazon_emisor ?? ''}</Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {formatearImporte(fila.tipo)}
                    </Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {formatearEntero(fila.facturas)}
                    </Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {formatearImporte(fila.retenido)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={4}>Total retenido</Table.Th>
                  <Table.Th ta="right" ff="monospace">
                    {formatearImporte(retenciones.total_retenido)}
                  </Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          )}
        </Stack>
      </Paper>

      <Alert color="yellow" variant="light">
        {retenciones.aviso}
      </Alert>
    </Stack>
  )
}
