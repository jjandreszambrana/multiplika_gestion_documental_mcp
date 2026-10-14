import { Alert, Badge, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import { declaracionesDel303, type DeclaracionEnLista } from '../../api/fiscal'
import { formatearFecha, formatearImporte } from '../../lib/format'
import { PERIODOS } from './periodos'

const ESTADOS: Record<number, { texto: string; color: string }> = {
  0: { texto: 'Borrador', color: 'gray' },
  1: { texto: 'Registrada', color: 'blue' },
  2: { texto: 'Presentada', color: 'green' },
  3: { texto: 'Sustituida', color: 'orange' },
}

const RESULTADOS: Record<string, string> = {
  ingresar: 'A ingresar',
  compensar: 'A compensar',
  devolver: 'A devolver',
  resultado_cero: 'Sin resultado',
  sin_actividad: 'Sin actividad',
}

function nombreDelPeriodo(periodo: string): string {
  return PERIODOS.find((opcion) => opcion.value === periodo)?.label ?? periodo
}

/**
 * Las declaraciones del 303 guardadas del ejercicio: las que quedaron
 * registradas al bajar el Excel y las preparadas o presentadas.
 */
export default function PantallaDeclaraciones({ ejercicio }: { ejercicio: number | null }) {
  const [filas, setFilas] = useState<DeclaracionEnLista[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ejercicio === null) return
    const corte = new AbortController()
    setError(null)
    declaracionesDel303(ejercicio, corte.signal)
      .then(setFilas)
      .catch((fallo) => {
        if (!esAbortada(fallo)) setError(textoDeError(fallo))
      })
    return () => corte.abort()
  }, [ejercicio])

  return (
    <Stack gap="md">
      <Title order={3}>Declaraciones registradas</Title>

      {error !== null ? (
        <Alert color="red" role="alert" title="No se pudieron cargar las declaraciones">
          {error}
        </Alert>
      ) : filas === null ? (
        ejercicio !== null && <Loader size="sm" />
      ) : filas.length === 0 ? (
        <Text size="sm" c="dimmed">
          No hay declaraciones del 303 guardadas en este ejercicio. Se guardan al bajar el Excel
          del 303 en IVA y retenciones.
        </Text>
      ) : (
        <Table fz="sm" striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Periodo</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th ta="right">Resultado</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Calculada</Table.Th>
              <Table.Th>Presentada</Table.Th>
              <Table.Th>Justificante</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((fila) => {
              const estado = ESTADOS[fila.estado] ?? { texto: String(fila.estado), color: 'gray' }
              return (
                <Table.Tr key={fila.id}>
                  <Table.Td>
                    {nombreDelPeriodo(fila.periodo)}
                    {fila.secuencia > 1 && (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        (intento {fila.secuencia})
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={estado.color} variant="light">
                      {estado.texto}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace">
                    {formatearImporte(fila.resultado)}
                  </Table.Td>
                  <Table.Td>{RESULTADOS[fila.tipo_resultado] ?? fila.tipo_resultado}</Table.Td>
                  <Table.Td>{formatearFecha(fila.fecha_calculo)}</Table.Td>
                  <Table.Td>{formatearFecha(fila.fecha_presentacion)}</Table.Td>
                  <Table.Td>{fila.justificante ?? ''}</Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
