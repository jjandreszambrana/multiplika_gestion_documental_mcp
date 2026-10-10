import { Alert, Button, Group, List, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { crearCuentasQueFaltan, type RespuestaCrearCuentas } from '../../api/sincronizacion'
import type { FamiliaRevisada } from '../../api/sincronizacion'

interface Props {
  abierto: boolean
  /** Para decir en qué maestro se usa cada cuenta que falta. */
  maestros: FamiliaRevisada[]
  alCerrar: () => void
  alCreadas: () => void
}

/**
 * Antes de crear nada se enseña la lista completa: qué código, con qué
 * denominación y en qué maestro se está usando. Hasta que no se confirma no se
 * escribe en el plan.
 */
export default function DialogoCrearCuentas({ abierto, maestros, alCerrar, alCreadas }: Props) {
  const [simulacion, setSimulacion] = useState<RespuestaCrearCuentas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    setSimulacion(null)
    setError(null)

    crearCuentasQueFaltan(true)
      .then((leida) => vigente && setSimulacion(leida))
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))

    return () => {
      vigente = false
    }
  }, [abierto])

  async function confirmar() {
    setError(null)
    setCreando(true)
    try {
      await crearCuentasQueFaltan(false)
      alCreadas()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setCreando(false)
    }
  }

  /** En qué maestros está escrito ese código. */
  function seUsaEn(codigo: string): string {
    return maestros
      .filter((f) => (f.faltan_en_el_plan ?? []).includes(codigo))
      .map((f) => f.titulo)
      .join(', ')
  }

  const creadas = simulacion?.creadas ?? []
  const rechazadas = simulacion?.rechazadas ?? []
  const cuantas = simulacion?.cuantas ?? 0

  return (
    <Modal
      opened={abierto}
      onClose={alCerrar}
      title="Crear en el plan las cuentas que faltan"
      centered
      size="lg"
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {simulacion === null && !error ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm">Comprobando qué cuentas faltan…</Text>
          </Group>
        ) : (
          <>
            <Text size="sm">
              Estas cuentas están escritas en fichas de facturación, pero no existen en el plan
              contable. Se crearán como subcuentas, es decir, admitiendo apuntes, y con la
              denominación del registro donde se usan. No se modifica ninguna ficha de facturación
              ni ningún asiento.
            </Text>

            {cuantas > 0 && (
              <Table striped withTableBorder fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={140}>Cuenta</Table.Th>
                    <Table.Th>Denominación</Table.Th>
                    <Table.Th w={160}>Se usa en</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {creadas.map((cuenta) => (
                    <Table.Tr key={cuenta.codigo}>
                      <Table.Td ff="monospace">{cuenta.codigo}</Table.Td>
                      <Table.Td>{cuenta.descripcion}</Table.Td>
                      <Table.Td c="dimmed">{seUsaEn(cuenta.codigo)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}

            {rechazadas.length > 0 && (
              <Alert color="yellow" title="Estas no se pueden crear">
                <Text size="sm" mb={4}>
                  Están mal escritas en la ficha de facturación y hay que corregirlas allí.
                </Text>
                <List size="sm" spacing={2}>
                  {rechazadas.map((cuenta) => (
                    <List.Item key={cuenta.codigo}>
                      {cuenta.codigo}: {cuenta.motivo}
                    </List.Item>
                  ))}
                </List>
              </Alert>
            )}
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button loading={creando} disabled={cuantas === 0} onClick={() => void confirmar()}>
            Crear {cuantas} cuentas
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
