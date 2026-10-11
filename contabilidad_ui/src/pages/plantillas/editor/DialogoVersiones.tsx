import { Alert, Button, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { textoDeError } from '../../../api/errores'
import { listarVersiones, type VersionPlantilla } from '../../../api/plantillas'
import { formatearFecha } from '../../../lib/format'

interface Props {
  idPlantilla: number
  alCerrar: () => void
  /** Carga esa versión en el editor, para mirarla o volver a ella. */
  alAbrir: (version: number) => void
}

/** Las versiones de una plantilla, de la más nueva a la más vieja. */
export default function DialogoVersiones({ idPlantilla, alCerrar, alAbrir }: Props) {
  const [versiones, setVersiones] = useState<VersionPlantilla[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarVersiones(idPlantilla)
      .then((v) => setVersiones([...v].sort((a, b) => b.version - a.version)))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [idPlantilla])

  return (
    <Modal opened onClose={alCerrar} title="Versiones de la plantilla" size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Cada cambio en lo que hace la plantilla guarda una versión nueva. Las anteriores no se
          tocan: cada asiento recuerda con cuál se hizo.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        {!versiones && !error && <Loader size="sm" />}
        {versiones && (
          <Table withTableBorder verticalSpacing={2} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Versión</Table.Th>
                <Table.Th>Quién</Table.Th>
                <Table.Th>Cuándo</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {versiones.map((v) => (
                <Table.Tr key={v.version}>
                  <Table.Td>{v.version}</Table.Td>
                  <Table.Td>{v.usuario ?? ''}</Table.Td>
                  <Table.Td>{`${formatearFecha(v.fecha_alta)} ${(v.fecha_alta ?? '').slice(11, 16)}`}</Table.Td>
                  <Table.Td ta="right">
                    <Button size="compact-xs" variant="subtle" onClick={() => alAbrir(v.version)}>
                      Abrir en el editor
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Modal>
  )
}
