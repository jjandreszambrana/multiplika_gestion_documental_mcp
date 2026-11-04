import { Alert, Button, Stack, Tabs, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { activarLaboratorio, type EstadoLaboratorio } from '../../api/laboratorio'
import PestanaCatalogos from './PestanaCatalogos'
import PestanaFacturar from './PestanaFacturar'
import PestanaMuestras from './PestanaMuestras'
import PestanaPortal from './PestanaPortal'

interface Props {
  estado: EstadoLaboratorio
  /** Tras activarlo, para que el marco vuelva a preguntar. */
  alActivado: () => void
}

/** Las pantallas del personal del laboratorio ([5.54]). */
export default function PantallaLaboratorio({ estado, alActivado }: Props) {
  const [activando, setActivando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function activar() {
    setActivando(true)
    setError(null)
    try {
      await activarLaboratorio()
      alActivado()
    } catch (fallo) {
      setError(textoDeError(fallo))
      setActivando(false)
    }
  }

  if (estado !== 'activo') {
    return (
      <Stack gap="md" align="flex-start">
        <Title order={3}>Laboratorio</Title>
        <Alert color="yellow" title="El laboratorio todavía no está en marcha en esta empresa">
          Al ponerlo en marcha se crean los estados de serie (espera, proceso, finalizado, revisado y
          entregado). Puedes cambiarlos después en los catálogos.
        </Alert>
        {error && <Text c="red">{error}</Text>}
        <Button onClick={() => void activar()} loading={activando}>
          Poner en marcha el laboratorio
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Title order={3}>Laboratorio</Title>
      <Tabs defaultValue="muestras" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="muestras">Muestras</Tabs.Tab>
          <Tabs.Tab value="facturar">Facturar</Tabs.Tab>
          <Tabs.Tab value="catalogos">Catálogos</Tabs.Tab>
          <Tabs.Tab value="portal">Portal de clientes</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="muestras" pt="md">
          <PestanaMuestras />
        </Tabs.Panel>
        <Tabs.Panel value="facturar" pt="md">
          <PestanaFacturar />
        </Tabs.Panel>
        <Tabs.Panel value="catalogos" pt="md">
          <PestanaCatalogos />
        </Tabs.Panel>
        <Tabs.Panel value="portal" pt="md">
          <PestanaPortal />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
