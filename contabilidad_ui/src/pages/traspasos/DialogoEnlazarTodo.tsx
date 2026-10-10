import { Alert, Button, Group, List, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { enlazarProveedor, type EnlacePropuesto } from '../../api/maestros'
import { formatearEntero } from '../../lib/format'

interface Props {
  abierto: boolean
  propuestos: EnlacePropuesto[]
  /** Una factura de cada proveedor, que es lo que se manda al enlazar. */
  facturaDe: (nif: string) => number | null
  alCerrar: () => void
  alHecho: (cuantas: number) => void
}

/**
 * Los enlaces que se pueden hacer de una vez: un proveedor sin enlazar cuyo
 * NIF coincide con una sola ficha. Los propone el servidor y los confirma el
 * usuario; donde hay más de una ficha posible no se propone nada y se elige
 * factura a factura.
 */
export default function DialogoEnlazarTodo({
  abierto,
  propuestos,
  facturaDe,
  alCerrar,
  alHecho,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const total = propuestos.reduce((suma, uno) => suma + uno.cuantas, 0)

  async function confirmar() {
    setError(null)
    setTrabajando(true)
    try {
      let hechas = 0
      // Una llamada por proveedor: cada una arrastra sus facturas sin asiento.
      for (const propuesto of propuestos) {
        const idFactura = facturaDe(propuesto.nif)
        if (idFactura === null) continue
        const hecho = await enlazarProveedor(idFactura, propuesto.id_ficha)
        hechas += hecho.cuantas
      }
      alHecho(hechas)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal opened={abierto} onClose={alCerrar} title="Enlazar los proveedores" centered>
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Text size="sm">
          Se enlazarán {formatearEntero(total)} facturas con estos proveedores:
        </Text>

        <List size="sm">
          {propuestos.map((propuesto) => (
            <List.Item key={propuesto.nif}>
              {propuesto.etiqueta} — {propuesto.nif} ({formatearEntero(propuesto.cuantas)})
            </List.Item>
          ))}
        </List>

        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} loading={trabajando}>
            Enlazar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
