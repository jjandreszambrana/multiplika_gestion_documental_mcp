import { Alert, Button, Group, Modal, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { ajustarCasilla, type CasillaDeclarada, type FichaDeclaracion } from '../../api/declaraciones'
import { textoDeError } from '../../api/errores'
import { aCadenaApi, soloImporte } from '../../lib/dinero'
import { formatearImporte } from '../../lib/format'
import { importeTecleado } from '../diario/lineas'

interface Props {
  idDeclaracion: number
  /** Nula con el diálogo cerrado. */
  casilla: CasillaDeclarada | null
  alCerrar: () => void
  alHecho: (ficha: FichaDeclaracion) => void
}

/**
 * `soloImporte` quita el signo menos, pero aquí hace falta: las casillas de
 * rectificativas ([14], [15], [40]…) restan. Se respeta un menos delante.
 */
function importeConSigno(texto: string): string {
  const limpio = soloImporte(texto)
  return texto.trimStart().startsWith('-') ? `-${limpio}` : limpio
}

/**
 * Poner a mano el importe de una casilla de detalle. El motivo es obligatorio:
 * queda guardado con el usuario y la fecha, y es lo que se enseña al lado.
 * Los totales y el resultado los recalcula la API con el ajuste.
 */
export default function DialogoAjuste({ idDeclaracion, casilla, alCerrar, alHecho }: Props) {
  const [importe, setImporte] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cerrar() {
    setImporte('')
    setMotivo('')
    setError(null)
    alCerrar()
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (casilla === null) return
    setError(null)
    setGuardando(true)
    try {
      const ficha = await ajustarCasilla(
        idDeclaracion,
        casilla.casilla,
        aCadenaApi(importeTecleado(importe)),
        motivo.trim(),
      )
      setImporte('')
      setMotivo('')
      alHecho(ficha)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={casilla !== null}
      onClose={cerrar}
      title={casilla ? `Ajustar la casilla ${casilla.casilla}` : ''}
      centered
    >
      <form onSubmit={enviar}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text size="sm">{casilla?.descripcion}</Text>
          <Text size="sm" c="dimmed">
            El cálculo da {casilla ? formatearImporte(casilla.importe_calculado) : ''}. Si vuelves a
            calcular la declaración, el ajuste se mantiene y te avisaremos si el cálculo cambia.
          </Text>

          <TextInput
            label="Importe correcto"
            value={importe}
            onChange={(e) => setImporte(importeConSigno(e.currentTarget.value))}
            required
            autoFocus
            inputMode="decimal"
          />
          <Textarea
            label="Motivo"
            description="Por qué no vale lo calculado. Queda guardado con tu nombre y la fecha."
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
            required
            autosize
            minRows={2}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={cerrar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={guardando}
              disabled={importe.trim() === '' || motivo.trim() === ''}
            >
              Ajustar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
