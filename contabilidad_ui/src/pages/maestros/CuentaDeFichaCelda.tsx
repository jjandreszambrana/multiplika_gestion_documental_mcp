import { Badge, Group, Stack, Text, Tooltip } from '@mantine/core'
import type { CuentaDeFicha } from '../../api/maestros'

/**
 * Una cuenta de una ficha. Hay que enseñar tres cosas a la vez: la que está
 * escrita, la que regiría si estuviera vacía, y si esa cuenta existe de verdad
 * en el plan, que es lo que separa un código tecleado de una cuenta buena.
 */
export default function CuentaDeFichaCelda({ cuenta }: { cuenta: CuentaDeFicha }) {
  if (cuenta.efectiva === '') {
    return (
      <Badge size="xs" color="orange" variant="light">
        sin asignar
      </Badge>
    )
  }

  const heredada = cuenta.valor === ''

  return (
    <Stack gap={0}>
      <Group gap={6} wrap="nowrap">
        <Text ff="monospace" fz="sm">
          {cuenta.efectiva}
        </Text>
        {!cuenta.existe_en_el_plan && (
          <Tooltip label="Este código no está dado de alta en el plan contable">
            <Badge size="xs" color="red" variant="light">
              no está en el plan
            </Badge>
          </Tooltip>
        )}
        {heredada && (
          <Badge size="xs" color="gray" variant="light">
            {cuenta.de_donde}
          </Badge>
        )}
      </Group>
      {cuenta.descripcion_en_el_plan !== '' && (
        <Text fz="xs" c="dimmed">
          {cuenta.descripcion_en_el_plan}
        </Text>
      )}
    </Stack>
  )
}
