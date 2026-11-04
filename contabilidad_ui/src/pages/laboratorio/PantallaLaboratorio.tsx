import { Alert, Button, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { activarLaboratorio, type EstadoLaboratorio } from '../../api/laboratorio'
import { PESTANA_FIJA } from './comun'
import PestanaCatalogos from './PestanaCatalogos'
import PestanaFacturar from './PestanaFacturar'
import PestanaMuestras from './PestanaMuestras'
import PestanaPortal from './PestanaPortal'

interface Props {
  /** Qué pantalla enseñar: muestras, facturar, catalogos o portal. */
  seccion: string
  estado: EstadoLaboratorio
  /** Tras activarlo, para que el marco vuelva a preguntar. */
  alActivado: () => void
}

/** Las pantallas del personal del laboratorio ([5.54]). */
export default function PantallaLaboratorio({ seccion, estado, alActivado }: Props) {
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

  // La pestaña la elige el menú del panel anfitrión, a la izquierda.
  return (
    <Stack gap="md" style={PESTANA_FIJA}>
      {seccion === 'facturar' ? (
        <PestanaFacturar />
      ) : seccion === 'catalogos' ? (
        <PestanaCatalogos />
      ) : seccion === 'portal' ? (
        <PestanaPortal />
      ) : (
        <PestanaMuestras />
      )}
    </Stack>
  )
}
