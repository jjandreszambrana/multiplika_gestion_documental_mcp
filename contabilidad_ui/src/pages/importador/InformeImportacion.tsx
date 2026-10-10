import { Alert, Badge, Group, Stack, Table, Text } from '@mantine/core'
import { esAviso, type RespuestaEjecutar } from '../../api/importador'
import { formatearEntero } from '../../lib/format'

/**
 * Lo que entraría —o lo que ha entrado— y lo que se queda fuera. Es el mismo
 * informe en el ensayo y en la importación de verdad.
 */
export default function InformeImportacion({ informe }: { informe: RespuestaEjecutar }) {
  const incidencias = informe.incidencias ?? []
  const asientos = informe.asientos ?? []
  const hayAvisos = incidencias.some(esAviso)

  return (
    <Stack gap="sm">
      <Group gap="lg">
        <Text fw={500}>
          {informe.ensayo ? 'Entrarían' : 'Han entrado'} {formatearEntero(informe.filas_ok)} filas
          de {formatearEntero(informe.filas_leidas)}
        </Text>
        {informe.filas_apartadas > 0 && (
          <Text c="red">
            Se {informe.ensayo ? 'quedarían' : 'han quedado'} fuera{' '}
            {formatearEntero(informe.filas_apartadas)}
          </Text>
        )}
        {informe.filas_omitidas > 0 && (
          <Text c="dimmed">
            {formatearEntero(informe.filas_omitidas)} ya estaban y se han dejado como estaban
          </Text>
        )}
      </Group>

      {hayAvisos && (
        <Alert color="yellow">Estas filas entran igualmente; el aviso es para que lo sepas</Alert>
      )}

      {incidencias.length > 0 && (
        <Table.ScrollContainer minWidth={0} mah={320}>
          <Table striped="odd" withRowBorders={false} verticalSpacing={2} horizontalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Cabecera>Línea</Cabecera>
                <Cabecera>Referencia</Cabecera>
                <Cabecera>Motivo</Cabecera>
                <Cabecera>Contenido del archivo</Cabecera>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {incidencias.map((incidencia, indice) => (
                <Table.Tr key={`${incidencia.linea}-${indice}`}>
                  <Table.Td>
                    <Text fz="xs">{incidencia.linea}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="xs">{incidencia.referencia}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {esAviso(incidencia) && (
                        <Badge size="xs" variant="light" color="yellow">
                          Aviso
                        </Badge>
                      )}
                      <Text fz="xs">{incidencia.motivo}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="xs" c="dimmed">
                      {incidencia.contenido}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {!informe.ensayo && asientos.length > 0 && (
        <Stack gap="xs">
          <Text fw={500}>Números nuevos de cada asiento</Text>
          <Table.ScrollContainer minWidth={0} mah={260}>
            <Table striped="odd" withRowBorders={false} verticalSpacing={2} horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Cabecera>Número en el archivo</Cabecera>
                  <Cabecera>Número nuevo</Cabecera>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {asientos.map((asiento) => (
                  <Table.Tr key={`${asiento.ejercicio}-${asiento.asiento_origen}`}>
                    <Table.Td>
                      <Text fz="xs" ff="monospace">
                        {asiento.asiento_origen}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="xs" ff="monospace">
                        {asiento.asiento === 0 ? 'En borrador' : asiento.asiento}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      )}
    </Stack>
  )
}

function Cabecera({ children }: { children: string }) {
  return (
    <Table.Th>
      <Text fz="xs" c="dimmed">
        {children}
      </Text>
    </Table.Th>
  )
}
