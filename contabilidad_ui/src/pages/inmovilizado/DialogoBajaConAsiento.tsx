import { Alert, Button, Group, Modal, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { bajaConAsiento, type Bien, type ResultadoDeBaja } from '../../api/inmovilizado'
import { Badge } from '@mantine/core'
import CasillaDeCuenta from '../../components/CasillaDeCuenta'
import { CasillaFecha } from '../../components/CasillaFecha'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { soloImporte } from '../../lib/dinero'
import { fechaParaApi } from '../../lib/fecha'
import { formatearImporte } from '../../lib/format'
import DialogoCuentaAlVuelo from '../diario/DialogoCuentaAlVuelo'
import { importeTecleado } from '../diario/lineas'

interface Props {
  /** Nulo con el diálogo cerrado. */
  bien: Bien | null
  ancho: number
  /** El del selector de la cabecera: es el plan en el que se da de alta. */
  ejercicio: number | null
  alCerrar: () => void
  alHecho: () => void
}

/** El rótulo del resultado lo decide la API, no una resta hecha aquí. */
const ROTULO_RESULTADO: Record<string, string> = {
  beneficio: 'Beneficio',
  perdida: 'Pérdida',
}

/** Lo que el asiento se lleva por delante: el bien y sus mejoras. */
function SaleDeLosLibros({ salida }: { salida: ResultadoDeBaja }) {
  if (salida.se_dan_de_baja.length < 2) return null
  return (
    <Stack gap={4}>
      <Text fw={500} size="sm">
        Sale de los libros
      </Text>
      <Table fz="sm" verticalSpacing={4}>
        <Table.Tbody>
          {salida.se_dan_de_baja.map((pieza) => (
            <Table.Tr key={pieza.id_inmovilizado}>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm">{pieza.descripcion}</Text>
                  {pieza.es_mejora && (
                    <Badge size="xs" variant="light" color="blue">
                      Mejora
                    </Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td align="right">{formatearImporte(pieza.valor_adquisicion)}</Table.Td>
              <Table.Td align="right">{formatearImporte(pieza.amortizado)}</Table.Td>
              <Table.Td align="right">{formatearImporte(pieza.valor_neto)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

function Resumen({ salida }: { salida: ResultadoDeBaja }) {
  const rotulo = ROTULO_RESULTADO[salida.tipo_resultado] ?? 'Resultado'
  return (
    <Table fz="sm" verticalSpacing={4} withRowBorders={false}>
      <Table.Tbody>
        <Table.Tr>
          <Table.Td>Valor</Table.Td>
          <Table.Td align="right">{formatearImporte(salida.valor_adquisicion)}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Td>Amortizado</Table.Td>
          <Table.Td align="right">{formatearImporte(salida.amortizado)}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Td>Valor neto</Table.Td>
          <Table.Td align="right">{formatearImporte(salida.valor_neto)}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Td>Importe de la venta</Table.Td>
          <Table.Td align="right">{formatearImporte(salida.importe_venta)}</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Td fw={600}>{rotulo}</Table.Td>
          <Table.Td align="right" fw={600}>
            {formatearImporte(salida.resultado)}
          </Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  )
}

/**
 * Vender o tirar un bien y sacarlo de los libros. Nivel `apuntes`.
 *
 * Hace un asiento, así que primero se ensaya: `simular` devuelve cómo quedaría
 * —con el beneficio o la pérdida ya calculados por la API— sin escribir nada.
 * Hasta que no se ha visto, no se puede dar de baja.
 */
export default function DialogoBajaConAsiento({
  bien,
  ancho,
  ejercicio,
  alCerrar,
  alHecho,
}: Props) {
  const plan = usePlanEnMemoria()
  const [fecha, setFecha] = useState<Date | null>(null)
  const [venta, setVenta] = useState('')
  const [contrapartida, setContrapartida] = useState('')
  const [ensayo, setEnsayo] = useState<ResultadoDeBaja | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [creandoCuenta, setCreandoCuenta] = useState<string | null>(null)

  function cerrar() {
    setFecha(null)
    setVenta('')
    setContrapartida('')
    setEnsayo(null)
    setError(null)
    alCerrar()
  }

  async function lanzar(simular: boolean) {
    if (bien === null) return
    setError(null)
    setTrabajando(true)
    try {
      const salida = await bajaConAsiento({
        id_inmovilizado: bien.id,
        fecha_baja: fechaParaApi(fecha),
        simular,
        importe_venta: venta.trim() === '' ? '0' : importeTecleado(venta).toString(),
        cuenta_contrapartida: contrapartida.trim(),
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
      title="Dar de baja y sacar de los libros"
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
          Hace el asiento que quita el bien y su amortización acumulada, y lleva la diferencia a
          beneficio o a pérdida.
        </Text>

        <Group grow align="flex-start">
          <CasillaFecha
            label="Fecha de baja"
            value={fecha}
            onChange={(valor) => {
              setFecha(valor as Date | null)
              setEnsayo(null)
            }}
            clearable
            required
            autoFocus
          />

          <TextInput
            label="Importe de la venta"
            value={venta}
            onChange={(e) => {
              setVenta(soloImporte(e.currentTarget.value))
              setEnsayo(null)
            }}
            inputMode="decimal"
          />

          <CasillaDeCuenta
            id="cuenta-contrapartida"
            label="Cuenta donde entra el dinero"
            obligatoria={false}
            valor={contrapartida}
            ancho={ancho}
            alCambiar={(valor) => {
              setContrapartida(valor)
              setEnsayo(null)
            }}
            alCrear={setCreandoCuenta}
          />
        </Group>

        <Alert color="gray" variant="light" role="note">
          El IVA no va en este asiento: la venta se factura aparte y esa factura genera el suyo.
        </Alert>

        {ensayo !== null && (
          <>
            <SaleDeLosLibros salida={ensayo} />
            <Resumen salida={ensayo} />
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            variant="default"
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
            Dar de baja
          </Button>
        </Group>
      </Stack>

      <DialogoCuentaAlVuelo
        codigo={creandoCuenta}
        ejercicio={ejercicio}
        alCerrar={() => setCreandoCuenta(null)}
        alCreada={(cuenta) => {
          setContrapartida(cuenta.codigo)
          setEnsayo(null)
          setCreandoCuenta(null)
          plan.refrescar()
        }}
      />
    </Modal>
  )
}
