import { Stack, Tabs, Title } from '@mantine/core'
import SumasSaldosDiarioB from './SumasSaldosDiarioB'
import TablaDiarioB from './TablaDiarioB'
import TablaEquivalencias from './TablaEquivalencias'

interface Props {
  ejercicio: number | null
  nivel: string
  ancho: number
}

/**
 * Mantenimiento directo de dos tablas de la empresa ([5.31]): el diario B y
 * las equivalencias de cuentas. Las equivalencias de aquí no son el cambio de
 * plan contable: no se mezclan con aquella pantalla.
 */
export default function PantallaDiarioB({ ejercicio, nivel, ancho }: Props) {
  return (
    <Stack gap="md">
      <Title order={3}>Diario B y equivalencias</Title>
      <Tabs defaultValue="diario_b" keepMounted={false} variant="outline" radius="sm">
        <Tabs.List>
          <Tabs.Tab value="diario_b" fw={600} fz="sm" px="lg">
            Diario B
          </Tabs.Tab>
          <Tabs.Tab value="equivalencias" fw={600} fz="sm" px="lg">
            Equivalencias de cuentas
          </Tabs.Tab>
          <Tabs.Tab value="sumas_saldos" fw={600} fz="sm" px="lg">
            Sumas y saldos
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="diario_b" pt="md">
          <TablaDiarioB ejercicio={ejercicio} nivel={nivel} ancho={ancho} />
        </Tabs.Panel>
        <Tabs.Panel value="equivalencias" pt="md">
          <TablaEquivalencias nivel={nivel} ancho={ancho} />
        </Tabs.Panel>
        <Tabs.Panel value="sumas_saldos" pt="md">
          <SumasSaldosDiarioB ejercicio={ejercicio} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
