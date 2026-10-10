import { Alert, Group, List, Paper, Stack, Table, Text, Title } from '@mantine/core'
import type { AsientoGenerado, ResultadoPeriodo, ResultadoReintento } from '../../api/contabilizar'
import { formatearEntero } from '../../lib/format'

interface Props {
  resultado: ResultadoPeriodo | null
  reintento: ResultadoReintento | null
}

function Cuenta({ rotulo, cuantas }: { rotulo: string; cuantas: number }) {
  return (
    <Stack gap={0} miw={140}>
      <Text fz="xl" fw={600}>
        {formatearEntero(cuantas)}
      </Text>
      <Text size="sm" c="dimmed">
        {rotulo}
      </Text>
    </Stack>
  )
}

/** El recuento por motivo, tal y como lo manda el servidor. */
function Motivos({ motivos }: { motivos: Record<string, number> }) {
  const lineas = Object.entries(motivos)
  if (lineas.length === 0) return null

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        Se han quedado fuera
      </Text>
      <List size="sm">
        {lineas.map(([motivo, cuantas]) => (
          <List.Item key={motivo}>
            {motivo} ({formatearEntero(cuantas)})
          </List.Item>
        ))}
      </List>
    </Stack>
  )
}

/** Dónde ha ido cada factura, que es lo que el contable apunta o comprueba. */
function Asientos({ asientos }: { asientos: AsientoGenerado[] }) {
  if (asientos.length === 0) return null

  return (
    <Table withTableBorder striped fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Factura</Table.Th>
          <Table.Th w={120}>Asiento</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {asientos.map((generado) => (
          <Table.Tr key={`${generado.ref_tipo}.${generado.ref_id}`}>
            <Table.Td>{generado.numero_factura ?? ''}</Table.Td>
            <Table.Td>{generado.asiento}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

/** Cómo ha ido lo último que se lanzó: contabilizar el periodo o reintentar. */
export default function ResumenTraspaso({ resultado, reintento }: Props) {
  if (reintento) {
    return (
      <Alert color="blue" title="Reintento terminado">
        <Stack gap="sm">
          <Group gap="xl">
            <Cuenta rotulo="Reintentadas" cuantas={reintento.reintentadas} />
            <Cuenta rotulo="Resueltas" cuantas={reintento.resueltas} />
            <Cuenta rotulo="Siguen pendientes" cuantas={reintento.siguen_pendientes} />
          </Group>
          <Motivos motivos={reintento.motivos ?? {}} />
        </Stack>
      </Alert>
    )
  }

  if (!resultado) return null

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Title order={5}>Resultado</Title>

        <Group gap="xl">
          <Cuenta rotulo="Contabilizadas" cuantas={resultado.contabilizadas} />
          <Cuenta rotulo="Ya tenían asiento" cuantas={resultado.ya_contabilizadas} />
          <Cuenta rotulo="Anuladas" cuantas={resultado.anuladas} />
          <Cuenta rotulo="Quedan pendientes" cuantas={resultado.pendientes} />
        </Group>

        <Motivos motivos={resultado.motivos ?? {}} />
        <Asientos asientos={resultado.asientos ?? []} />
      </Stack>
    </Paper>
  )
}
