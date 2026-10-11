import { Group, Text, Tooltip } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'

/** La cabecera de una columna de la hoja, con su nota al pasar por el icono. */
export default function TituloConNota({ titulo, nota }: { titulo: string; nota: string }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Text size="sm" fw={600}>
        {titulo}
      </Text>
      <Tooltip label={nota} multiline w={300} withArrow>
        <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
      </Tooltip>
    </Group>
  )
}
