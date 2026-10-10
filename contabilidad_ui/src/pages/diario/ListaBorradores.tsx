import { Alert, Button, Group, Loader, Modal, Table, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { listarBorradores, type Borrador } from '../../api/borradores'
import { textoDeError } from '../../api/errores'
import { formatearFecha, formatearImporte } from '../../lib/format'

interface Props {
  abierto: boolean
  ejercicio: number | null
  alCerrar: () => void
  alAbrir: (id: number) => void
}

const POR_PAGINA = 100

/** Los asientos que alguien dejó empezados y todavía no están en el libro. */
export default function ListaBorradores({ abierto, ejercicio, alCerrar, alAbrir }: Props) {
  const [borradores, setBorradores] = useState<Borrador[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    setBorradores(null)
    setError(null)
    listarBorradores({
      ejercicio,
      soloCuadrados: false,
      soloMios: false,
      offset: 0,
      limit: POR_PAGINA,
    })
      .then((pagina) => setBorradores(pagina.borradores))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [abierto, ejercicio])

  return (
    <Modal opened={abierto} onClose={alCerrar} size="lg" title="Asientos sin confirmar" centered>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {borradores === null && !error && <Loader size="sm" />}

      {borradores !== null && borradores.length === 0 && (
        <Text size="sm" c="dimmed">
          No hay ningún asiento a medias.
        </Text>
      )}

      {borradores !== null && borradores.length > 0 && (
        <Table striped fz="sm" verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={110}>Fecha</Table.Th>
              <Table.Th>Concepto</Table.Th>
              <Table.Th w={110} ta="right">
                Importe
              </Table.Th>
              <Table.Th w={120}>Quién</Table.Th>
              <Table.Th w={100} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {borradores.map((borrador) => (
              <Table.Tr key={borrador.id}>
                <Table.Td>{formatearFecha(borrador.fecha)}</Table.Td>
                <Table.Td>{borrador.concepto}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {formatearImporte(borrador.total_debe)}
                </Table.Td>
                <Table.Td>{borrador.usuario}</Table.Td>
                <Table.Td>
                  <Group justify="flex-end" gap="xs" wrap="nowrap">
                    {!borrador.cuadra && (
                      <Text fz="xs" c="red">
                        No cuadra
                      </Text>
                    )}
                    <Button size="compact-xs" variant="light" onClick={() => alAbrir(borrador.id)}>
                      Abrir…
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Modal>
  )
}
