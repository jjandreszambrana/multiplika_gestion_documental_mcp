import { Alert, Button, Group, Modal, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { corregirValor, type Bien, type ResultadoDeCorregir } from '../../api/inmovilizado'
import { soloImporte } from '../../lib/dinero'
import { formatearImporte } from '../../lib/format'
import { importeTecleado } from '../diario/lineas'

interface Props {
  /** Nulo con el diálogo cerrado. */
  bien: Bien | null
  alCerrar: () => void
  alHecho: () => void
}

function Resumen({ salida }: { salida: ResultadoDeCorregir }) {
  return (
    <Table fz="sm" verticalSpacing={4} withRowBorders={false}>
      <Table.Tbody>
        <Table.Tr>
          <Table.Td>Amortizado en los libros</Table.Td>
          <Table.Td align="right">{formatearImporte(salida.amortizado_en_los_libros)}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Td>Amortizado correcto</Table.Td>
          <Table.Td align="right">{formatearImporte(salida.amortizado_correcto)}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          {/* Lo dice la API con `se_doto_de_mas`: aquí no se compara nada. */}
          <Table.Td fw={600}>{salida.se_doto_de_mas ? 'Se dotó de más' : 'Se dotó de menos'}</Table.Td>
          <Table.Td align="right" fw={600}>
            {formatearImporte(salida.diferencia)}
          </Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  )
}

/**
 * El bien que costó 3.000 y se dio de alta con 30.000, cuando ya se ha dotado.
 * Nivel `apuntes`.
 *
 * No es lo mismo que corregir la ficha: ahí lo dotado está bien y no hay nada
 * que deshacer. Aquí está mal, así que hace falta un asiento por la diferencia.
 * Por eso se ensaya antes de aceptar.
 */
export default function DialogoCorregirValor({ bien, alCerrar, alHecho }: Props) {
  const [valor, setValor] = useState('')
  const [ensayo, setEnsayo] = useState<ResultadoDeCorregir | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  function cerrar() {
    setValor('')
    setEnsayo(null)
    setError(null)
    alCerrar()
  }

  async function lanzar(simular: boolean) {
    if (bien === null) return
    setError(null)
    setTrabajando(true)
    try {
      const salida = await corregirValor({
        id_inmovilizado: bien.id,
        valor_adquisicion: importeTecleado(valor).toString(),
        simular,
      })
      if (simular) setEnsayo(salida)
      else alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal
      opened={bien !== null}
      onClose={cerrar}
      title="Corregir el valor del bien"
      size="lg"
      centered
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Text fw={600}>{bien?.descripcion}</Text>

        <Text size="sm">
          Se ha amortizado sobre un valor equivocado, así que hay gasto de más o de menos en el
          libro. Al corregirlo se hace un asiento por la diferencia.
        </Text>

        <TextInput
          label="Valor correcto"
          value={valor}
          onChange={(e) => {
            setValor(soloImporte(e.currentTarget.value))
            setEnsayo(null)
          }}
          required
          autoFocus
          inputMode="decimal"
        />

        {ensayo !== null && <Resumen salida={ensayo} />}

        <Text size="xs" c="dimmed">
          El cuadro de amortización no cambia: cada línea es un asiento que se hizo. La corrección
          se apunta aparte.
        </Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="default"
            disabled={valor.trim() === ''}
            loading={trabajando && ensayo === null}
            onClick={() => void lanzar(true)}
          >
            Ver cómo quedaría
          </Button>
          <Button
            disabled={ensayo === null}
            loading={trabajando && ensayo !== null}
            onClick={() => void lanzar(false)}
          >
            Corregir
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
