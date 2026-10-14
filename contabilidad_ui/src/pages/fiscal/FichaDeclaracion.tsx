import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Collapse,
  Group,
  List,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconArrowBackUp, IconArrowLeft, IconDownload, IconPencil } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import {
  cambiarEstado,
  descontabilizar,
  ficheroAeat,
  obtenerDeclaracion,
  quitarAjuste,
  type CasillaDeclarada,
  type FichaDeclaracion as Ficha,
} from '../../api/declaraciones'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import { guardarFichero, nombreDeFichero } from '../../lib/descarga'
import { aDecimal } from '../../lib/dinero'
import { formatearFecha, formatearImporte } from '../../lib/format'
import DatosDePartida from './DatosDePartida'
import {
  BORRADOR,
  casillasPorApartado,
  estadoDe,
  motivoSinEditar,
  pasosDeEstado,
  RESULTADOS,
  sePuedeEditar,
  type PasoDeEstado,
} from './declaracion'
import DialogoAjuste from './DialogoAjuste'
import DialogoContabilizar from './DialogoContabilizar'
import DialogoFacturasCasilla from './DialogoFacturasCasilla'
import DialogoPresentar from './DialogoPresentar'
import { nombreDePeriodo } from './periodos'

interface Props {
  idDeclaracion: number
  nivel: string
  alVolver: () => void
  /** Tras cualquier cambio: la lista de declaraciones tiene que volver a leerse. */
  alCambiada: () => void
}

const ACCIONES: Record<string, string> = {
  registrada: 'Registrada',
  actualizada: 'Recalculada',
  modificada: 'Datos de partida cambiados',
  ajuste: 'Casilla ajustada',
  quitar_ajuste: 'Ajuste quitado',
  estado: 'Cambio de estado',
  contabilizada: 'Contabilizada',
  descontabilizada: 'Contabilización deshecha',
}

/** Día y hora de un momento de la API, que llega como `aaaa-mm-ddThh:mm:ss`. */
function momento(iso: string | null | undefined): string {
  if (!iso) return ''
  const hora = iso.slice(11, 16)
  return hora ? `${formatearFecha(iso)} ${hora}` : formatearFecha(iso)
}

/** Las casillas con importe que salen de facturas se pueden abrir para ver cuáles. */
function seAbre(casilla: CasillaDeclarada): boolean {
  return casilla.apartado !== 'resultado' && !casilla.importe.isZero()
}

function Avisos({ ficha }: { ficha: Ficha }) {
  if (ficha.avisos.length === 0) return null
  const fuera = ficha.avisos.reduce((suma, aviso) => suma.plus(aviso.importe), aDecimal(0))
  // Los avisos a cero solo informan; los que dejan algo fuera dicen que no está terminada.
  const terminada = fuera.isZero()
  return (
    <Alert
      color={terminada ? 'blue' : 'yellow'}
      title={
        terminada
          ? 'Para tener en cuenta'
          : `Hay ${formatearImporte(fuera)} que no se ha podido colocar en ninguna casilla`
      }
    >
      <List size="sm" spacing={4}>
        {ficha.avisos.map((aviso, indice) => (
          <List.Item key={indice}>
            {aviso.motivo}
            {!aviso.importe.isZero() && (
              <Text span size="sm" fw={600}>
                {' '}
                ({formatearImporte(aviso.importe)} fuera)
              </Text>
            )}
          </List.Item>
        ))}
      </List>
    </Alert>
  )
}

function Importe({ casilla }: { casilla: CasillaDeclarada }) {
  if (casilla.texto) return <>{casilla.texto}</>
  return (
    <Stack gap={0} align="flex-end">
      <Text size="sm" ff="monospace" fw={casilla.ajuste ? 600 : undefined}>
        {formatearImporte(casilla.importe)}
      </Text>
      {casilla.ajuste && (
        <Text size="xs" ff="monospace" c="dimmed" td="line-through">
          {formatearImporte(casilla.importe_calculado)}
        </Text>
      )}
    </Stack>
  )
}

/**
 * La ficha de una declaración del 303, como el impreso: avisos arriba, las
 * casillas por bloques, los datos de partida, el estado, el asiento de la
 * liquidación y el historial. Cada cambio devuelve la ficha ya recalculada.
 */
export default function FichaDeclaracion({ idDeclaracion, nivel, alVolver, alCambiada }: Props) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  // `recarga` vuelve a pedir la ficha; `version` rehace el formulario de datos de partida.
  const [recarga, setRecarga] = useState(0)
  const [version, setVersion] = useState(0)
  const [ajustando, setAjustando] = useState<CasillaDeclarada | null>(null)
  const [viendo, setViendo] = useState<CasillaDeclarada | null>(null)
  const [presentando, setPresentando] = useState(false)
  const [contabilizando, setContabilizando] = useState(false)
  const [aceptarAvisos, setAceptarAvisos] = useState(false)
  const [conHistorial, setConHistorial] = useState(false)

  useEffect(() => {
    const corte = new AbortController()
    setError(null)
    obtenerDeclaracion(idDeclaracion, corte.signal)
      .then((nueva) => {
        setFicha(nueva)
        setVersion((v) => v + 1)
      })
      .catch((fallo: unknown) => {
        if (!esAbortada(fallo)) setError(textoDeError(fallo))
      })
    return () => corte.abort()
  }, [idDeclaracion, recarga])

  /** La ficha que devuelve un cambio ya es la buena: se pinta y se avisa a la lista. */
  function cambiada(nueva: Ficha) {
    setFicha(nueva)
    setVersion((v) => v + 1)
    setAjustando(null)
    setPresentando(false)
    alCambiada()
  }

  async function hacer(clave: string, accion: () => Promise<Ficha>) {
    setErrorAccion(null)
    setTrabajando(clave)
    try {
      cambiada(await accion())
    } catch (fallo) {
      setErrorAccion(textoDeError(fallo))
    } finally {
      setTrabajando(null)
    }
  }

  async function bajarFichero(ficha: Ficha) {
    setErrorAccion(null)
    setTrabajando('fichero')
    try {
      const descarga = await ficheroAeat(ficha.id, aceptarAvisos)
      guardarFichero(descarga, nombreDeFichero(`modelo303_${ficha.ejercicio}_${ficha.periodo}`, 'txt'))
    } catch (fallo) {
      setErrorAccion(textoDeError(fallo))
    } finally {
      setTrabajando(null)
    }
  }

  function pulsarPaso(paso: PasoDeEstado) {
    if (paso.pideJustificante) setPresentando(true)
    else void hacer(`estado-${paso.estado}`, () => cambiarEstado(idDeclaracion, paso.estado))
  }

  const volver = (
    <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={alVolver} w="fit-content">
      Volver a la lista
    </Button>
  )

  if (error !== null) {
    return (
      <Stack gap="md">
        {volver}
        <Alert color="red" role="alert" title="No se pudo abrir la declaración">
          {error}
        </Alert>
      </Stack>
    )
  }
  if (ficha === null) {
    return (
      <Stack gap="md">
        {volver}
        <Loader size="sm" />
      </Stack>
    )
  }

  const puedeApuntar = alcanza(nivel, 'apuntes')
  const editable = puedeApuntar && sePuedeEditar(ficha.estado, ficha.contabilizada)
  const sinEditar = motivoSinEditar(ficha.estado, ficha.contabilizada)
  const pasos = puedeApuntar ? pasosDeEstado(ficha.estado, ficha.contabilizada) : []
  const estado = estadoDe(ficha.estado)
  const conFacturasFuera = ficha.avisos.some((aviso) => !aviso.importe.isZero())

  return (
    <Stack gap="lg">
      {volver}

      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="sm">
            <Title order={3}>
              Modelo 303 · {nombreDePeriodo(ficha.periodo)} de {ficha.ejercicio}
            </Title>
            <Badge color={estado.color} variant="light">
              {estado.texto}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            Calculada el {momento(ficha.fecha_calculo)}
            {ficha.fecha_presentacion &&
              ` · presentada el ${formatearFecha(ficha.fecha_presentacion)}, justificante ${ficha.justificante ?? ''}`}
          </Text>
        </Stack>
        <Paper withBorder p="sm">
          <Text size="xs" c="dimmed">
            {RESULTADOS[ficha.tipo_resultado] ?? ficha.tipo_resultado}
          </Text>
          <Text size="xl" fw={700} ff="monospace">
            {formatearImporte(ficha.resultado)}
          </Text>
        </Paper>
      </Group>

      <Avisos ficha={ficha} />

      {errorAccion && (
        <Alert color="red" role="alert" withCloseButton onClose={() => setErrorAccion(null)}>
          {errorAccion}
        </Alert>
      )}

      {puedeApuntar && sinEditar && (
        <Text size="sm" c="dimmed">
          {sinEditar}
        </Text>
      )}

      <Group gap="sm">
        {pasos.map((paso) => (
          <Button
            key={paso.estado}
            variant={paso.estado > ficha.estado ? 'filled' : 'default'}
            loading={trabajando === `estado-${paso.estado}`}
            onClick={() => pulsarPaso(paso)}
          >
            {paso.texto}
          </Button>
        ))}
        <Button
          variant="default"
          leftSection={<IconDownload size={16} />}
          loading={trabajando === 'fichero'}
          onClick={() => void bajarFichero(ficha)}
        >
          Fichero para la AEAT
        </Button>
        {conFacturasFuera && (
          <Checkbox
            label="Sacarlo aunque queden facturas fuera"
            checked={aceptarAvisos}
            onChange={(e) => setAceptarAvisos(e.currentTarget.checked)}
          />
        )}
      </Group>

      {casillasPorApartado(ficha.casillas).map((apartado) => (
        <Stack key={apartado.clave} gap="xs">
          <Title order={5}>{apartado.titulo}</Title>
          <Table fz="sm" striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={80}>Casilla</Table.Th>
                <Table.Th>Descripción</Table.Th>
                <Table.Th ta="right" w={160}>
                  Importe
                </Table.Th>
                {editable && <Table.Th w={70} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {apartado.casillas.map((casilla) => (
                <Table.Tr
                  key={casilla.casilla}
                  onClick={seAbre(casilla) ? () => setViendo(casilla) : undefined}
                  style={seAbre(casilla) ? { cursor: 'pointer' } : undefined}
                >
                  <Table.Td ff="monospace">[{casilla.casilla}]</Table.Td>
                  <Table.Td>
                    {casilla.descripcion}
                    {casilla.ajuste && (
                      <Text size="xs" c="orange.8">
                        Ajustada a mano por {casilla.ajuste.usuario} el {momento(casilla.ajuste.fecha)}:{' '}
                        {casilla.ajuste.motivo}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Importe casilla={casilla} />
                  </Table.Td>
                  {editable && (
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      {casilla.ajustable && (
                        <Group gap={4} wrap="nowrap" justify="flex-end">
                          <Tooltip label="Ajustar a mano">
                            <ActionIcon
                              variant="subtle"
                              aria-label={`Ajustar la casilla ${casilla.casilla}`}
                              onClick={() => setAjustando(casilla)}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {casilla.ajuste && (
                            <Tooltip label="Quitar el ajuste y volver a lo calculado">
                              <ActionIcon
                                variant="subtle"
                                color="orange"
                                aria-label={`Quitar el ajuste de la casilla ${casilla.casilla}`}
                                loading={trabajando === `quitar-${casilla.casilla}`}
                                onClick={() =>
                                  void hacer(`quitar-${casilla.casilla}`, () =>
                                    quitarAjuste(ficha.id, casilla.casilla),
                                  )
                                }
                              >
                                <IconArrowBackUp size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ))}
      <Text size="xs" c="dimmed">
        Pulsa una casilla con importe para ver las facturas que la forman.
      </Text>

      <DatosDePartida key={version} ficha={ficha} editable={editable} alHecho={cambiada} />

      <Stack gap="xs">
        <Title order={5}>Contabilización</Title>
        {ficha.contabilizada ? (
          <>
            <Text size="sm">
              Asiento {ficha.asiento} del ejercicio {ficha.ejercicio_asiento}.{' '}
              {ficha.asiento_confirmado
                ? 'Ya está en el libro: para corregirlo hay que hacer otro asiento.'
                : 'Está en borradores, pendiente de revisar y confirmar.'}
            </Text>
            {puedeApuntar && ficha.asiento_confirmado === false && (
              <Button
                variant="default"
                w="fit-content"
                loading={trabajando === 'descontabilizar'}
                onClick={() => void hacer('descontabilizar', () => descontabilizar(ficha.id))}
              >
                Deshacer la contabilización
              </Button>
            )}
          </>
        ) : ficha.tipo_resultado === 'sin_actividad' ? (
          <Text size="sm" c="dimmed">
            Sin actividad: no hay nada que contabilizar.
          </Text>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Todavía no está contabilizada.
              {ficha.estado === BORRADOR && ' Puedes ver cómo quedaría el asiento antes de registrarla.'}
            </Text>
            {puedeApuntar && (
              <Button variant="default" w="fit-content" onClick={() => setContabilizando(true)}>
                Contabilizar
              </Button>
            )}
          </>
        )}
      </Stack>

      <Stack gap="xs">
        <Button
          variant="subtle"
          w="fit-content"
          onClick={() => setConHistorial((v) => !v)}
          aria-expanded={conHistorial}
        >
          {conHistorial ? 'Ocultar el historial' : `Ver el historial (${ficha.historial.length})`}
        </Button>
        <Collapse in={conHistorial}>
          <Table fz="sm" striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cuándo</Table.Th>
                <Table.Th>Quién</Table.Th>
                <Table.Th>Qué</Table.Th>
                <Table.Th>Detalle</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ficha.historial.map((linea, indice) => (
                <Table.Tr key={indice}>
                  <Table.Td>{momento(linea.fecha)}</Table.Td>
                  <Table.Td>{linea.usuario}</Table.Td>
                  <Table.Td>{ACCIONES[linea.accion] ?? linea.accion}</Table.Td>
                  <Table.Td>{linea.detalle}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Collapse>
      </Stack>

      <DialogoAjuste
        idDeclaracion={ficha.id}
        casilla={ajustando}
        alCerrar={() => setAjustando(null)}
        alHecho={cambiada}
      />
      <DialogoFacturasCasilla idDeclaracion={ficha.id} casilla={viendo} alCerrar={() => setViendo(null)} />
      <DialogoPresentar
        abierto={presentando}
        idDeclaracion={ficha.id}
        alCerrar={() => setPresentando(false)}
        alHecho={cambiada}
      />
      <DialogoContabilizar
        abierto={contabilizando}
        idDeclaracion={ficha.id}
        registrada={ficha.estado !== BORRADOR}
        alCerrar={() => setContabilizando(false)}
        alHecho={() => {
          setRecarga((v) => v + 1)
          alCambiada()
        }}
      />
    </Stack>
  )
}
