import { Alert, Badge, Button, Checkbox, Textarea, Group, List, Loader, Modal, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import {
  obtenerDocumento,
  bloquearDocumentos,
  revisarDocumentos,
  anotarDocumento,
  deshacerGrupo,
  obtenerGrupo,
  type Grupo,
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
import { formatearEntero, formatearFecha, formatearImporte } from '../../lib/format'
import ApuntesDelDiario from './ApuntesDelDiario'
import { AVISO_CAMBIADA, EXPLICACION_ESTADO, FASES_PAGARE, aspectoDeEstado, esFactura } from './textos'

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

/** Aviso de que el registro forma parte de una remesa agrupada, con su lista y la opción de deshacerla. */
function BloqueGrupo({
  movimiento,
  puedeDeshacer,
  alDeshecho,
}: {
  movimiento: MovimientoBandeja
  puedeDeshacer: boolean
  alDeshecho: () => void
}) {
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const idGrupo = Number(movimiento.id_grupo)

  useEffect(() => {
    setGrupo(null)
    obtenerGrupo(idGrupo)
      .then(setGrupo)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [idGrupo])

  async function deshacer() {
    setError(null)
    try {
      await deshacerGrupo(idGrupo)
      alDeshecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }

  return (
    <Alert color="indigo" title="Forma parte de un grupo">
      <Text size="sm">
        {formatearEntero(Number(movimiento.grupo_documentos))} documentos por {importe(movimiento.grupo_total)}, que en el
        diario son un solo apunte
        {grupo ? ` (asiento ${grupo.apunte.asiento} de ${grupo.apunte.ejercicio}, ${grupo.apunte.cuenta})` : ''}.
      </Text>
      {error && <Text size="sm" c="red">{error}</Text>}
      {grupo && (
        <Table mt="xs" withRowBorders={false}>
          <Table.Tbody>
            {grupo.lista.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>{formatearFecha(d.fecha)}</Table.Td>
                <Table.Td>{d.nombre_tercero}</Table.Td>
                <Table.Td>{d.numero_factura}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {importe(d.importe)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {puedeDeshacer && (
        <Button mt="xs" size="xs" variant="default" color="red" onClick={() => void deshacer()}>
          Deshacer el grupo
        </Button>
      )}
    </Alert>
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
      {movimiento.fase_pagare && FASES_PAGARE[movimiento.fase_pagare] && (
        <>
          <Dato rotulo="Medio de pago">{movimiento.medio_pago}</Dato>
          <Dato rotulo="Fase">{FASES_PAGARE[movimiento.fase_pagare].nombre}</Dato>
          <Dato rotulo="Vencimiento">{movimiento.fecha_vencimiento ? formatearFecha(movimiento.fecha_vencimiento) : ''}</Dato>
          {movimiento.fecha_negociado && <Dato rotulo="Negociado">{formatearFecha(movimiento.fecha_negociado)}</Dato>}
        </>
      )}
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
const valorDeCambio = (v: unknown) => (v === null || v === undefined || v === '' ? 'vacío' : String(v))

function fechaDelRegistro(documento: DocumentoBandeja): string {
  if ('libro' in documento) return documento.fecha_contable || documento.fecha_expedicion || ''
  return documento.fecha || ''
}

function importeDelRegistro(documento: DocumentoBandeja, tipo: TipoDocumento): number {
  return Number(esFactura(documento, tipo) ? documento.importe_total : (documento as MovimientoBandeja).importe)
}

export default function DialogoDocumento({ tipo, id, nivel, alCerrar, alCambiado }: Props) {
  const [documento, setDocumento] = useState<DocumentoBandeja | null>(null)
  // Texto de la anotación mientras se edita; nulo = sin cambios respecto a lo guardado.
  const [nota, setNota] = useState<string | null>(null)
  const [guardandoNota, setGuardandoNota] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<Decision | 'bloquear' | 'desbloquear' | null>(null)

  useEffect(() => {
    if (id === null) return
    setDocumento(null)
    setError(null)
    setNota(null)
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

  async function guardarNota() {
    if (id === null || nota === null) return
    setError(null)
    setGuardandoNota(true)
    try {
      await anotarDocumento(tipo, id, nota)
      alCambiado()
      const nuevo = await obtenerDocumento(tipo, id)
      setDocumento(nuevo)
      setNota(null)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardandoNota(false)
    }
  }

  async function revisar(si: boolean) {
    if (id === null) return
    setError(null)
    try {
      const r = await revisarDocumentos(tipo, [id], si)
      if (r.no_se_pueden.length > 0) setError(r.no_se_pueden[0].motivo)
      alCambiado()
      setDocumento(await obtenerDocumento(tipo, id))
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }

  async function bloquear(si: boolean) {
    if (id === null) return
    setError(null)
    setDecidiendo(si ? 'bloquear' : 'desbloquear')
    try {
      const r = await bloquearDocumentos(tipo, [id], si)
      if (r.no_se_pueden.length > 0) setError(r.no_se_pueden[0].motivo)
      alCambiado()
      setDocumento(await obtenerDocumento(tipo, id))
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setDecidiendo(null)
    }
  }

  const puedeDecidir = alcanza(nivel, 'apuntes')
  const estado = documento ? aspectoDeEstado(documento) : undefined
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

            {documento.bloqueado === 1 && (
              <Alert color="red">Bloqueado: no se contabiliza hasta que lo desbloquees.</Alert>
            )}

            {documento.cambio_en_origen === 1 && (
              <Alert color="orange">
                {AVISO_CAMBIADA}. El asiento no se ha tocado: si hay que corregirlo, deshaz la
                contabilización y vuelve a traerla.
                {documento.cambio_en_origen_detalle?.length ? (
                  <List size="sm" mt="xs">
                    {documento.cambio_en_origen_detalle.map((c) => (
                      <List.Item key={c.campo}>
                        {c.campo}: antes «{valorDeCambio(c.antes)}», ahora «{valorDeCambio(c.ahora)}»
                      </List.Item>
                    ))}
                  </List>
                ) : null}
              </Alert>
            )}

            {!esFactura(documento, tipo) && Number((documento as MovimientoBandeja).id_grupo) > 0 && (
              <BloqueGrupo
                movimiento={documento as MovimientoBandeja}
                puedeDeshacer={puedeDecidir}
                alDeshecho={() => {
                  alCambiado()
                  if (id !== null) obtenerDocumento(tipo, id).then(setDocumento)
                }}
              />
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

            {fechaDelRegistro(documento) && (
              <ApuntesDelDiario
                fecha={fechaDelRegistro(documento)}
                importe={importeDelRegistro(documento, tipo)}
                cuentaTercero={documento.cuenta_tercero}
                estado={documento.estado}
              />
            )}

            <Stack gap={4}>
              <Textarea
                label="Anotación"
                autosize
                minRows={2}
                maxLength={2000}
                disabled={!puedeDecidir}
                value={nota ?? documento.anotacion ?? ''}
                onChange={(e) => setNota(e.currentTarget.value)}
                description={
                  documento.anotacion && nota === null
                    ? `${documento.anotacion_por ? `${documento.anotacion_por}` : ''}${documento.anotacion_fecha ? ` · ${formatearFecha(documento.anotacion_fecha)}` : ''}`
                    : undefined
                }
              />
              {puedeDecidir && nota !== null && (
                <Group justify="flex-end">
                  <Button size="xs" variant="default" onClick={() => setNota(null)}>
                    Deshacer
                  </Button>
                  <Button size="xs" loading={guardandoNota} onClick={() => void guardarNota()}>
                    Guardar anotación
                  </Button>
                </Group>
              )}
            </Stack>

            {puedeDecidir && (
              <Checkbox
                label={
                  documento.revisado === 1
                    ? `Revisado${documento.revisado_por ? ` por ${documento.revisado_por}` : ''}${documento.revisado_fecha ? ` el ${formatearFecha(documento.revisado_fecha)}` : ''}`
                    : 'Marcar como revisado'
                }
                checked={documento.revisado === 1}
                onChange={(e) => void revisar(e.currentTarget.checked)}
              />
            )}

            {puedeDecidir && (
              <Group justify="flex-end" gap="sm">
                {documento.bloqueado === 1 ? (
                  <Button variant="default" loading={decidiendo === 'desbloquear'} onClick={() => void bloquear(false)}>
                    Desbloquear
                  </Button>
                ) : (
                  documento.estado !== 'contabilizada' &&
                  documento.estado !== 'descartada' && (
                    <Button variant="default" loading={decidiendo === 'bloquear'} onClick={() => void bloquear(true)}>
                      Bloquear
                    </Button>
                  )
                )}
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
                {documento.estado === 'posible_duplicado' && (
                  <>
                    <Button
                      variant="default"
                      loading={decidiendo === 'importada'}
                      onClick={() => void decidir('importada')}
                    >
                      No es el mismo
                    </Button>
                  </>
                )}
                {(documento.estado === 'pendiente' || documento.estado === 'en_conflicto' || documento.estado === 'posible_duplicado') && (
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

            <Group justify="flex-end">
              <Button variant="default" onClick={alCerrar}>
                Cerrar
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  )
}
