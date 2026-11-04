import { ActionIcon, Alert, Badge, Button, Divider, Group, Loader, Modal, Select, Stack, Table, Text, Title } from '@mantine/core'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  anularInforme,
  cambiarEstado,
  CODIGO_ENTREGADO,
  descargarInforme,
  editarMuestra,
  eliminarLinea,
  eliminarMuestra,
  emitirInforme,
  informeVigente,
  listarCatalogo,
  obtenerMuestra,
  type LineaResultado,
} from '../../api/laboratorio'
import { guardarFichero, nombreDeFichero } from '../../lib/descarga'
import { formatearFecha } from '../../lib/format'
import { fechaHora, importeLab, useCarga } from './comun'
import Confirmar from './Confirmar'
import DialogoLinea from './DialogoLinea'
import FormularioMuestra from './FormularioMuestra'

interface Props {
  id: number
  alCerrar: () => void
  /** Algo ha cambiado: el listado se vuelve a leer. */
  alCambiar: () => void
}

type Dialogo =
  | { tipo: 'editar' }
  | { tipo: 'eliminar' }
  | { tipo: 'anular'; idInforme: number }
  | { tipo: 'linea'; linea: LineaResultado | null }
  | { tipo: 'quitar_linea'; linea: LineaResultado }

/** La ficha de una muestra: datos, resultados, informe y el recorrido de sus estados. */
export default function FichaMuestra({ id, alCerrar, alCambiar }: Props) {
  const carga = useCarga(() => obtenerMuestra(id), [id])
  const estados = useCarga(() => listarCatalogo('estados'), [])
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const m = carga.datos
  const vigente = m ? informeVigente(m) : undefined

  /** Hace algo, lo enseña si falla y, si sale bien, vuelve a leer la muestra y el listado. */
  async function hacer(accion: () => Promise<unknown>) {
    setTrabajando(true)
    setError(null)
    try {
      await accion()
      carga.recargar()
      alCambiar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  async function verPdf(idInforme: number) {
    // La pestaña se abre antes de pedir el fichero: después de esperar, el navegador la bloquearía.
    const pestana = window.open('about:blank', '_blank')
    try {
      const pdf = await descargarInforme(idInforme)
      if (pestana) pestana.location.href = URL.createObjectURL(pdf.contenido)
      else guardarFichero(pdf, nombreDeFichero(`informe_${m?.numero_entrada ?? idInforme}`, 'pdf'))
    } catch (fallo) {
      pestana?.close()
      setError(textoDeError(fallo))
    }
  }

  const cierra = () => setDialogo(null)
  const recargarTras = (fn?: () => void) => () => {
    fn?.()
    cierra()
    carga.recargar()
    alCambiar()
  }

  return (
    <Modal opened onClose={alCerrar} size="90%" title={m ? `Muestra ${m.numero_entrada}` : 'Muestra'}>
      {carga.cargando && !m && <Loader size="sm" />}
      {carga.error && <Alert color="red">{carga.error}</Alert>}
      {m && (
        <Stack gap="md">
          {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}

          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Title order={4}>{m.cliente_nombre || 'Sin cliente'}</Title>
              <Text size="sm" c="dimmed">
                {[m.referencia, m.punto_toma, m.fecha_toma && `toma ${formatearFecha(m.fecha_toma)}`].filter(Boolean).join(' · ')}
              </Text>
              {m.normativa && <Text size="sm">{m.normativa}</Text>}
              {m.observaciones && <Text size="sm">{m.observaciones}</Text>}
              {m.importe_neto !== null && m.importe_neto !== '' && <Text size="sm">{`Importe: ${importeLab(m.importe_neto)}`}</Text>}
              {m.id_borrador && <Badge variant="light" color="teal">En un borrador de factura</Badge>}
              {m.oculto ? <Badge color="gray">Oculta</Badge> : null}
            </Stack>
            <Group gap="xs">
              <Select
                aria-label="Estado de la muestra"
                data={(estados.datos ?? []).map((e) => ({ value: String(e.codigo), label: String(e.denominacion) }))}
                value={String((estados.datos ?? []).find((e) => e.id === m.id_estado)?.codigo ?? '')}
                onChange={(codigo) => codigo && void hacer(() => cambiarEstado(m.id, Number(codigo)))}
                allowDeselect={false}
                w={170}
                disabled={trabajando}
              />
              <Button variant="default" onClick={() => setDialogo({ tipo: 'editar' })} disabled={!!vigente}>
                Editar datos
              </Button>
              <Button
                variant="default"
                onClick={() => void hacer(() => editarMuestra(m.id, { oculto: m.oculto ? 0 : 1 }))}
                disabled={!!vigente || trabajando}
              >
                {m.oculto ? 'Mostrar' : 'Ocultar'}
              </Button>
              <Button color="red" variant="light" onClick={() => setDialogo({ tipo: 'eliminar' })}>
                Eliminar
              </Button>
            </Group>
          </Group>
          {vigente && (
            <Text size="sm" c="dimmed">
              Tiene un informe emitido: para cambiar los datos o los resultados, anúlalo primero.
            </Text>
          )}

          <Divider label="Resultados" labelPosition="left" />
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Grupo</Table.Th>
                <Table.Th>Parámetro</Table.Th>
                <Table.Th>Resultado</Table.Th>
                <Table.Th>Unidad</Table.Th>
                <Table.Th>Método</Table.Th>
                <Table.Th>Límite</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {m.lineas.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{l.grupo}</Table.Td>
                  <Table.Td>{l.parametro}</Table.Td>
                  <Table.Td c={l.valoracion === 'no_cumple' ? 'red' : undefined} fw={l.valoracion === 'no_cumple' ? 700 : undefined}>
                    {l.resultado}
                    {l.marca ? ` ${l.marca}` : ''}
                    {l.valoracion === 'no_cumple' && ' (no cumple)'}
                  </Table.Td>
                  <Table.Td>{l.unidad}</Table.Td>
                  <Table.Td>{l.metodo}</Table.Td>
                  <Table.Td>{l.limite}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" aria-label="Editar el resultado" disabled={!!vigente} onClick={() => setDialogo({ tipo: 'linea', linea: l })}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" aria-label="Quitar el resultado" disabled={!!vigente} onClick={() => setDialogo({ tipo: 'quitar_linea', linea: l })}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {m.lineas.length === 0 && <Text c="dimmed">Todavía no hay resultados.</Text>}
          <Group>
            <Button variant="light" onClick={() => setDialogo({ tipo: 'linea', linea: null })} disabled={!!vigente}>
              Añadir resultado
            </Button>
          </Group>

          <Divider label="Informe" labelPosition="left" />
          <Group>
            {vigente ? (
              <>
                <Button onClick={() => void verPdf(vigente.id)}>Ver el PDF</Button>
                <Button color="red" variant="light" onClick={() => setDialogo({ tipo: 'anular', idInforme: vigente.id })}>
                  Anular el informe
                </Button>
                {m.id_estado !== estados.datos?.find((e) => e.codigo === CODIGO_ENTREGADO)?.id && (
                  <Button variant="light" color="teal" disabled={trabajando} onClick={() => void hacer(() => cambiarEstado(m.id, CODIGO_ENTREGADO))}>
                    Pasar a entregado
                  </Button>
                )}
              </>
            ) : (
              <Button disabled={m.lineas.length === 0 || trabajando} onClick={() => void hacer(() => emitirInforme(m.id))}>
                Emitir el informe
              </Button>
            )}
          </Group>
          {m.informes.length > 0 && (
            <Table>
              <Table.Tbody>
                {m.informes.map((i) => (
                  <Table.Tr key={i.id}>
                    <Table.Td>{`Versión ${i.version}`}</Table.Td>
                    <Table.Td>{fechaHora(i.fecha_emision)}</Table.Td>
                    <Table.Td>{i.anulado ? <Badge color="gray">{`Anulado: ${i.motivo_anulacion ?? ''}`}</Badge> : <Badge color="teal">Vigente</Badge>}</Table.Td>
                    <Table.Td>
                      {i.anulado ? (
                        <Button size="compact-xs" variant="subtle" onClick={() => void verPdf(i.id)}>
                          Ver el PDF
                        </Button>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          <Divider label="Historial de estados" labelPosition="left" />
          <Table>
            <Table.Tbody>
              {m.estados.map((e, n) => (
                <Table.Tr key={n}>
                  <Table.Td>{fechaHora(e.fecha)}</Table.Td>
                  <Table.Td>{e.estado}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}

      {m && dialogo?.tipo === 'editar' && <FormularioMuestra muestra={m} alCerrar={cierra} alGuardada={recargarTras()} />}
      {m && dialogo?.tipo === 'linea' && (
        <DialogoLinea idMuestra={m.id} linea={dialogo.linea} alCerrar={cierra} alGuardada={recargarTras()} />
      )}
      {dialogo?.tipo === 'quitar_linea' && (
        <Confirmar
          titulo="Quitar el resultado"
          texto={`Se quitará «${dialogo.linea.parametro}» de la muestra.`}
          etiqueta="Quitar"
          alConfirmar={async () => {
            await eliminarLinea(dialogo.linea.id)
            recargarTras()()
          }}
          alCerrar={cierra}
        />
      )}
      {dialogo?.tipo === 'anular' && (
        <Confirmar
          titulo="Anular el informe"
          texto="El informe anulado se conserva, pero ya no vale. Después podrás corregir la muestra y emitir otro."
          etiqueta="Anular"
          pideMotivo
          alConfirmar={async (motivo) => {
            await anularInforme(dialogo.idInforme, motivo)
            recargarTras()()
          }}
          alCerrar={cierra}
        />
      )}
      {m && dialogo?.tipo === 'eliminar' && (
        <Confirmar
          titulo="Eliminar la muestra"
          texto="Se borra del todo. Si ya tiene informes o está facturada no se podrá: entonces, ocúltala."
          etiqueta="Eliminar"
          alConfirmar={async () => {
            await eliminarMuestra(m.id)
            alCambiar()
            alCerrar()
          }}
          alCerrar={cierra}
        />
      )}
    </Modal>
  )
}
