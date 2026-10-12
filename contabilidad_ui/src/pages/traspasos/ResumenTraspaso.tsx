import { Alert, Button, Group, List, Paper, Stack, Table, Text, Title } from '@mantine/core'
import type { AsientoGenerado, ResultadoPeriodo, ResultadoReintento } from '../../api/contabilizar'
import { formatearEntero } from '../../lib/format'

interface Props {
  resultado: ResultadoPeriodo | null
  reintento: ResultadoReintento | null
  alVerBorradores: () => void
}

/**
 * Desde el 12/10/2026 el traspaso no confirma nada: cada factura entra como
 * borrador y el contable la confirma. Se dice cuántos y se lleva a ellos.
 */
function AvisoBorradores({ cuantos, alVer }: { cuantos: number; alVer: () => void }) {
  if (cuantos === 0) return null
  return (
    <Alert color="yellow">
      <Group justify="space-between" gap="sm">
        <Text size="sm">
          {cuantos === 1
            ? 'Se ha creado 1 borrador. No entra en el libro hasta que lo confirmes.'
            : `Se han creado ${formatearEntero(cuantos)} borradores. No entran en el libro hasta que los confirmes.`}
        </Text>
        <Button size="xs" onClick={alVer}>
          Ver los borradores
        </Button>
      </Group>
    </Alert>
  )
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
export default function ResumenTraspaso({ resultado, reintento, alVerBorradores }: Props) {
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
          <AvisoBorradores cuantos={reintento.resueltas} alVer={alVerBorradores} />
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
          <Cuenta rotulo="En borrador" cuantas={resultado.contabilizadas} />
          <Cuenta rotulo="Ya tenían asiento" cuantas={resultado.ya_contabilizadas} />
          <Cuenta rotulo="Anuladas" cuantas={resultado.anuladas} />
          <Cuenta rotulo="Quedan pendientes" cuantas={resultado.pendientes} />
        </Group>

        <AvisoBorradores cuantos={resultado.contabilizadas} alVer={alVerBorradores} />
        <Motivos motivos={resultado.motivos ?? {}} />
        <Asientos asientos={resultado.asientos ?? []} />
      </Stack>
    </Paper>
  )
}
