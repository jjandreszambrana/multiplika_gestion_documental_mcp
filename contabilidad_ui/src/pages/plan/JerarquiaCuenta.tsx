import { Alert, Stack, Text } from '@mantine/core'
import { nombreDeTipo } from '../../lib/cuenta'
import type { Escalon } from './useJerarquia'

interface Props {
  escalones: Escalon[]
  error: string | null
}

/** Dónde va a quedar colgando la cuenta que se está tecleando. */
export default function JerarquiaCuenta({ escalones, error }: Props) {
  if (error) return <Alert color="yellow">{error}</Alert>
  if (escalones.length === 0) return null

  return (
    <Stack gap={2}>
      {escalones.map((escalon, posicion) => (
        <Text key={escalon.codigo} size="sm" pl={posicion * 12}>
          <Text span ff="monospace" fw={600}>
            {escalon.codigo}
          </Text>{' '}
          <Text span c="dimmed">
            {nombreDeTipo(escalon.codigo.length, false)}:
          </Text>{' '}
          {escalon.descripcion === null ? (
            <Text span c="orange">
              sin dar de alta
            </Text>
          ) : (
            escalon.descripcion
          )}
        </Text>
      ))}
    </Stack>
  )
}
