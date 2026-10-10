import { Group, Paper, Stack, Table, Text } from '@mantine/core'
import type Decimal from 'decimal.js'
import type { EpigrafeBalance } from '../../api/informes'
import { formatearImporte } from '../../lib/format'

interface Props {
  titulo: string
  epigrafes: EpigrafeBalance[]
  rotuloTotal: string
  total: Decimal
}

/** Más allá de esto la sangría no se lee: se deja como está. */
const TOPE_DE_SANGRIA = 5

/**
 * Una de las dos mitades del balance, o la cuenta de resultados entera. Se
 * pintan lado a lado, que es como se imprime: el activo a la izquierda y el
 * patrimonio neto y el pasivo a la derecha.
 *
 * Los importes llegan **ya en positivo**, también los del pasivo: la API les da
 * la vuelta al componer el informe. Aquí no se cambia ningún signo.
 *
 * **La sangría y la negrita las manda la API**, en `nivel` y `agrupa`, desde el
 * 01/09/2026. Antes se calculaba aquí la profundidad recorriendo la cadena de
 * padres; ya no hace falta, y así el detalle de cuentas se pinta solo.
 */
export default function ColumnaBalance({ titulo, epigrafes, rotuloTotal, total }: Props) {
  return (
    <Paper withBorder p="md">
      <Stack gap="xs">
        <Text fw={700}>{titulo}</Text>

        <Table fz="sm" verticalSpacing={2} withRowBorders={false}>
          <Table.Tbody>
            {epigrafes.map((uno) => (
              <Table.Tr key={uno.nodo}>
                <Table.Td pl={Math.min(uno.nivel, TOPE_DE_SANGRIA) * 16}>
                  <Text fz="sm" fw={uno.agrupa ? 600 : 400}>
                    {/* El código solo en las filas de detalle: `cuenta` viene
                        vacía en los epígrafes, que no son ninguna cuenta. */}
                    {uno.cuenta !== null && uno.cuenta !== '' && (
                      <Text span ff="monospace" inherit mr={8}>
                        {uno.cuenta}
                      </Text>
                    )}
                    {uno.titulo}
                  </Text>
                </Table.Td>
                <Table.Td align="right" w={140}>
                  <Text fz="sm" ff="monospace" fw={uno.agrupa ? 600 : 400}>
                    {formatearImporte(uno.saldo)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Group
          justify="space-between"
          pt="xs"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Text fw={700} size="sm">
            {rotuloTotal}
          </Text>
          <Text fw={700} size="sm" ff="monospace">
            {formatearImporte(total)}
          </Text>
        </Group>
      </Stack>
    </Paper>
  )
}
