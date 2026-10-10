import { Alert, Badge, Button, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { obtenerEjercicio, type EjercicioDetalle, type Periodo } from '../../api/ejercicios'
import { textoDeError } from '../../api/errores'
import { formatearFecha } from '../../lib/format'
import DialogoPeriodo from './DialogoPeriodo'
import { nombreDePeriodo } from './periodos'

interface Props {
  /** Nulo con el panel cerrado. */
  ejercicio: number | null
  /** Sin nivel `cierre` los periodos se ven, pero no se tocan. */
  puedeMantener: boolean
  alCerrar: () => void
}

/**
 * Los doce periodos de liquidación de un ejercicio. Cerrar uno es lo que impide
 * que una factura que llega tarde se cuele en una declaración ya enviada.
 */
export default function PanelPeriodos({ ejercicio, puedeMantener, alCerrar }: Props) {
  const [detalle, setDetalle] = useState<EjercicioDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aConfirmar, setAConfirmar] = useState<Periodo | null>(null)

  const cargar = useCallback(async () => {
    if (ejercicio === null) return
    setError(null)
    try {
      setDetalle(await obtenerEjercicio(ejercicio))
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }, [ejercicio])

  useEffect(() => {
    setDetalle(null)
    void cargar()
  }, [cargar])

  // Un ejercicio cerrado no admite ningún cambio, tenga el usuario el nivel
  // que tenga: el botón sobra antes de que la API lo rechace.
  const seTocan = puedeMantener && detalle !== null && detalle.cerrado === 0

  return (
    <Modal
      opened={ejercicio !== null}
      onClose={alCerrar}
      title={ejercicio === null ? '' : `Periodos de ${ejercicio}`}
      size="lg"
      centered
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert" title="No se pudieron cargar los periodos">
            {error}
          </Alert>
        )}

        {detalle === null && !error && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Consultando el ejercicio…
            </Text>
          </Group>
        )}

        {detalle !== null && (
          <Table striped highlightOnHover fz="sm" verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Periodo</Table.Th>
                <Table.Th>Desde</Table.Th>
                <Table.Th>Hasta</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(detalle.periodos ?? []).map((periodo) => (
                <Table.Tr key={periodo.periodo}>
                  <Table.Td>{nombreDePeriodo(periodo.periodo)}</Table.Td>
                  <Table.Td>{formatearFecha(periodo.inicio)}</Table.Td>
                  <Table.Td>{formatearFecha(periodo.fin)}</Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      variant="light"
                      color={periodo.deshabilitado === 1 ? 'orange' : 'green'}
                    >
                      {periodo.deshabilitado === 1 ? 'Presentado' : 'Abierto'}
                    </Badge>
                  </Table.Td>
                  <Table.Td align="right">
                    {seTocan && (
                      <Button
                        size="compact-xs"
                        variant="default"
                        onClick={() => setAConfirmar(periodo)}
                      >
                        {periodo.deshabilitado === 1 ? 'Reabrir…' : 'Cerrar…'}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      {ejercicio !== null && (
        <DialogoPeriodo
          ejercicio={ejercicio}
          periodo={aConfirmar}
          alCerrar={() => setAConfirmar(null)}
          alHecho={() => {
            setAConfirmar(null)
            void cargar()
          }}
        />
      )}
    </Modal>
  )
}
