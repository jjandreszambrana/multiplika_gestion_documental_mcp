import { Stack, Tabs, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import PantallaMaestros from './PantallaMaestros'
import TercerosEnlazados from './TercerosEnlazados'

interface Props {
  nivel: string
  ancho: number
  /**
   * Dónde vive la cuenta de un cliente o un proveedor en esta empresa, de
   * `/configuracion/obtener`. Con `gestion` vive en su ficha de facturación y
   * se ve y se mantiene ahí, así que la lista de cuentas de terceros externos
   * no aporta nada y no se enseña. Con `contabilidad` no hay fichas y esa
   * lista es el único sitio donde se ve.
   */
  origenTerceros: string
}

/** Las cuentas contables que ata la facturación con la contabilidad. */
export default function PantallaEnlace({ nivel, ancho, origenTerceros }: Props) {
  const [pestana, setPestana] = useState<string | null>('fichas')
  const conTerceros = origenTerceros === 'contabilidad'

  // Desde aquí se dan de alta cuentas, así que al salir el plan que llevan en
  // memoria las demás pantallas se ha quedado viejo.
  const plan = usePlanEnMemoria()
  useEffect(() => plan.refrescar, [plan.refrescar])

  if (!conTerceros) {
    return (
      <Stack gap="md">
        <Title order={3}>Enlace con facturación</Title>
        <PantallaMaestros nivel={nivel} ancho={ancho} />
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Title order={3}>Enlace con facturación</Title>

      <Tabs value={pestana} onChange={setPestana}>
        <Tabs.List mb="md">
          <Tabs.Tab value="fichas">Fichas y cuentas</Tabs.Tab>
          <Tabs.Tab value="terceros">Cuentas de terceros externos</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="fichas">
          <PantallaMaestros nivel={nivel} ancho={ancho} />
        </Tabs.Panel>

        <Tabs.Panel value="terceros">
          <TercerosEnlazados />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
