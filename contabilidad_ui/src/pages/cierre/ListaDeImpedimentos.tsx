import { Alert, Badge, Group, List, Stack, Text } from '@mantine/core'
import type { Impedimentos } from '../../api/cierre'

/**
 * Lo que hay que resolver antes de poder cerrar. Es lo primero que se ve al
 * entrar: antes de enseñar qué va a pasar, se dice si se puede o no.
 *
 * Los textos los escribe la API y se enseñan tal cual. Lo único que decide esta
 * pantalla es si el impedimento apaga el botón o solo avisa, y eso lo dice
 * `bloquea`.
 */
export default function ListaDeImpedimentos({ datos }: { datos: Impedimentos }) {
  if (datos.se_puede_cerrar && datos.cuantos === 0) {
    return (
      <Alert color="green" role="status">
        No hay nada pendiente: el ejercicio se puede cerrar.
      </Alert>
    )
  }

  return (
    <Stack gap="xs">
      <Text fw={600}>Antes de cerrar</Text>
      <List spacing="xs" size="sm" listStyleType="none">
        {datos.impedimentos.map((uno) => (
          <List.Item key={uno.codigo}>
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <Badge size="xs" variant="light" color={uno.bloquea ? 'red' : 'yellow'}>
                {uno.bloquea ? 'Impide cerrar' : 'Aviso'}
              </Badge>
              <Text size="sm">{uno.texto}</Text>
            </Group>
          </List.Item>
        ))}
      </List>
    </Stack>
  )
}
