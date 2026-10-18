import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { crearEquivalenciaCuenta } from '../../api/diarioB'
import { textoDeError } from '../../api/errores'
import type { CuentaPlan } from '../../api/plan'
import BuscadorDelPlan from './BuscadorDelPlan'
import { useDestinosUsados } from './useDestinosUsados'

interface Props {
  ejercicio: number | null
  /** La cuenta del diario B tal como viene en sus líneas, y su descripción. */
  origen: { cuenta: string; titulo: string }
  /** Lo que se busca al abrir: la subcuenta que casa o la descripción. */
  busqueda: string
  alCerrar: () => void
  alCrear: () => void
}

/**
 * Asigna a una cuenta del diario B su equivalencia en el plan del SIF, desde
 * sumas y saldos. Se crea con la marca Flag puesta ([5.33]).
 */
export default function DialogoAsignarEquivalencia({
  ejercicio,
  origen,
  busqueda,
  alCerrar,
  alCrear,
}: Props) {
  const [elegida, setElegida] = useState<CuentaPlan | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { usados, error: errorUsados } = useDestinosUsados(null)

  async function crear() {
    if (!elegida) return
    setGuardando(true)
    setError(null)
    try {
      await crearEquivalenciaCuenta({
        cuenta_origen: origen.cuenta,
        ...(origen.titulo !== '' && { titulo_origen: origen.titulo }),
        cuenta_destino: elegida.codigo,
        ...(elegida.descripcion && { titulo_destino: elegida.descripcion }),
        flag: 1,
      })
      alCrear()
    } catch (fallo) {
      // Un 400 del SIF (p. ej. una equivalencia que ya existe) va tal cual.
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal opened onClose={alCerrar} title="Asignar equivalencia" size="lg">
      <Stack gap="sm">
        <Text size="sm">
          Cuenta del diario B:{' '}
          <Text span ff="monospace" fw={600}>
            {origen.cuenta}
          </Text>
          {origen.titulo !== '' && ` ${origen.titulo}`}
        </Text>
        <BuscadorDelPlan
          ejercicio={ejercicio}
          busqueda={busqueda}
          elegida={elegida}
          alElegir={setElegida}
          usados={usados}
        />
        {errorUsados && (
          <Alert color="yellow" role="alert">
            {`No se ha podido comprobar qué cuentas de destino ya están asignadas: ${errorUsados}`}
          </Alert>
        )}
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void crear()} disabled={!elegida} loading={guardando}>
            Crear equivalencia
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
