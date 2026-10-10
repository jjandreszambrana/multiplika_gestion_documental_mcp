import { ActionIcon, Indicator, Modal, Tooltip } from '@mantine/core'
import { IconBell } from '@tabler/icons-react'
import { useState } from 'react'
import type { Configuracion } from '../api/configuracion'
import AvisosConfiguracion from './AvisosConfiguracion'

interface Props {
  configuracion: Configuracion
}

/** Cuántas cosas hay que decir. Cero significa que la campana no se pinta. */
function cuantos(configuracion: Configuracion): number {
  return (
    (configuracion.cuentas_sin_poner ?? []).length +
    (configuracion.avisos ?? []).length +
    (configuracion.ejercicios_abiertos === 0 ? 1 : 0)
  )
}

/**
 * Los avisos de configuración, guardados detrás de una campana.
 *
 * Antes ocupaban una franja fija en lo alto de todas las pantallas: se leen una
 * vez, no se pueden cerrar y a partir de ahí solo quitan alto a la rejilla. Los
 * textos son los mismos, no se han tocado.
 */
export default function CampanaAvisos({ configuracion }: Props) {
  const [abierto, setAbierto] = useState(false)
  const total = cuantos(configuracion)

  if (total === 0) return null

  return (
    <>
      <Tooltip label="Avisos">
        <Indicator label={total} size={16} color="red">
          <ActionIcon variant="default" size="lg" aria-label="Avisos" onClick={() => setAbierto(true)}>
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Tooltip>

      <Modal opened={abierto} onClose={() => setAbierto(false)} title="Avisos" size="lg">
        <AvisosConfiguracion configuracion={configuracion} />
      </Modal>
    </>
  )
}
