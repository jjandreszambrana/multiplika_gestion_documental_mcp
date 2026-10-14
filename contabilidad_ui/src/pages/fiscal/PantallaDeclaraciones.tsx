import { Alert, Badge, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import { declaracionesDel303, type DeclaracionEnLista } from '../../api/fiscal'
import { formatearFecha, formatearImporte } from '../../lib/format'
import { estadoDe, RESULTADOS } from './declaracion'
import FichaDeclaracion from './FichaDeclaracion'
import { nombreDePeriodo } from './periodos'

interface Props {
  ejercicio: number | null
  nivel: string
}

/**
 * Las declaraciones del 303 guardadas del ejercicio: las que quedaron
 * registradas al bajar el Excel y las preparadas o presentadas. Pulsando una
 * se abre su ficha en el mismo sitio; al volver, la lista ya está al día.
 */
export default function PantallaDeclaraciones({ ejercicio, nivel }: Props) {
  const [filas, setFilas] = useState<DeclaracionEnLista[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [recarga, setRecarga] = useState(0)

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
  }, [ejercicio, recarga])

  if (abierta !== null) {
    return (
      <FichaDeclaracion
        idDeclaracion={abierta}
        nivel={nivel}
        alVolver={() => setAbierta(null)}
        alCambiada={() => setRecarga((v) => v + 1)}
      />
    )
  }

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
              <Table.Th>Contabilizada</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((fila) => {
              const estado = estadoDe(fila.estado)
              return (
                <Table.Tr key={fila.id} onClick={() => setAbierta(fila.id)} style={{ cursor: 'pointer' }}>
                  <Table.Td>
                    {nombreDePeriodo(fila.periodo)}
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
                  <Table.Td>{fila.contabilizada ? 'Sí' : ''}</Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
