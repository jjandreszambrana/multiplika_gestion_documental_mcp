import { Alert, Button, Checkbox, Grid, Group, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import {
  fijarCuentasDeFactura,
  fijarCuentasDeFicha,
  MAESTRO_PROVEEDORES,
  type FacturaConCuentas,
} from '../../api/maestros'
import ColumnaDeCuentas from './ColumnaDeCuentas'
import DialogoEnlazarProveedor from './DialogoEnlazarProveedor'

interface Props {
  factura: FacturaConCuentas | null
  ancho: number
  /** Enlazar un proveedor toca el maestro, así que pide nivel `cierre`. */
  puedeEnlazar: boolean
  alCerrar: () => void
  alGuardada: (factura: FacturaConCuentas) => void
  alEnlazado: (cuantas: number, proveedor: string) => void
}

/** Lo que tiene puesto cada juego de casillas, para saber qué ha cambiado. */
function valoresDe(cuentas: { campo: string; valor: string }[]): Record<string, string> {
  return Object.fromEntries(cuentas.map((c) => [c.campo, c.valor]))
}

function igual(uno: Record<string, string>, otro: Record<string, string>): boolean {
  const campos = new Set([...Object.keys(uno), ...Object.keys(otro)])
  return [...campos].every((campo) => (uno[campo] ?? '') === (otro[campo] ?? ''))
}

/**
 * Las cuentas de una factura recibida y las de su proveedor, una al lado de la
 * otra.
 *
 * Están juntas porque se miran juntas: la de la factura prevalece, y la del
 * proveedor es la que rige cuando aquella está en blanco. Con las dos delante
 * se ve de dónde va a salir la cuenta sin cambiar de pantalla.
 */
export default function DialogoCuentasDeFactura({
  factura,
  ancho,
  puedeEnlazar,
  alCerrar,
  alGuardada,
  alEnlazado,
}: Props) {
  const [enlazando, setEnlazando] = useState(false)
  const [deLaFactura, setDeLaFactura] = useState<Record<string, string>>({})
  const [delProveedor, setDelProveedor] = useState<Record<string, string>>({})
  const [crearEnPlan, setCrearEnPlan] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (factura === null) return
    setDeLaFactura(valoresDe(factura.cuentas ?? []))
    // La ficha del proveedor llega con la propia factura, así que la mitad
    // derecha no cuesta ninguna llamada.
    setDelProveedor(valoresDe(factura.ficha_proveedor?.cuentas ?? []))
    setError(null)
  }, [factura])

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (factura === null) return
    setError(null)
    setGuardando(true)
    try {
      // Primero el proveedor: así, al releer la factura, lo que herede ya
      // viene con lo nuevo.
      const ficha = factura.ficha_proveedor
      if (ficha && !igual(delProveedor, valoresDe(ficha.cuentas ?? []))) {
        await fijarCuentasDeFicha(MAESTRO_PROVEEDORES, ficha.id_ficha, delProveedor, crearEnPlan)
      }
      const respuesta = await fijarCuentasDeFactura(factura.id_factura, deLaFactura, crearEnPlan)
      if (respuesta.factura) alGuardada(respuesta.factura)
      else alCerrar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={factura !== null}
      onClose={alCerrar}
      title={factura ? `Cuentas de la factura ${factura.numero_factura}` : ''}
      centered
      size="xl"
    >
      {factura !== null && (
        <form onSubmit={enviar}>
          <Stack gap="md">
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}

            <Text size="sm" c="dimmed">
              {factura.proveedor}
            </Text>

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <ColumnaDeCuentas
                  titulo="Cuentas asignadas a la factura"
                  cuentas={factura.cuentas ?? []}
                  valores={deLaFactura}
                  alCambiar={setDeLaFactura}
                  ancho={ancho}
                  enfocar
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                {/* Sin proveedor enlazado no hay ficha de la que sacar la
                    cuenta, y la factura no se va a contabilizar. El enlace se
                    hace en facturación, no aquí. */}
                {factura.id_emisor === null && (
                  <Alert color="orange" p="xs">
                    <Stack gap="xs" align="flex-start">
                      <Text size="sm">
                        Esta factura no tiene el proveedor enlazado a su ficha, así que no se sabe
                        en qué cuenta va lo que se le debe.
                      </Text>
                      {puedeEnlazar && (
                        <Button size="xs" variant="light" onClick={() => setEnlazando(true)}>
                          Enlazar…
                        </Button>
                      )}
                    </Stack>
                  </Alert>
                )}

                {factura.id_emisor !== null && !factura.ficha_proveedor && (
                  <Alert color="yellow" p="xs">
                    <Text size="sm">No se han recibido las cuentas de este proveedor.</Text>
                  </Alert>
                )}

                {factura.ficha_proveedor && (
                  <ColumnaDeCuentas
                    titulo="Cuentas asignadas al proveedor"
                    cuentas={factura.ficha_proveedor.cuentas ?? []}
                    valores={delProveedor}
                    alCambiar={setDelProveedor}
                    ancho={ancho}
                    enfocar={false}
                  />
                )}
              </Grid.Col>
            </Grid>

            <Checkbox
              label="Dar de alta en el plan las cuentas que no existan"
              description="Sin esta opción, si la cuenta no está en el plan no se contabiliza la factura"
              checked={crearEnPlan}
              onChange={(e) => setCrearEnPlan(e.currentTarget.checked)}
            />

            <Text fz="xs" c="dimmed">
              Las cuentas asignadas a la factura prevalecen sobre las cuentas asignadas al
              proveedor.
            </Text>

            <Group justify="flex-end">
              <Button variant="default" onClick={alCerrar}>
                Cancelar
              </Button>
              <Button type="submit" loading={guardando}>
                Guardar
              </Button>
            </Group>
          </Stack>
        </form>
      )}

      <DialogoEnlazarProveedor
        factura={enlazando ? factura : null}
        alCerrar={() => setEnlazando(false)}
        alEnlazado={(cuantas, proveedor) => {
          setEnlazando(false)
          alEnlazado(cuantas, proveedor)
        }}
      />
    </Modal>
  )
}
