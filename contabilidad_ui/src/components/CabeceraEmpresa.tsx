import { Button, Group, Text } from '@mantine/core'
import type { Empresa, Usuario } from '../api/sesion'

interface Props {
  empresa: Empresa
  nivel: string
  usuario: Usuario | null
  /** Nulo cuando el usuario no puede conmutar: entonces no hay nada que cambiar. */
  alCambiarEmpresa: (() => void) | null
  /** Nulo dentro del panel de la GD, que tiene su propia salida. */
  alSalir: (() => void) | null
}

/**
 * Va en todas las pantallas del módulo. Apuntar en la empresa equivocada es el
 * error más caro de esta aplicación, así que el nombre y el NIF están siempre
 * a la vista.
 */
export default function CabeceraEmpresa({
  empresa,
  nivel,
  usuario,
  alCambiarEmpresa,
  alSalir,
}: Props) {
  return (
    <Group justify="space-between" px="md" py="xs" wrap="nowrap">
      <div>
        <Text fw={600}>{empresa.NombreRazon ?? `Empresa ${empresa.id_obligado}`}</Text>
        <Text size="sm" c="dimmed">
          {empresa.NIF ?? 'Sin NIF'} · {nivel}
        </Text>
      </div>

      <Group gap="xs" wrap="nowrap">
        {usuario && <Text size="sm">{usuario.nombre_real ?? usuario.usuario}</Text>}
        {alCambiarEmpresa && (
          <Button variant="default" size="xs" onClick={alCambiarEmpresa}>
            Cambiar empresa
          </Button>
        )}
        {alSalir && (
          <Button variant="subtle" size="xs" onClick={alSalir}>
            Salir
          </Button>
        )}
      </Group>
    </Group>
  )
}
