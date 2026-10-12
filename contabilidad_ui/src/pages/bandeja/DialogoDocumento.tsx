import { Alert, Badge, Button, Group, Loader, Modal, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import {
  obtenerDocumento,
  resolverDocumento,
  type Decision,
  type DocumentoBandeja,
  type FacturaBandeja,
  type MovimientoBandeja,
  type TipoDocumento,
} from '../../api/bandeja'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import { aDecimal } from '../../lib/dinero'
import { formatearFecha, formatearImporte } from '../../lib/format'
import { AVISO_CAMBIADA, ESTADOS, EXPLICACION_ESTADO, esFactura } from './textos'

interface Props {
  tipo: TipoDocumento
  /** Nulo con el diálogo cerrado. */
  id: number | null
  nivel: string
  alCerrar: () => void
  /** Tras resolver: la lista tiene que volver a leerse. */
  alCambiado: () => void
}

const CLASES_CUENTA: Record<string, string> = {
  ventas: 'Ventas',
  gasto: 'Gasto',
  suplido: 'Suplido',
}

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {rotulo}
      </Text>
      <Text size="sm">{children || '—'}</Text>
    </Stack>
  )
}

function importe(valor: number | null | undefined): string {
  return formatearImporte(aDecimal(valor))
}

function DatosFactura({ factura }: { factura: FacturaBandeja }) {
  const iva = factura.iva ?? []
  const cuentas = factura.cuentas ?? []
  const conRecargo = iva.some((tramo) => Number(tramo.cuota_re) !== 0)

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
        <Dato rotulo="Factura">{factura.libro === 'emitida' ? 'Emitida' : 'Recibida'}</Dato>
        <Dato rotulo="Número">{factura.numero_factura}</Dato>
        <Dato rotulo="Fecha">{formatearFecha(factura.fecha_expedicion)}</Dato>
        {factura.libro === 'recibida' && (
          <Dato rotulo="Fecha de registro">{formatearFecha(factura.fecha_contable)}</Dato>
        )}
        <Dato rotulo={factura.libro === 'emitida' ? 'Cliente' : 'Proveedor'}>
          {factura.nombre_tercero}
          {factura.nif_tercero ? ` (${factura.nif_tercero})` : ''}
        </Dato>
        <Dato rotulo="Cuenta">{factura.cuenta_tercero}</Dato>
        <Dato rotulo="Total">{importe(factura.importe_total)}</Dato>
        {Number(factura.retencion) !== 0 && (
          <Dato rotulo="Retención">
            {importe(factura.retencion)}
            {factura.cuenta_retencion ? ` · cuenta ${factura.cuenta_retencion}` : ''}
          </Dato>
        )}
        {factura.numero_rectificada && (
          <Dato rotulo="Rectifica a">{factura.numero_rectificada}</Dato>
        )}
      </SimpleGrid>

      {iva.length > 0 && (
        <Table withTableBorder striped fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>IVA</Table.Th>
              <Table.Th ta="right">Base</Table.Th>
              <Table.Th ta="right">Cuota</Table.Th>
              {conRecargo && <Table.Th ta="right">Recargo</Table.Th>}
              <Table.Th>Cuenta</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {iva.map((tramo, posicion) => (
              <Table.Tr key={posicion}>
                <Table.Td>{`${String(tramo.tipo_iva).replace('.', ',')} %`}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {importe(tramo.base)}
                </Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {importe(tramo.cuota)}
                </Table.Td>
                {conRecargo && (
                  <Table.Td ta="right" ff="monospace">
                    {importe(tramo.cuota_re)}
                  </Table.Td>
                )}
                <Table.Td>{tramo.cuenta_iva ?? ''}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {cuentas.length > 0 && (
        <Table withTableBorder striped fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Va a</Table.Th>
              <Table.Th>Cuenta</Table.Th>
              <Table.Th ta="right">Importe</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {cuentas.map((cuenta, posicion) => (
              <Table.Tr key={posicion}>
                <Table.Td>
                  {CLASES_CUENTA[cuenta.clase] ?? cuenta.clase}
                  {cuenta.descripcion ? ` · ${cuenta.descripcion}` : ''}
                </Table.Td>
                <Table.Td>{cuenta.cuenta ?? ''}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {importe(cuenta.importe)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

function DatosMovimiento({ movimiento }: { movimiento: MovimientoBandeja }) {
  const esCobro = movimiento.clase === 'cobro'
  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
      <Dato rotulo="Tipo">{esCobro ? 'Cobro' : 'Pago'}</Dato>
      <Dato rotulo="Fecha">{formatearFecha(movimiento.fecha)}</Dato>
      <Dato rotulo="Importe">{importe(movimiento.importe)}</Dato>
      <Dato rotulo={esCobro ? 'Cliente' : 'Proveedor'}>
        {movimiento.nombre_tercero}
        {movimiento.nif_tercero ? ` (${movimiento.nif_tercero})` : ''}
      </Dato>
      <Dato rotulo="Cuenta">{movimiento.cuenta_tercero}</Dato>
      <Dato rotulo="Banco o caja">{movimiento.cuenta_tesoreria}</Dato>
      <Dato rotulo="Concepto">{movimiento.concepto}</Dato>
      <Dato rotulo="Factura">
        {movimiento.numero_factura}
        {movimiento.fecha_factura ? ` del ${formatearFecha(movimiento.fecha_factura)}` : ''}
      </Dato>
    </SimpleGrid>
  )
}

/**
 * Un documento de la bandeja entero, y las decisiones que se pueden tomar
 * sobre él. Lo que ya tiene asiento no se resuelve aquí: primero se deshace
 * su contabilización desde la lista.
 */
export default function DialogoDocumento({ tipo, id, nivel, alCerrar, alCambiado }: Props) {
  const [documento, setDocumento] = useState<DocumentoBandeja | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<Decision | null>(null)

  useEffect(() => {
    if (id === null) return
    setDocumento(null)
    setError(null)
    obtenerDocumento(tipo, id)
      .then(setDocumento)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [tipo, id])

  async function decidir(decision: Decision) {
    if (id === null) return
    setError(null)
    setDecidiendo(decision)
    try {
      await resolverDocumento(tipo, id, decision)
      alCambiado()
      setDocumento(await obtenerDocumento(tipo, id))
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setDecidiendo(null)
    }
  }

  const puedeDecidir = alcanza(nivel, 'apuntes')
  const estado = documento ? ESTADOS[documento.estado] : undefined
  const titulo = tipo === 'facturas' ? 'Factura de Codiplika' : 'Cobro o pago de Codiplika'

  return (
    <Modal opened={id !== null} onClose={alCerrar} title={titulo} size="xl" centered>
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {!documento && !error && <Loader size="sm" />}

        {documento && (
          <>
            <Group gap="sm">
              <Badge color={estado?.color ?? 'gray'} variant="light">
                {estado?.nombre ?? documento.estado}
              </Badge>
              {documento.asiento ? (
                <Text size="sm">
                  Asiento {documento.asiento}
                  {documento.ejercicio_asiento ? ` de ${documento.ejercicio_asiento}` : ''}
                </Text>
              ) : null}
            </Group>

            {documento.cambio_en_origen === 1 && (
              <Alert color="orange">
                {AVISO_CAMBIADA}. El asiento no se ha tocado: si hay que corregirlo, deshaz la
                contabilización y vuelve a traerla.
              </Alert>
            )}

            {(documento.motivo || EXPLICACION_ESTADO[documento.estado]) && (
              <Text size="sm" c="dimmed">
                {documento.motivo || EXPLICACION_ESTADO[documento.estado]}
              </Text>
            )}

            {esFactura(documento, tipo) ? (
              <DatosFactura factura={documento} />
            ) : (
              <DatosMovimiento movimiento={documento as MovimientoBandeja} />
            )}

            {puedeDecidir && (
              <Group justify="flex-end" gap="sm">
                {documento.estado === 'en_conflicto' && (
                  <>
                    <Button
                      variant="default"
                      loading={decidiendo === 'sif'}
                      onClick={() => void decidir('sif')}
                    >
                      Vale la de la facturación
                    </Button>
                    <Button loading={decidiendo === 'importada'} onClick={() => void decidir('importada')}>
                      Vale esta
                    </Button>
                  </>
                )}
                {(documento.estado === 'pendiente' || documento.estado === 'en_conflicto') && (
                  <Button
                    color="red"
                    variant="light"
                    loading={decidiendo === 'descartar'}
                    onClick={() => void decidir('descartar')}
                  >
                    Descartar
                  </Button>
                )}
                {documento.estado === 'descartada' && (
                  <Button loading={decidiendo === 'recuperar'} onClick={() => void decidir('recuperar')}>
                    Recuperar
                  </Button>
                )}
              </Group>
            )}
          </>
        )}
      </Stack>
    </Modal>
  )
}
