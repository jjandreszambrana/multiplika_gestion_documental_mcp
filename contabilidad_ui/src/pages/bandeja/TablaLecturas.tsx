import { Alert, Badge, Button, Group, List, Loader, Modal, Stack, Table, Text, Tooltip } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import {
  deshacerExportacion,
  deshacerLectura,
  listarLecturas,
  type Lectura,
  type ResultadoDeshacerExportacion,
} from '../../api/bandeja'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import { formatearEntero, formatearFecha } from '../../lib/format'
import DialogoConfirmar from '../traspasos/DialogoConfirmar'

interface Props {
  nivel: string
  /** Cambia cuando se trae algo de Codiplika, para volver a leer. */
  refresco: number
  /** Tras deshacer: el padre cambia `refresco` y se vuelve a leer todo. */
  alDeshecha: () => void
}

/** «Codiplika», no «codiplika»: el origen se guarda en minúsculas. */
function nombreDeOrigen(origen: string): string {
  return origen.charAt(0).toUpperCase() + origen.slice(1)
}

/** Fecha y hora de la lectura, que llega como `aaaa-mm-ddThh:mm:ss`. */
function cuando(fecha: string | null | undefined): string {
  if (!fecha) return ''
  return `${formatearFecha(fecha)} ${fecha.slice(11, 16)}`.trim()
}

/**
 * Deshacer una exportación: primero se pregunta qué pasaría y se enseña, y
 * solo después se hace. Lo que tenga el asiento confirmado se queda.
 */
function DialogoDeshacerExportacion({
  lectura,
  alCerrar,
  alHecho,
}: {
  lectura: Lectura | null
  alCerrar: () => void
  alHecho: () => void
}) {
  const [ensayo, setEnsayo] = useState<ResultadoDeshacerExportacion | null>(null)
  const [hecho, setHecho] = useState<ResultadoDeshacerExportacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (lectura === null) return
    setEnsayo(null)
    setHecho(null)
    setError(null)
    deshacerExportacion(lectura.id, true)
      .then(setEnsayo)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [lectura])

  async function deshacer() {
    if (lectura === null) return
    setError(null)
    setTrabajando(true)
    try {
      setHecho(await deshacerExportacion(lectura.id, false))
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  const resumen = hecho ?? ensayo

  return (
    <Modal opened={lectura !== null} onClose={alCerrar} title="Deshacer la exportación" size="lg" centered>
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        {!resumen && !error && <Loader size="sm" />}

        {resumen && (
          <>
            <Text size="sm">
              {hecho
                ? `Hecho. Han salido de la bandeja ${formatearEntero(hecho.se_deshacen)} documentos y ${formatearEntero(hecho.devueltos_en_origen)} han vuelto a estar pendientes de exportar en Codiplika.`
                : `Saldrán de la bandeja ${formatearEntero(resumen.se_deshacen)} documentos de la exportación ${resumen.exportacion}, con su borrador si lo tenían, y en Codiplika volverán a estar pendientes de exportar.`}
            </Text>
            {resumen.se_quedan > 0 && (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  {hecho ? 'Se han quedado' : 'Se quedan'} {formatearEntero(resumen.se_quedan)}, y en
                  Codiplika siguen marcados:
                </Text>
                <List size="sm">
                  {resumen.documentos_que_se_quedan.map((documento) => (
                    <List.Item key={`${documento.tipo}.${documento.id}`}>
                      {documento.tipo === 'facturas' ? 'Factura' : 'Cobro o pago'}{' '}
                      {documento.id_origen}: {documento.motivo}
                    </List.Item>
                  ))}
                </List>
              </Stack>
            )}
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            {hecho ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!hecho && (
            <Button
              color="red"
              onClick={() => void deshacer()}
              loading={trabajando}
              disabled={!ensayo || ensayo.se_deshacen === 0}
            >
              Deshacer
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}

/**
 * Cada vez que se ha traído algo de Codiplika, con lo que trajo. Deshacer una
 * lectura quita de la bandeja lo que no tiene asiento; deshacer la exportación,
 * además, lo devuelve a pendiente en Codiplika para volver a traerlo.
 */
export default function TablaLecturas({ nivel, refresco, alDeshecha }: Props) {
  const [lecturas, setLecturas] = useState<Lectura[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [quitando, setQuitando] = useState<Lectura | null>(null)
  const [devolviendo, setDevolviendo] = useState<Lectura | null>(null)

  const traer = useCallback(() => {
    listarLecturas()
      .then((lista) => {
        setLecturas(lista)
        setError(null)
      })
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
    // `refresco` no se usa dentro: está para volver a leer tras traer o deshacer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresco])

  useEffect(traer, [traer])

  if (error) {
    return (
      <Alert color="red" title="No se pudieron cargar las lecturas" role="alert">
        {error}
      </Alert>
    )
  }

  if (lecturas === null) return <Loader size="xs" />

  const puedeDeshacer = alcanza(nivel, 'apuntes')

  return (
    <Stack gap="sm">
      {aviso && (
        <Alert color="blue" withCloseButton onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}

      <Table.ScrollContainer minWidth={1000} h="60vh" type="native">
        <Table withTableBorder striped fz="sm" stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={140}>Cuándo</Table.Th>
              <Table.Th w={110}>De</Table.Th>
              <Table.Th w={190}>Fechas</Table.Th>
              <Table.Th>Qué trajo</Table.Th>
              <Table.Th w={110}>Problemas</Table.Th>
              {puedeDeshacer && <Table.Th w={290} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lecturas.map((lectura) => {
              const deshecha = lectura.estado === 'deshecha'
              return (
                <Table.Tr key={lectura.id} c={deshecha ? 'dimmed' : undefined}>
                  <Table.Td>
                    {cuando(lectura.fecha_alta)}
                    <Text fz="xs" c="dimmed">
                      {lectura.usuario ?? ''}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {nombreDeOrigen(lectura.origen)}
                    {lectura.referencia_origen && (
                      <Text fz="xs" c="dimmed">
                        Exportación {lectura.referencia_origen}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {lectura.desde || lectura.hasta
                      ? `${formatearFecha(lectura.desde)} – ${formatearFecha(lectura.hasta)}`
                      : ''}
                  </Table.Td>
                  <Table.Td>
                    {formatearEntero(lectura.leidas)} leídos: {formatearEntero(lectura.nuevas)} nuevos,{' '}
                    {formatearEntero(lectura.actualizadas)} con cambios,{' '}
                    {formatearEntero(lectura.sin_cambios)} iguales
                    {(lectura.duplicadas > 0 || lectura.en_conflicto > 0) && (
                      <Text fz="xs" c="dimmed">
                        {formatearEntero(lectura.duplicadas)} ya en la facturación ·{' '}
                        {formatearEntero(lectura.en_conflicto)} no coinciden con ella
                      </Text>
                    )}
                    {deshecha && (
                      <Badge color="gray" variant="light" mt={4}>
                        Deshecha
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {lectura.incidencias.length === 0 ? (
                      ''
                    ) : (
                      <Tooltip
                        withArrow
                        multiline
                        maw={360}
                        label={lectura.incidencias
                          .map((i) => `${i.id_origen}: ${i.faltas.join(', ')}`)
                          .join(' · ')}
                      >
                        <Badge color="orange" variant="light">
                          {formatearEntero(lectura.incidencias.length)} sin traer
                        </Badge>
                      </Tooltip>
                    )}
                  </Table.Td>
                  {puedeDeshacer && (
                    <Table.Td>
                      {!deshecha && (
                        <Group gap="xs" wrap="nowrap">
                          <Button size="compact-sm" variant="default" onClick={() => setQuitando(lectura)}>
                            Deshacer lectura
                          </Button>
                          {lectura.referencia_origen && (
                            <Button
                              size="compact-sm"
                              variant="default"
                              color="red"
                              onClick={() => setDevolviendo(lectura)}
                            >
                              Deshacer exportación
                            </Button>
                          )}
                        </Group>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {lecturas.length === 0 && (
        <Text size="sm" c="dimmed">
          Todavía no se ha traído nada de Codiplika.
        </Text>
      )}

      <DialogoConfirmar
        abierto={quitando !== null}
        titulo="Deshacer la lectura"
        texto="Lo que trajo esta lectura y no tiene asiento sale de la bandeja. Lo contabilizado se queda: para quitarlo, primero deshaz su contabilización. En Codiplika no cambia nada."
        rotulo="Deshacer"
        alCerrar={() => setQuitando(null)}
        alConfirmar={async () => {
          if (quitando === null) return
          const hecho = await deshacerLectura(quitando.id)
          setQuitando(null)
          setAviso(
            `Han salido de la bandeja ${formatearEntero(hecho.quitados)} documentos.` +
              (hecho.se_quedan > 0
                ? ` Se quedan ${formatearEntero(hecho.se_quedan)} porque ya están contabilizados.`
                : ''),
          )
          alDeshecha()
        }}
      />

      <DialogoDeshacerExportacion
        lectura={devolviendo}
        alCerrar={() => setDevolviendo(null)}
        alHecho={alDeshecha}
      />
    </Stack>
  )
}
