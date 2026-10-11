import { Alert, Badge, Group, Stack, Table, Text } from '@mantine/core'
import { Fragment } from 'react'
import type { AsientoCalculado } from '../../api/plantillas'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { formatearFecha, formatearImporte } from '../../lib/format'
import { claveDeLinea } from './errores'

interface Props {
  asientos: AsientoCalculado[]
  porLinea: Map<string, string[]>
  porAsiento: Map<number, string[]>
}

function titulo(a: AsientoCalculado, indice: number): string {
  const nombre = a.papel === 'reversion' ? 'Reversión' : `Asiento ${indice + 1}`
  const fecha = formatearFecha(a.fecha)
  return fecha ? `${nombre} · ${fecha}` : nombre
}

/**
 * El asiento tal y como lo ha calculado el servidor. Aquí no se suma nada: los
 * importes, los totales y si cuadra vienen hechos. Los errores van encima del
 * asiento o debajo de la línea que los causa.
 */
export default function VistaPrevia({ asientos, porLinea, porAsiento }: Props) {
  const plan = usePlanEnMemoria()

  if (asientos.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Rellena los datos para ver el asiento.
      </Text>
    )
  }

  // Los principales se numeran entre ellos; las reversiones van con su nombre.
  let principales = 0

  return (
    <Stack gap="md">
      {asientos.map((a) => {
        const indice = a.papel === 'reversion' ? 0 : principales++
        const delAsiento = porAsiento.get(a.orden) ?? []
        return (
          <Stack key={a.orden} gap={4}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={600}>
                {asientos.length > 1 ? titulo(a, indice) : formatearFecha(a.fecha)}
              </Text>
              <Text size="sm" c="dimmed" truncate>
                {a.concepto}
              </Text>
            </Group>
            {delAsiento.length > 0 && (
              <Alert color="red" p="xs">
                {delAsiento.join(' ')}
              </Alert>
            )}
            <Table withTableBorder verticalSpacing={2} horizontalSpacing="xs" fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cuenta</Table.Th>
                  <Table.Th>Concepto</Table.Th>
                  <Table.Th ta="right">Debe</Table.Th>
                  <Table.Th ta="right">Haber</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {a.lineas.map((l, i) => {
                  const errores = porLinea.get(claveDeLinea(a.orden, i))
                  return (
                    <Fragment key={i}>
                      <Table.Tr>
                        <Table.Td>
                          <Text size="sm" ff="monospace">
                            {l.cuenta}
                          </Text>
                          <Text size="xs" c="dimmed" truncate>
                            {plan.porCodigo.get(l.cuenta)?.descripcion ?? ''}
                          </Text>
                        </Table.Td>
                        <Table.Td>{l.concepto}</Table.Td>
                        <Table.Td ta="right">
                          {l.debe.isZero() ? '' : formatearImporte(l.debe)}
                        </Table.Td>
                        <Table.Td ta="right">
                          {l.haber.isZero() ? '' : formatearImporte(l.haber)}
                        </Table.Td>
                      </Table.Tr>
                      {errores && (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <Text size="xs" c="red">
                              {errores.join(' ')}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Fragment>
                  )
                })}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    {a.cuadra ? (
                      <Badge color="green" size="sm">
                        Cuadra
                      </Badge>
                    ) : (
                      <Badge color="red" size="sm">
                        {`Descuadre de ${formatearImporte(a.diferencia.abs())}`}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {formatearImporte(a.totalDebe)}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {formatearImporte(a.totalHaber)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Stack>
        )
      })}
    </Stack>
  )
}
