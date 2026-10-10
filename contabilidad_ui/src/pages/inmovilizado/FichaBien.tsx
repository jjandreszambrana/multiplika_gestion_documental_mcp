import { Alert, Badge, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { obtenerBien, type FichaDeBien } from '../../api/inmovilizado'
import { formatearFecha, formatearImporte } from '../../lib/format'
import { aDecimal } from '../../lib/dinero'
import { nombreDePeriodo } from '../ejercicios/periodos'

interface Props {
  /** Nulo con la ficha cerrada. */
  idInmovilizado: number | null
  alCerrar: () => void
}

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {rotulo}
      </Text>
      <Text size="sm">{children}</Text>
    </Stack>
  )
}

/**
 * La ficha de un bien: sus datos y el cuadro de amortización, una fila por mes
 * dotado. El número de asiento es lo que permite ir del importe a su apunte.
 */
export default function FichaBien({ idInmovilizado, alCerrar }: Props) {
  const [ficha, setFicha] = useState<FichaDeBien | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (idInmovilizado === null) return
    setError(null)
    try {
      setFicha(await obtenerBien(idInmovilizado))
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }, [idInmovilizado])

  useEffect(() => {
    setFicha(null)
    void cargar()
  }, [cargar])

  return (
    <Modal
      opened={idInmovilizado !== null}
      onClose={alCerrar}
      title="Ficha del bien"
      size="lg"
      centered
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert" title="No se pudo cargar la ficha del bien">
            {error}
          </Alert>
        )}

        {ficha === null && !error && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Consultando el bien…
            </Text>
          </Group>
        )}

        {ficha !== null && (
          <>
            <Group gap="xs" wrap="nowrap">
              <Text fw={600}>{ficha.descripcion}</Text>
              {ficha.es_mejora && (
                <Badge size="xs" variant="light" color="blue">
                  Mejora
                </Badge>
              )}
            </Group>

            <Group gap="xl" wrap="wrap">
              <Dato rotulo="Compra">{formatearFecha(ficha.fecha_compra)}</Dato>
              <Dato rotulo="Se amortiza desde">{formatearFecha(ficha.fecha_inicio)}</Dato>
              <Dato rotulo="Valor">{formatearImporte(ficha.valor_adquisicion)}</Dato>
              <Dato rotulo="Valor residual">{formatearImporte(ficha.valor_residual)}</Dato>
              <Dato rotulo="% anual">
                {formatearImporte(aDecimal(ficha.porcentaje_anual), 2)}
              </Dato>
              {/* Solo cuando el bien vino de otra contabilidad: en el caso
                  normal es cero y sería una línea sin información. */}
              {!ficha.amortizado_inicial.isZero() && (
                <Dato rotulo="Ya amortizado al entrar">
                  {formatearImporte(ficha.amortizado_inicial)}
                </Dato>
              )}
              <Dato rotulo="Amortizado">{formatearImporte(ficha.amortizado)}</Dato>
              <Dato rotulo="Pendiente">{formatearImporte(ficha.pendiente_de_amortizar)}</Dato>
              <Dato rotulo="Cuota anual">{formatearImporte(ficha.dotacion_anual)}</Dato>
            </Group>

            {ficha.mejoras.length > 0 && (
              <Group gap="xl" wrap="wrap">
                <Dato rotulo="Valor con mejoras">
                  {formatearImporte(ficha.valor_con_mejoras)}
                </Dato>
                <Dato rotulo="Amortizado con mejoras">
                  {formatearImporte(ficha.amortizado_con_mejoras)}
                </Dato>
                <Dato rotulo="Valor neto con mejoras">
                  {formatearImporte(ficha.valor_neto_con_mejoras)}
                </Dato>
              </Group>
            )}

            <Group gap="xl" wrap="wrap">
              <Dato rotulo="Cuenta del activo">{ficha.cuenta_activo ?? ''}</Dato>
              <Dato rotulo="Cuenta de amortización">
                {ficha.cuenta_amortizacion ?? ''}
              </Dato>
              <Dato rotulo="Cuenta de gasto">{ficha.cuenta_gasto ?? ''}</Dato>
            </Group>

            {ficha.mejoras.length > 0 && (
              <>
                <Text fw={500} size="sm">
                  Mejoras
                </Text>
                <Table striped highlightOnHover fz="sm" verticalSpacing={4}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Descripción</Table.Th>
                      <Table.Th ta="right">Valor</Table.Th>
                      <Table.Th ta="right">Amortizado</Table.Th>
                      <Table.Th ta="right">Pendiente</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {ficha.mejoras.map((mejora) => (
                      <Table.Tr key={mejora.id}>
                        <Table.Td>{mejora.descripcion}</Table.Td>
                        <Table.Td align="right">
                          {formatearImporte(mejora.valor_adquisicion)}
                        </Table.Td>
                        <Table.Td align="right">{formatearImporte(mejora.amortizado)}</Table.Td>
                        <Table.Td align="right">
                          {formatearImporte(mejora.pendiente_de_amortizar)}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}

            <Text fw={500} size="sm">
              Cuadro de amortización
            </Text>

            {ficha.amortizaciones.length === 0 ? (
              <Text size="sm" c="dimmed">
                Este bien todavía no se ha amortizado ningún mes.
              </Text>
            ) : (
              <Table striped highlightOnHover fz="sm" verticalSpacing={4}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Periodo</Table.Th>
                    <Table.Th ta="right">Importe</Table.Th>
                    <Table.Th ta="right">Asiento</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ficha.amortizaciones.map((linea) => (
                    <Table.Tr key={`${linea.ejercicio}-${linea.periodo}`}>
                      <Table.Td>
                        {nombreDePeriodo(linea.periodo)} {linea.ejercicio}
                      </Table.Td>
                      <Table.Td align="right">{formatearImporte(linea.importe)}</Table.Td>
                      <Table.Td align="right">{linea.asiento ?? ''}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            {/* Aparte del cuadro a propósito: no son dotaciones, son el ajuste
                de haber corregido un valor mal tecleado. */}
            {ficha.correcciones.length > 0 && (
              <>
                <Text fw={500} size="sm">
                  Correcciones
                </Text>
                <Table striped highlightOnHover fz="sm" verticalSpacing={4}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Fecha</Table.Th>
                      <Table.Th>Concepto</Table.Th>
                      <Table.Th ta="right">Importe</Table.Th>
                      <Table.Th ta="right">Asiento</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {ficha.correcciones.map((linea, indice) => (
                      <Table.Tr key={`${linea.asiento ?? 0}-${indice}`}>
                        <Table.Td>{formatearFecha(linea.fecha)}</Table.Td>
                        <Table.Td>{linea.concepto}</Table.Td>
                        <Table.Td align="right">
                          {formatearImporte(linea.debe.isZero() ? linea.haber : linea.debe)}
                        </Table.Td>
                        <Table.Td align="right">{linea.asiento ?? ''}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}
          </>
        )}
      </Stack>
    </Modal>
  )
}
