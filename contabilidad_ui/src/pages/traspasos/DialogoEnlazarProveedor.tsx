import { Alert, Button, Group, Modal, Radio, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { enlazarProveedor, type FacturaConCuentas } from '../../api/maestros'

interface Props {
  factura: FacturaConCuentas | null
  alCerrar: () => void
  /** Cuántas facturas han quedado enlazadas, para recargar y contarlo. */
  alEnlazado: (cuantas: number, proveedor: string) => void
}

/** Se crea una ficha nueva en vez de elegir una de las que hay. */
const FICHA_NUEVA = 'nueva'

/**
 * Con qué proveedor se corresponde una factura que no lo dice.
 *
 * La lista de fichas la propone el servidor por el NIF, pero elegir es del
 * usuario: adivinar el proveedor de una compra no lo hace ni el backend ni
 * esta pantalla.
 */
export default function DialogoEnlazarProveedor({ factura, alCerrar, alEnlazado }: Props) {
  const [elegida, setElegida] = useState<string>(FICHA_NUEVA)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const candidatos = factura?.proveedores_posibles ?? []

  useEffect(() => {
    if (factura === null) return
    // Con una sola ficha candidata, viene elegida: es el caso corriente.
    const primera = factura.proveedores_posibles?.[0]
    setElegida(primera ? String(primera.id_ficha) : FICHA_NUEVA)
    setError(null)
  }, [factura])

  async function confirmar() {
    if (factura === null) return
    setError(null)
    setTrabajando(true)
    try {
      const idFicha = elegida === FICHA_NUEVA ? null : Number(elegida)
      const hecho = await enlazarProveedor(factura.id_factura, idFicha)
      alEnlazado(hecho.cuantas, hecho.ficha.etiqueta)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal opened={factura !== null} onClose={alCerrar} title="Enlazar el proveedor" centered>
      {factura !== null && (
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Text size="sm">
            Esta factura no dice a qué proveedor corresponde. Elige su ficha o crea una nueva con
            los datos de la factura.
          </Text>

          <Radio.Group value={elegida} onChange={setElegida}>
            <Stack gap="xs">
              {candidatos.length > 0 && (
                <Text size="sm" fw={500}>
                  Fichas con este NIF
                </Text>
              )}

              {candidatos.map((posible) => (
                <Radio
                  key={posible.id_ficha}
                  value={String(posible.id_ficha)}
                  label={`${posible.etiqueta} — ${posible.nif}`}
                />
              ))}

              <Radio value={FICHA_NUEVA} label="Crear la ficha con los datos de la factura" />
            </Stack>
          </Radio.Group>

          <Text fz="xs" c="dimmed">
            Se enlazarán también las demás facturas de este proveedor que aún no tengan asiento.
          </Text>

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmar()} loading={trabajando}>
              Enlazar
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
