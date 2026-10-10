import { Alert, Group, SimpleGrid, Text } from '@mantine/core'
import type { BalanceDeSituacion } from '../../api/informes'
import { formatearImporte } from '../../lib/format'
import ColumnaBalance from './ColumnaBalance'

const AVISO_NO_CUADRA =
  'El activo y el pasivo no cuadran hasta que se cierra el ejercicio, y eso es lo normal: ' +
  'el beneficio todavía está repartido entre las cuentas de gastos e ingresos, que no forman ' +
  'parte del balance. Por eso la diferencia entre los dos es justo el resultado del ejercicio.'

/**
 * El balance de situación: las dos mitades, lado a lado, que es como se imprime.
 *
 * **Los importes vienen ya en positivo**, también los del pasivo: la API les da
 * la vuelta al componer el informe. Aquí no se cambia ningún signo ni se calcula
 * ningún total.
 */
export default function VistaBalanceSituacion({ balance }: { balance: BalanceDeSituacion }) {
  // Cuadra con una resta, no con una suma: el pasivo viene ya en positivo.
  const diferencia = balance.total_activo.minus(balance.total_pasivo)

  return (
    <>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <ColumnaBalance
          titulo="Activo"
          epigrafes={balance.activo}
          rotuloTotal="Total activo"
          total={balance.total_activo}
        />
        <ColumnaBalance
          titulo="Patrimonio neto y pasivo"
          epigrafes={balance.pasivo}
          rotuloTotal="Total patrimonio neto y pasivo"
          total={balance.total_pasivo}
        />
      </SimpleGrid>

      <Group gap="xl" wrap="wrap" mt="md">
        <Group gap={6}>
          <Text size="sm" c="dimmed">
            Resultado del ejercicio
          </Text>
          <Text size="sm" fw={600} ff="monospace">
            {formatearImporte(balance.resultado_del_ejercicio)}
          </Text>
        </Group>
      </Group>

      {/* Solo cuando de verdad no cuadran: con el ejercicio cerrado son iguales
          y el aviso no pinta nada. */}
      {!diferencia.isZero() && (
        <Alert color="blue" role="status" mt="md">
          {AVISO_NO_CUADRA}
        </Alert>
      )}
    </>
  )
}
