import { Alert, Button, Group, List, Loader, Modal, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { contabilizar, type Liquidacion } from '../../api/declaraciones'
import { listarDiarios, type DiarioContable } from '../../api/diarios'
import { textoDeError } from '../../api/errores'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaParaApi } from '../../lib/fecha'
import { formatearFecha, formatearImporte } from '../../lib/format'

interface Props {
  abierto: boolean
  idDeclaracion: number
  /** El asiento solo se graba con la declaración registrada o presentada. */
  registrada: boolean
  alCerrar: () => void
  /** Tras grabar: la ficha y la lista tienen que volver a leerse. */
  alHecho: () => void
}

function Comparacion({ liquidacion }: { liquidacion: Liquidacion }) {
  return (
    <SimpleGrid cols={2} spacing="xs">
      <Text size="sm">
        IVA repercutido: declarado {formatearImporte(liquidacion.repercutido_declarado)}, en el
        libro {formatearImporte(liquidacion.repercutido_contabilizado)}
      </Text>
      <Text size="sm">
        IVA soportado: declarado {formatearImporte(liquidacion.soportado_declarado)}, en el libro{' '}
        {formatearImporte(liquidacion.soportado_contabilizado)}
      </Text>
    </SimpleGrid>
  )
}

/**
 * El asiento de la liquidación. Al abrirse se ensaya (no se graba nada) para
 * enseñar las líneas, las diferencias con el libro y lo que falta. Solo si la
 * API dice que es grabable se ofrece grabarlo, y nace en borradores: se revisa
 * y se confirma allí como cualquier otro.
 */
export default function DialogoContabilizar({
  abierto,
  idDeclaracion,
  registrada,
  alCerrar,
  alHecho,
}: Props) {
  const [fecha, setFecha] = useState<Date | null>(null)
  const [diario, setDiario] = useState<string | null>(null)
  const [diarios, setDiarios] = useState<DiarioContable[]>([])
  const [ensayo, setEnsayo] = useState<Liquidacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [grabando, setGrabando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    listarDiarios(false)
      .then(setDiarios)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [abierto])

  // Cada cambio de fecha o diario vuelve a ensayar: lo que se graba es lo que se ve.
  useEffect(() => {
    if (!abierto) return
    let vigente = true
    setCargando(true)
    setError(null)
    contabilizar(idDeclaracion, { ensayo: true, fecha: fechaParaApi(fecha), diario: diario ?? '' })
      .then((salida) => vigente && setEnsayo(salida))
      .catch((fallo: unknown) => {
        if (!vigente) return
        setEnsayo(null)
        setError(textoDeError(fallo))
      })
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [abierto, idDeclaracion, fecha, diario])

  function cerrar() {
    setFecha(null)
    setDiario(null)
    setEnsayo(null)
    setError(null)
    alCerrar()
  }

  async function grabar() {
    setError(null)
    setGrabando(true)
    try {
      await contabilizar(idDeclaracion, { ensayo: false, fecha: fechaParaApi(fecha), diario: diario ?? '' })
      cerrar()
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGrabando(false)
    }
  }

  const puedeGrabar = ensayo !== null && ensayo.grabable && registrada

  return (
    <Modal opened={abierto} onClose={cerrar} title="Contabilizar la liquidación" size="xl" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Así quedaría el asiento. Todavía no se ha grabado nada.
        </Text>

        <Group grow align="flex-end">
          <CasillaFecha
            label="Fecha del asiento"
            placeholder="El último día del periodo"
            value={fecha}
            onChange={setFecha}
            clearable
          />
          <Select
            label="Diario"
            placeholder="El de siempre"
            data={diarios.map((d) => ({ value: d.codigo, label: `${d.codigo} · ${d.descripcion}` }))}
            value={diario}
            onChange={setDiario}
            clearable
          />
        </Group>

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {cargando && ensayo === null && <Loader size="sm" />}

        {ensayo !== null && (
          <>
            {ensayo.faltan.length > 0 && (
              <Alert color="orange" title="Todavía no se puede contabilizar">
                <List size="sm">
                  {ensayo.faltan.map((texto) => (
                    <List.Item key={texto}>{texto}</List.Item>
                  ))}
                </List>
              </Alert>
            )}
            {ensayo.faltan.length === 0 && !registrada && (
              <Alert color="orange" title="Todavía no se puede contabilizar">
                Primero hay que marcar la declaración como registrada.
              </Alert>
            )}
            {ensayo.avisos.length > 0 && (
              <Alert color="yellow" title="Lo declarado no coincide con el libro">
                <List size="sm">
                  {ensayo.avisos.map((texto) => (
                    <List.Item key={texto}>{texto}</List.Item>
                  ))}
                </List>
                <Text size="xs" mt="xs">
                  No impide contabilizar: la diferencia va en una línea aparte.
                </Text>
              </Alert>
            )}

            <Text size="sm">
              {formatearFecha(ensayo.fecha)} · {ensayo.concepto}
              {ensayo.diario && ` · diario ${ensayo.diario}`}
            </Text>

            <Table fz="sm" striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cuenta</Table.Th>
                  <Table.Th>Concepto</Table.Th>
                  <Table.Th ta="right">Debe</Table.Th>
                  <Table.Th ta="right">Haber</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ensayo.lineas.map((linea, indice) => (
                  <Table.Tr key={indice}>
                    <Table.Td ff="monospace">
                      {linea.cuenta || (
                        <Text span size="sm" c="orange">
                          Sin cuenta
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{linea.concepto || ensayo.concepto}</Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {linea.debe.isZero() ? '' : formatearImporte(linea.debe)}
                    </Table.Td>
                    <Table.Td ta="right" ff="monospace">
                      {linea.haber.isZero() ? '' : formatearImporte(linea.haber)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={2}>{ensayo.cuadra ? 'Total' : 'Total (no cuadra)'}</Table.Th>
                  <Table.Th ta="right" ff="monospace">
                    {formatearImporte(ensayo.total_debe)}
                  </Table.Th>
                  <Table.Th ta="right" ff="monospace">
                    {formatearImporte(ensayo.total_haber)}
                  </Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>

            <Comparacion liquidacion={ensayo} />
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={cerrar}>
            {puedeGrabar ? 'Cancelar' : 'Cerrar'}
          </Button>
          {puedeGrabar && (
            <Button loading={grabando} disabled={cargando} onClick={() => void grabar()}>
              Grabar en borradores
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
