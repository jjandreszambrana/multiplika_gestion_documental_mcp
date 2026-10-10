import { Button, Group, Paper, Stack, Table, Text } from '@mantine/core'
import type { VistaDelCierre } from '../../api/cierre'
import { formatearEntero, formatearFecha, formatearImporte } from '../../lib/format'

interface Props {
  vista: VistaDelCierre
  /** Abre en el diario el borrador que se pide. Nulo mientras no haya ninguno. */
  alVerBorrador: ((idBorrador: number) => void) | null
}

/** Cómo se rotula cada borrador del proceso. */
const QUE_ES: Record<string, string> = {
  regularizacion: 'Regularización',
  cierre: 'Cierre',
}

/**
 * Qué va a pasar, en el orden en que pasa. El detalle cuenta a cuenta no está
 * aquí a propósito: está en el borrador, que se abre en el diario y se ve
 * entero, y repetirlo sería una lista más que mantener.
 */
export default function VistaPreviaCierre({ vista, alVerBorrador }: Props) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text fw={600}>Qué va a pasar</Text>
        <Text size="sm" c="dimmed">
          {`Los dos asientos con fecha ${formatearFecha(vista.fecha)}`}
        </Text>
      </Group>

      <Paper withBorder p="md">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Regularización
          </Text>
          <Table fz="sm" verticalSpacing={2} withRowBorders={false}>
            <Table.Tbody>
              <Fila
                rotulo="Cuentas que se saldan"
                valor={formatearEntero(vista.regularizacion.cuentas)}
              />
              <Fila rotulo="Gastos" valor={formatearImporte(vista.regularizacion.gastos)} />
              <Fila rotulo="Ingresos" valor={formatearImporte(vista.regularizacion.ingresos)} />
              <Fila
                rotulo="Resultado"
                valor={formatearImporte(vista.regularizacion.resultado)}
                fuerte
              />
              <Fila rotulo="Va a la cuenta" valor={vista.regularizacion.cuenta_de_resultado} />
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Cierre
          </Text>
          <Table fz="sm" verticalSpacing={2} withRowBorders={false}>
            <Table.Tbody>
              <Fila
                rotulo="Cuentas con saldo"
                valor={formatearEntero(vista.cierre.cuentas)}
              />
              <Fila rotulo="Importe" valor={formatearImporte(vista.cierre.importe)} fuerte />
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      {alVerBorrador !== null && vista.borradores.length > 0 && (
        <Group gap="xs">
          {vista.borradores.map((uno) => (
            <Button
              key={uno.id_borrador}
              size="compact-sm"
              variant="default"
              onClick={() => alVerBorrador(uno.id_borrador)}
            >
              {`Ver el borrador de ${(QUE_ES[uno.que_es] ?? uno.que_es).toLowerCase()}…`}
            </Button>
          ))}
        </Group>
      )}
    </Stack>
  )
}

function Fila({ rotulo, valor, fuerte }: { rotulo: string; valor: string; fuerte?: boolean }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={fuerte ? 600 : 400}>
          {rotulo}
        </Text>
      </Table.Td>
      <Table.Td align="right" w={180}>
        <Text size="sm" ff="monospace" fw={fuerte ? 600 : 400}>
          {valor}
        </Text>
      </Table.Td>
    </Table.Tr>
  )
}
