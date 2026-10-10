import { Alert, Badge, Group, Paper, Stack, Table, Text } from '@mantine/core'
import type Decimal from 'decimal.js'
import type { CuadreIva } from '../../api/fiscal'
import { formatearImporte } from '../../lib/format'

interface Fila {
  rotulo: string
  facturas: Decimal
  libros: Decimal
  diferencia: Decimal
}

/**
 * El IVA de las facturas frente al contabilizado.
 *
 * **`cuadra` lo decide la API**, con su propia tolerancia: aquí no se compara
 * ningún importe. Y `limites` va junto al resultado y no escondido, porque es
 * lo que dice hasta dónde llega ese «cuadra».
 */
export default function VistaCuadre({ cuadre }: { cuadre: CuadreIva }) {
  const filas: Fila[] = [
    {
      rotulo: 'IVA repercutido',
      facturas: cuadre.repercutido_en_facturas,
      libros: cuadre.repercutido_contabilizado,
      diferencia: cuadre.diferencia_repercutido,
    },
    {
      rotulo: 'IVA soportado',
      facturas: cuadre.soportado_en_facturas,
      libros: cuadre.soportado_contabilizado,
      diferencia: cuadre.diferencia_soportado,
    },
  ]

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Table fz="sm" verticalSpacing={4} withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              <Table.Th ta="right" w={170}>
                Según las facturas
              </Table.Th>
              <Table.Th ta="right" w={170}>
                Según los libros
              </Table.Th>
              <Table.Th ta="right" w={140}>
                Diferencia
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((fila) => (
              <Table.Tr key={fila.rotulo}>
                <Table.Td fw={600}>{fila.rotulo}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {formatearImporte(fila.facturas)}
                </Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {formatearImporte(fila.libros)}
                </Table.Td>
                <Table.Td
                  ta="right"
                  ff="monospace"
                  c={fila.diferencia.isZero() ? undefined : 'orange.8'}
                >
                  {formatearImporte(fila.diferencia)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Group gap="sm">
        <Badge color={cuadre.cuadra ? 'green' : 'red'} variant="light" size="lg">
          {cuadre.cuadra ? 'Cuadra' : 'No cuadra'}
        </Badge>
        <Text size="sm" c="dimmed">
          Se da por buena una diferencia de hasta {formatearImporte(cuadre.tolerancia)} €.
        </Text>
      </Group>

      <Alert color="yellow" variant="light">
        {cuadre.limites}
      </Alert>
    </Stack>
  )
}
