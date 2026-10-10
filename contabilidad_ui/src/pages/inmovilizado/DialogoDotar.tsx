import { Alert, Button, Group, Modal, Select, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { dotarAmortizacion, type ResultadoDeDotar } from '../../api/inmovilizado'
import { formatearImporte } from '../../lib/format'
import { nombreDePeriodo } from '../ejercicios/periodos'

interface Props {
  abierto: boolean
  /** El del selector de la cabecera; nulo si no hay ninguno elegido. */
  ejercicio: number | null
  alCerrar: () => void
  alHecho: () => void
}

const MESES = Array.from({ length: 12 }, (_, i) => {
  const codigo = String(i + 1).padStart(2, '0')
  return { value: codigo, label: nombreDePeriodo(codigo) }
})

function Ensayo({ salida }: { salida: ResultadoDeDotar }) {
  return (
    <Stack gap="sm">
      {salida.detalle.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aquí no hay ningún bien que amortizar en ese mes.
        </Text>
      ) : (
        <>
          <Text fw={500} size="sm">
            Se amortizan
          </Text>
          <Table fz="sm" verticalSpacing={4}>
            <Table.Tbody>
              {salida.detalle.map((bien) => (
                <Table.Tr key={bien.id_inmovilizado}>
                  <Table.Td>{bien.descripcion}</Table.Td>
                  <Table.Td align="right">{formatearImporte(bien.importe)}</Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr>
                <Table.Td fw={600}>Total</Table.Td>
                <Table.Td align="right" fw={600}>
                  {formatearImporte(salida.total)}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </>
      )}

      {salida.saltados_detalle.length > 0 && (
        <>
          <Text fw={500} size="sm">
            No entran
          </Text>
          <Table fz="sm" verticalSpacing={4}>
            <Table.Tbody>
              {salida.saltados_detalle.map((bien) => (
                <Table.Tr key={bien.id_inmovilizado}>
                  <Table.Td>{bien.descripcion}</Table.Td>
                  <Table.Td c="dimmed">{bien.motivo}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  )
}

/**
 * Dotar la amortización de un mes. Nivel `apuntes`. Hace un asiento con todos
 * los bienes que entran, así que primero se ensaya.
 *
 * La dotación es siempre de un mes: la amortización es un gasto de cada periodo
 * y meterla entera en un asiento de diciembre falsearía los meses.
 */
export default function DialogoDotar({ abierto, ejercicio, alCerrar, alHecho }: Props) {
  const [mes, setMes] = useState<string | null>(null)
  const [ensayo, setEnsayo] = useState<ResultadoDeDotar | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  function cerrar() {
    setMes(null)
    setEnsayo(null)
    setError(null)
    alCerrar()
  }

  async function lanzar(simular: boolean) {
    if (ejercicio === null || mes === null) return
    setError(null)
    setTrabajando(true)
    try {
      const salida = await dotarAmortizacion(ejercicio, mes, simular)
      if (simular) setEnsayo(salida)
      else alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  // Nada que dotar: el botón de dotar sobra antes de que la API lo rechace.
  const hayQueDotar = ensayo !== null && ensayo.detalle.length > 0

  return (
    <Modal
      opened={abierto}
      onClose={cerrar}
      title="Dotar la amortización de un mes"
      size="lg"
      centered
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Group grow align="flex-start">
          <Text size="sm" fw={500}>
            Ejercicio {ejercicio ?? ''}
          </Text>
          <Select
            label="Mes"
            data={MESES}
            value={mes}
            onChange={(valor) => {
              setMes(valor)
              setEnsayo(null)
            }}
            required
          />
        </Group>

        {ensayo !== null && <Ensayo salida={ensayo} />}

        <Group justify="flex-end">
          <Button variant="default" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="default"
            disabled={mes === null}
            loading={trabajando && ensayo === null}
            onClick={() => void lanzar(true)}
          >
            Ver qué se dotaría
          </Button>
          <Button
            disabled={!hayQueDotar}
            loading={trabajando && ensayo !== null}
            onClick={() => void lanzar(false)}
          >
            Dotar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
