import { Alert, Button, CloseButton, Group, List, Paper, Stack, Text, Title } from '@mantine/core'
import type { ResultadoContabilizar, ResultadoDeshacer } from '../../api/bandeja'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { formatearEntero } from '../../lib/format'

interface Props {
  contabilizado: ResultadoContabilizar | null
  deshecho: ResultadoDeshacer | null
  alVerBorradores: () => void
  alCerrar: () => void
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

/**
 * Las cuentas que no existían y se han creado al contabilizar. Se enseñan con
 * su nombre del plan, que es el del cliente o proveedor: el código solo no le
 * dice al contable si lo que se ha creado está bien.
 */
function CuentasCreadas({ cuentas }: { cuentas: string[] }) {
  const { porCodigo } = usePlanEnMemoria()
  if (cuentas.length === 0) return null

  return (
    <Alert color="blue">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {cuentas.length === 1
            ? 'Se ha creado 1 cuenta nueva en el plan contable'
            : `Se han creado ${formatearEntero(cuentas.length)} cuentas nuevas en el plan contable`}
        </Text>
        <List size="sm">
          {cuentas.map((codigo) => (
            <List.Item key={codigo}>
              {codigo} {porCodigo.get(codigo)?.descripcion ?? ''}
            </List.Item>
          ))}
        </List>
      </Stack>
    </Alert>
  )
}

/** Cómo ha ido lo último que se lanzó: contabilizar o deshacer. */
export default function ResumenBandeja({ contabilizado, deshecho, alVerBorradores, alCerrar }: Props) {
  if (deshecho) {
    return (
      <Alert color="blue" title="Contabilización deshecha" withCloseButton onClose={alCerrar}>
        <Stack gap="xs">
          <Text size="sm">
            {deshecho.deshechos === 1
              ? 'Ha vuelto 1 a «Por contabilizar» y su borrador se ha quitado.'
              : `Han vuelto ${formatearEntero(deshecho.deshechos)} a «Por contabilizar» y sus borradores se han quitado.`}
          </Text>
          {deshecho.no_se_pueden.length > 0 && (
            <>
              <Text size="sm" fw={500}>
                No se han podido deshacer {formatearEntero(deshecho.no_se_pueden.length)}:
              </Text>
              <List size="sm">
                {/* El motivo es el mismo para muchas: se agrupa. */}
                {Object.entries(
                  deshecho.no_se_pueden.reduce<Record<string, number>>((cuenta, uno) => {
                    cuenta[uno.motivo] = (cuenta[uno.motivo] ?? 0) + 1
                    return cuenta
                  }, {}),
                ).map(([motivo, cuantas]) => (
                  <List.Item key={motivo}>
                    {motivo} ({formatearEntero(cuantas)})
                  </List.Item>
                ))}
              </List>
            </>
          )}
        </Stack>
      </Alert>
    )
  }

  if (!contabilizado) return null
  const motivos = Object.entries(contabilizado.motivos ?? {})

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={5}>Resultado</Title>
          <CloseButton aria-label="Cerrar el resultado" onClick={alCerrar} />
        </Group>

        <Group gap="xl">
          <Cuenta rotulo="En borrador" cuantas={contabilizado.contabilizados} />
          <Cuenta rotulo="Apartadas" cuantas={contabilizado.apartados} />
          <Cuenta rotulo="Ya estaban en la facturación" cuantas={contabilizado.duplicados} />
        </Group>

        {/* Nada entra en el libro desde aquí: se lleva a los borradores. */}
        {contabilizado.contabilizados > 0 && (
          <Alert color="yellow">
            <Group justify="space-between" gap="sm">
              <Text size="sm">
                {contabilizado.contabilizados === 1
                  ? 'Se ha creado 1 borrador. No entra en el libro hasta que lo confirmes.'
                  : `Se han creado ${formatearEntero(contabilizado.contabilizados)} borradores. No entran en el libro hasta que los confirmes.`}
              </Text>
              <Button size="xs" onClick={alVerBorradores}>
                Ver los borradores
              </Button>
            </Group>
          </Alert>
        )}

        <CuentasCreadas cuentas={contabilizado.cuentas_creadas ?? []} />

        {motivos.length > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Se han quedado fuera
            </Text>
            <List size="sm">
              {motivos.map(([motivo, cuantas]) => (
                <List.Item key={motivo}>
                  {motivo} ({formatearEntero(cuantas)})
                </List.Item>
              ))}
            </List>
          </Stack>
        )}

        {(contabilizado.avisos ?? []).length > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Para revisar
            </Text>
            <List size="sm">
              {contabilizado.avisos.map((aviso, posicion) => (
                <List.Item key={posicion}>{aviso}</List.Item>
              ))}
            </List>
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}
