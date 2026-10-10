import { ActionIcon, Alert, Button, Group, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { eliminarModelo, listarModelos, type Modelo } from '../../api/importador'
import { formatearFecha } from '../../lib/format'
import DialogoModelo from './DialogoModelo'

const QUE_IMPORTA: Record<string, string> = {
  plan: 'Cuentas del plan',
  diario: 'Apuntes del diario',
  inmovilizado: 'Bienes de inmovilizado',
}

interface Props {
  abierto: boolean
  alCerrar: () => void
}

/** Los modelos de la empresa: crear, modificar y borrar. */
export default function ModelosDeImportacion({ abierto, alCerrar }: Props) {
  const [modelos, setModelos] = useState<Modelo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<Modelo | null>(null)
  const [creando, setCreando] = useState(false)
  const [aBorrar, setABorrar] = useState<Modelo | null>(null)

  const recargar = useCallback(() => {
    setError(null)
    listarModelos()
      .then(setModelos)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [])

  useEffect(() => {
    if (abierto) recargar()
  }, [abierto, recargar])

  return (
    <>
      <Modal opened={abierto} onClose={alCerrar} title="Modelos de importación" size="xl">
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button onClick={() => setCreando(true)}>Nuevo modelo…</Button>
          </Group>

          {modelos === null && !error ? (
            <Loader size="sm" />
          ) : modelos?.length === 0 ? (
            <Text c="dimmed">Todavía no hay ningún modelo. Crea uno para poder importar.</Text>
          ) : (
            <Table withRowBorders={false} striped="odd" verticalSpacing={2} horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Cabecera>Nombre</Cabecera>
                  <Cabecera>Qué importa</Cabecera>
                  <Cabecera>Última modificación</Cabecera>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(modelos ?? []).map((modelo) => (
                  <Table.Tr key={modelo.id}>
                    <Table.Td>
                      <Text fz="sm">{modelo.nombre}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{QUE_IMPORTA[modelo.destino] ?? modelo.destino}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm">{formatearFecha(modelo.fecha_hora_actualizacion)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          aria-label={`Modificar ${modelo.nombre}`}
                          onClick={() => setEditando(modelo)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          aria-label={`Borrar ${modelo.nombre}`}
                          onClick={() => setABorrar(modelo)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Modal>

      <DialogoModelo
        abierto={creando || editando !== null}
        modelo={editando}
        alCerrar={() => {
          setCreando(false)
          setEditando(null)
        }}
        alGuardado={() => {
          setCreando(false)
          setEditando(null)
          recargar()
        }}
      />

      <DialogoBorrar
        modelo={aBorrar}
        alCerrar={() => setABorrar(null)}
        alBorrado={() => {
          setABorrar(null)
          recargar()
        }}
      />
    </>
  )
}

function DialogoBorrar({
  modelo,
  alCerrar,
  alBorrado,
}: {
  modelo: Modelo | null
  alCerrar: () => void
  alBorrado: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [borrando, setBorrando] = useState(false)

  async function borrar() {
    if (modelo === null) return
    setError(null)
    setBorrando(true)
    try {
      await eliminarModelo(modelo.id)
      alBorrado()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setBorrando(false)
    }
  }

  return (
    <Modal opened={modelo !== null} onClose={alCerrar} title="Borrar el modelo" centered>
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Text>{modelo?.nombre}</Text>
        <Text size="sm">
          Deja de estar disponible al importar. Lo que ya se importó con él no se toca.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button color="red" onClick={borrar} loading={borrando}>
            Borrar
          </Button>
        </Group>
      </Stack>
    </Modal>
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
