import { Group, Stack, Text } from '@mantine/core'
import { formatearImporte } from '../../lib/format'
import type { Totales } from './lineas'

/**
 * Las dos sumas y lo que falta para que cuadre, mientras se teclea. Es la única
 * cuenta que echa esta pantalla, y es un aviso: quien decide si un asiento
 * cuadra es el servidor al confirmarlo.
 */
export default function PieDeCuadre({ totales }: { totales: Totales }) {
  return (
    <Group justify="flex-end" gap="xl">
      <Cifra titulo="Total debe" valor={formatearImporte(totales.debe)} />
      <Cifra titulo="Total haber" valor={formatearImporte(totales.haber)} />
      <Cifra
        titulo="Diferencia"
        valor={formatearImporte(totales.diferencia)}
        color={totales.cuadra ? undefined : 'red'}
      />
    </Group>
  )
}

function Cifra({ titulo, valor, color }: { titulo: string; valor: string; color?: string }) {
  return (
    <Stack gap={0} align="flex-end">
      <Text fz="xs" c="dimmed">
        {titulo}
      </Text>
      <Text fz="sm" fw={600} ff="monospace" c={color}>
        {valor}
      </Text>
    </Stack>
  )
}
