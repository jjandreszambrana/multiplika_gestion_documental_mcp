import { Alert, Button, Group, Modal, NumberInput, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  guardarMargenDiario,
  obtenerMargenDiario,
  recomprobarBandeja,
  type MargenDiario,
  type ResultadoRecomprobar,
} from '../../api/bandeja'
import { textoDeError } from '../../api/errores'
import { formatearEntero } from '../../lib/format'

interface Props {
  abierto: boolean
  alCerrar: () => void
  /** Tras aplicar: las listas tienen que volver a leerse. */
  alAplicado: () => void
}

/**
 * Vuelve a comparar lo que está por contabilizar con el diario, sin leer otra
 * vez de Codiplika. Primero cuenta lo que cambiaría; no toca nada hasta que se
 * confirma.
 */
export default function DialogoRecomprobar({ abierto, alCerrar, alAplicado }: Props) {
  const [resultado, setResultado] = useState<ResultadoRecomprobar | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Los días que se miran antes y después de la fecha: se guardan en la empresa.
  const [margen, setMargen] = useState<MargenDiario | null>(null)
  const [guardado, setGuardado] = useState<MargenDiario | null>(null)

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    obtenerMargenDiario()
      .then((m) => {
        if (!vigente) return
        setMargen(m)
        setGuardado(m)
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
    return () => {
      vigente = false
    }
  }, [abierto])

  function cerrar() {
    setResultado(null)
    setError(null)
    alCerrar()
  }

  async function lanzar(ensayo: boolean) {
    setError(null)
    setTrabajando(true)
    try {
      if (margen && guardado && (margen.margen_dias_antes !== guardado.margen_dias_antes || margen.margen_dias_despues !== guardado.margen_dias_despues)) {
        setGuardado(await guardarMargenDiario(margen))
      }
      const r = await recomprobarBandeja(ensayo)
      setResultado(r)
      if (!ensayo) alAplicado()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  const cambios = resultado ? resultado.pasan_a_posible_duplicado + resultado.vuelven_a_pendiente : 0
  return (
    <Modal opened={abierto} onClose={cerrar} title="Volver a comprobar con el diario" size="lg">
      <Stack gap="md">
        <Text size="sm">
          Mira de nuevo las facturas y los cobros y pagos que están por contabilizar y marca los que ya están en
          el diario. No vuelve a leer de Codiplika ni toca lo que ya está contabilizado o descartado.
        </Text>
        {margen && (
          <Stack gap={4}>
            <Group align="flex-end">
              <NumberInput
                label="Días de antes"
                min={0}
                max={90}
                allowDecimal={false}
                clampBehavior="strict"
                value={margen.margen_dias_antes}
                onChange={(v) => { setResultado(null); setMargen({ ...margen, margen_dias_antes: Number(v) || 0 }) }}
                w={130}
              />
              <NumberInput
                label="Días de después"
                min={0}
                max={90}
                allowDecimal={false}
                clampBehavior="strict"
                value={margen.margen_dias_despues}
                onChange={(v) => { setResultado(null); setMargen({ ...margen, margen_dias_despues: Number(v) || 0 }) }}
                w={130}
              />
            </Group>
            <Text size="xs" c="dimmed">
              Un cobro o pago se da por contabilizado si su apunte está en el diario hasta esos días antes o después de
              su fecha. Se guarda al comprobar y vale para todo lo que se traiga desde ahora.
            </Text>
          </Stack>
        )}
        {error && <Alert color="red">{error}</Alert>}
        {resultado && (
          <Alert color={resultado.ensayo ? 'blue' : 'green'}>
            {resultado.ensayo ? 'Si lo aplicas: ' : 'Hecho: '}
            {formatearEntero(resultado.pasan_a_posible_duplicado)} se marcan como ya contabilizados (o con duda, si el importe no cuadra)
            {resultado.vuelven_a_pendiente > 0 && `, ${formatearEntero(resultado.vuelven_a_pendiente)} vuelven a por contabilizar`}
            {' '}y {formatearEntero(resultado.siguen_pendientes)} siguen por contabilizar
            {resultado.ensayo ? '. Todavía no se ha cambiado nada.' : '.'}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={cerrar}>
            Cerrar
          </Button>
          {(!resultado || !resultado.ensayo) && (
            <Button loading={trabajando} onClick={() => void lanzar(true)}>
              {resultado ? 'Comprobar otra vez' : 'Ver qué cambiaría'}
            </Button>
          )}
          {resultado?.ensayo && cambios > 0 && (
            <Button color="green" loading={trabajando} onClick={() => void lanzar(false)}>
              Aplicar
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
