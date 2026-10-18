import { Stack, Tabs, Title } from '@mantine/core'
import { useCallback } from 'react'
import { usePestanas } from '../../components/pestanas'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import SumasSaldosDiarioB from './SumasSaldosDiarioB'
import TablaDiarioB from './TablaDiarioB'
import TablaEquivalencias from './TablaEquivalencias'

interface Props {
  ejercicio: number | null
  nivel: string
  ancho: number
  /** Usuario y empresa, para recordar la última pestaña. */
  quienGuarda: string
}

const PESTANAS = ['diario_b', 'equivalencias', 'sumas_saldos']
const PREFERENCIA = 'diario_b.pestana'

/**
 * Mantenimiento directo de dos tablas de la empresa ([5.31]): el diario B y
 * las equivalencias de cuentas. Las equivalencias de aquí no son el cambio de
 * plan contable: no se mezclan con aquella pantalla.
 *
 * Entra en la pestaña en la que se dejó. Cada una se monta al abrirla y luego
 * se queda montada: al volver sigue con sus filtros, su página y lo calculado.
 */
export default function PantallaDiarioB({ ejercicio, nivel, ancho, quienGuarda }: Props) {
  const recordada = leerPreferencia<string>(quienGuarda, PREFERENCIA)
  const guardar = useCallback(
    (valor: string) => guardarPreferencia(quienGuarda, PREFERENCIA, valor),
    [quienGuarda],
  )
  const { pestana, cambiar, vista } = usePestanas(
    recordada !== null && PESTANAS.includes(recordada) ? recordada : 'diario_b',
    guardar,
  )

  return (
    <Stack gap="md">
      <Title order={3}>Diario B y equivalencias</Title>
      <Tabs value={pestana} onChange={cambiar} keepMounted variant="outline" radius="sm">
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
          {vista('diario_b') && <TablaDiarioB ejercicio={ejercicio} nivel={nivel} ancho={ancho} />}
        </Tabs.Panel>
        <Tabs.Panel value="equivalencias" pt="md">
          {vista('equivalencias') && <TablaEquivalencias nivel={nivel} ancho={ancho} />}
        </Tabs.Panel>
        <Tabs.Panel value="sumas_saldos" pt="md">
          {vista('sumas_saldos') && <SumasSaldosDiarioB ejercicio={ejercicio} nivel={nivel} quienGuarda={quienGuarda} />}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
