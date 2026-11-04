import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import {
  bloquearDocumentos,
  contabilizarBandeja,
  deshacerContabilizacion,
  FACTURAS,
  listarBandeja,
  type DocumentoBandeja,
  type ListaBandeja as Lista,
  type MovimientoBandeja,
  type ResultadoContabilizar,
  type ResultadoDeshacer,
  type TipoDocumento,
} from '../../api/bandeja'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import ModalMayor from '../informes/ModalMayor'
import { aDecimal } from '../../lib/dinero'
import { formatearEntero, formatearFecha, formatearImporte } from '../../lib/format'
import DialogoConfirmar from '../traspasos/DialogoConfirmar'
import { comoSeLlama, MESES, TODO_EL_EJERCICIO } from '../traspasos/meses'
import DialogoCotejo from './DialogoCotejo'
import DialogoDocumento from './DialogoDocumento'
import ResumenBandeja from './ResumenBandeja'
import {
  AVISO_CAMBIADA,
  cuantosDocumentos,
  ESTADOS,
  aspectoDeEstado,
  EXPLICACION_ESTADO,
  FASES_PAGARE,
  esFactura,
  LIBROS,
} from './textos'

interface Props {
  tipo: TipoDocumento
  ejercicio: number
  nivel: string
  /** Cambia cuando se trae algo de Codiplika, para volver a leer. */
  refresco: number
  alVerBorradores: () => void
}

const POR_PAGINA = 100
const ESPERA_TECLEO_MS = 300
const TODOS = ''

/** Fecha, número, tercero e importe de una fila, sea factura o movimiento. */
function columnas(documento: DocumentoBandeja, tipo: TipoDocumento) {
  if (esFactura(documento, tipo)) {
    return {
      fecha: documento.fecha_expedicion,
      numero: documento.numero_factura,
      detalle: documento.libro === 'emitida' ? 'Emitida' : 'Recibida',
      importe: documento.importe_total,
    }
  }
  const movimiento = documento as MovimientoBandeja
  return {
    fecha: movimiento.fecha,
    numero: movimiento.numero_factura ?? '',
    detalle: [movimiento.clase === 'cobro' ? 'Cobro' : 'Pago', movimiento.concepto]
      .filter(Boolean)
      .join(' · '),
    importe: movimiento.importe,
  }
}

/**
 * Las facturas, o los cobros y pagos, que hay en la bandeja, con su estado.
 *
 * Contabilizar no confirma nada: cada documento entra como borrador y se
 * confirma en el diario. Lo que se elige con las casillas es para
 * contabilizar o deshacer de golpe; el resto se decide en el detalle.
 */
export default function ListaBandeja({ tipo, ejercicio, nivel, refresco, alVerBorradores }: Props) {
  const plan = usePlanEnMemoria()
  const [estado, setEstado] = useState(TODOS)
  const [libro, setLibro] = useState(TODOS)
  const [periodo, setPeriodo] = useState(TODO_EL_EJERCICIO)
  const [soloBloqueados, setSoloBloqueados] = useState('')
  const [bloqueados, setBloqueados] = useState(0)
  const [revision, setRevision] = useState('')
  const [fasePagare, setFasePagare] = useState('')
  const [mayor, setMayor] = useState('')
  const [cuentaTexto, setCuentaTexto] = useState('')
  const [cuenta] = useDebouncedValue(cuentaTexto, ESPERA_TECLEO_MS)
  const [importeDesde, setImporteDesde] = useState('')
  const [importeHasta, setImporteHasta] = useState('')
  const [importes] = useDebouncedValue(`${importeDesde}|${importeHasta}`, 400)
  const [desdeImporte, hastaImporte] = importes.split('|')
  const [revisados, setRevisados] = useState(0)
  const [notas, setNotas] = useState('')
  const [conNotas, setConNotas] = useState(0)
  const [texto, setTexto] = useState('')
  const [buscar] = useDebouncedValue(texto, ESPERA_TECLEO_MS)
  const [pagina, setPagina] = useState(1)

  const [lista, setLista] = useState<Lista | null>(null)
  // Los contadores de los estados salen sin el filtro de estado: con él
  // puesto, el servidor solo cuenta el elegido.
  const [porEstado, setPorEstado] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)

  const [elegidos, setElegidos] = useState<Set<number>>(new Set())
  const [abierto, setAbierto] = useState<number | null>(null)
  const [preguntando, setPreguntando] = useState<'elegidos' | 'periodo' | 'deshacer' | 'agrupar' | null>(null)
  const [contabilizado, setContabilizado] = useState<ResultadoContabilizar | null>(null)
  const [deshecho, setDeshecho] = useState<ResultadoDeshacer | null>(null)

  // Cualquier cambio de filtro vuelve a la primera página y olvida lo elegido.
  useEffect(() => {
    setPagina(1)
    setElegidos(new Set())
  }, [estado, libro, periodo, buscar, soloBloqueados, revision, fasePagare, cuenta, notas, importes, refresco])

  useEffect(() => {
    const control = new AbortController()
    const filtro = { tipo, ejercicio, estado, libro, periodo, buscar, bloqueado: soloBloqueados, fasePagare, cuenta, revisado: revision, conAnotacion: notas, importeDesde: desdeImporte, importeHasta: hastaImporte, pagina, porPagina: POR_PAGINA }
    setCargando(true)
    Promise.all([
      listarBandeja(filtro, control.signal),
      estado === TODOS
        ? null
        : listarBandeja({ ...filtro, estado: TODOS, pagina: 1, porPagina: 1 }, control.signal),
    ])
      .then(([pedida, sinEstado]) => {
        setLista(pedida)
        setPorEstado((sinEstado ?? pedida).por_estado)
        setBloqueados(pedida.bloqueados)
        setRevisados(pedida.revisados)
        setConNotas(pedida.con_anotacion)
        setError(null)
        setCargando(false)
      })
      .catch((fallo: unknown) => {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setCargando(false)
      })
    return () => control.abort()
  }, [tipo, ejercicio, estado, libro, periodo, buscar, soloBloqueados, revision, fasePagare, cuenta, notas, importes, pagina, refresco, recarga])

  const puedeApuntar = alcanza(nivel, 'apuntes')
  const documentos = lista?.documentos ?? []
  const paginas = lista ? Math.max(1, Math.ceil(lista.total / POR_PAGINA)) : 1
  const totalSinEstado = Object.values(porEstado).reduce((suma, n) => suma + n, 0)
  const pendientesDelPeriodo = porEstado.pendiente ?? 0
  // Contabilizar el mes no entiende de tipo ni de búsqueda: con esos filtros
  // puestos, el recuento de la pantalla no es lo que va a entrar.
  const filtroParcial = libro !== TODOS || buscar.trim() !== '' || importes !== '|'
  // Solo se puede elegir lo que está por contabilizar: lo demás no entra.
  const elegibles = documentos.filter((d) => d.estado === 'pendiente')
  const sumaElegidos = documentos
    .filter((d) => elegidos.has(d.id))
    .reduce((suma, d) => suma.plus(aDecimal(columnas(d, tipo).importe)), aDecimal(0))
  const primero = documentos.find((d) => elegidos.has(d.id)) as MovimientoBandeja | undefined
  const cuentaDeLoElegido = primero?.cuenta_tesoreria ?? ''
  const todosElegidos = elegibles.length > 0 && elegibles.every((d) => elegidos.has(d.id))

  function elegir(id: number, si: boolean) {
    setElegidos((antes) => {
      const despues = new Set(antes)
      if (si) despues.add(id)
      else despues.delete(id)
      return despues
    })
  }

  /** Tras contabilizar o deshacer: se lee otra vez y se olvida lo elegido. */
  function volverALeer() {
    setElegidos(new Set())
    setRecarga((n) => n + 1)
  }

  async function bloquear(si: boolean) {
    setError(null)
    try {
      const r = await bloquearDocumentos(tipo, [...elegidos], si)
      if (r.no_se_pueden.length > 0) setError(`No se han podido ${si ? 'bloquear' : 'desbloquear'} ${r.no_se_pueden.length}: ${r.no_se_pueden[0].motivo}`)
      volverALeer()
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }

  async function contabilizar(cuales: { ids: number[] } | { ejercicio: number; periodo: string }) {
    setDeshecho(null)
    const resultado = await contabilizarBandeja(tipo, cuales)
    setContabilizado(resultado)
    // Las cuentas nuevas tienen que salir con su nombre aquí y en el diario.
    if ((resultado.cuentas_creadas ?? []).length > 0) plan.refrescar()
    setPreguntando(null)
    volverALeer()
  }

  const opcionesEstado = [
    { value: TODOS, label: `Todos (${formatearEntero(totalSinEstado)})` },
    ...Object.entries(ESTADOS).map(([valor, { nombre }]) => ({
      value: valor,
      label: `${nombre} (${formatearEntero(porEstado[valor] ?? 0)})`,
    })),
  ]

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="md">
        <Select
          label="Estado"
          data={opcionesEstado}
          value={estado}
          onChange={(valor) => setEstado(valor ?? TODOS)}
          allowDeselect={false}
          w={300}
        />
        <Select
          label={tipo === FACTURAS ? 'Facturas' : 'Tipo'}
          data={LIBROS[tipo]}
          value={libro}
          onChange={(valor) => setLibro(valor ?? TODOS)}
          allowDeselect={false}
          w={200}
        />
        <Select
          label="Periodo"
          data={MESES}
          value={periodo}
          onChange={(valor) => setPeriodo(valor ?? TODO_EL_EJERCICIO)}
          allowDeselect={false}
          w={180}
        />
        <Select
          label="Bloqueo"
          data={[
            { value: '', label: 'Todos' },
            { value: '1', label: `Solo bloqueados (${formatearEntero(bloqueados)})` },
            { value: '0', label: 'Sin los bloqueados' },
          ]}
          value={soloBloqueados}
          onChange={(valor) => setSoloBloqueados(valor ?? '')}
          allowDeselect={false}
          w={200}
        />
        {tipo !== FACTURAS && (
          <Select
            label="Pagarés y confirming"
            data={[
              { value: '', label: 'Todos los cobros y pagos' },
              ...Object.entries(FASES_PAGARE).map(([valor, f]) => ({ value: valor, label: f.nombre })),
            ]}
            value={fasePagare}
            onChange={(valor) => setFasePagare(valor ?? '')}
            allowDeselect={false}
            w={220}
          />
        )}
        <Select
          label="Revisión"
          data={[
            { value: '', label: 'Todos' },
            { value: '1', label: `Revisados (${formatearEntero(revisados)})` },
            { value: '0', label: 'Sin revisar' },
          ]}
          value={revision}
          onChange={(valor) => setRevision(valor ?? '')}
          allowDeselect={false}
          w={190}
        />
        <Select
          label="Anotaciones"
          data={[
            { value: '', label: 'Todos' },
            { value: '1', label: `Con anotación (${formatearEntero(conNotas)})` },
            { value: '0', label: 'Sin anotación' },
          ]}
          value={notas}
          onChange={(valor) => setNotas(valor ?? '')}
          allowDeselect={false}
          w={200}
        />
        <TextInput label="Cuenta" placeholder="430000581" inputMode="numeric" value={cuentaTexto} onChange={(e) => setCuentaTexto(e.currentTarget.value)} w={140} />
        <TextInput label="Importe desde" inputMode="decimal" value={importeDesde} onChange={(e) => setImporteDesde(e.currentTarget.value)} w={120} />
        <TextInput label="Importe hasta" inputMode="decimal" value={importeHasta} onChange={(e) => setImporteHasta(e.currentTarget.value)} w={120} />
        <TextInput
          label="Buscar"
          placeholder={tipo === FACTURAS ? 'Número, NIF o nombre' : 'Concepto, NIF o nombre'}
          value={texto}
          onChange={(e) => setTexto(e.currentTarget.value)}
          w={240}
        />
      </Group>

      {puedeApuntar && (
        <Group gap="sm">
          <Button onClick={() => setPreguntando('elegidos')} disabled={elegidos.size === 0}>
            Contabilizar lo elegido
          </Button>
          <Button
            variant="default"
            onClick={() => setPreguntando('periodo')}
            disabled={!filtroParcial && pendientesDelPeriodo === 0}
          >
            Contabilizar periodo…
          </Button>
          <Button
            variant="default"
            color="red"
            onClick={() => setPreguntando('deshacer')}
            disabled={elegidos.size === 0}
          >
            Deshacer lo elegido…
          </Button>
          <Button variant="default" onClick={() => void bloquear(true)} disabled={elegidos.size === 0}>
            Bloquear lo elegido
          </Button>
          <Button variant="default" onClick={() => void bloquear(false)} disabled={elegidos.size === 0}>
            Desbloquear lo elegido
          </Button>
          {tipo !== FACTURAS && (
            <Button variant="default" onClick={() => setPreguntando('agrupar')}>
              Cotejar con el mayor…
            </Button>
          )}
          {elegidos.size > 0 && (
            <Text fw={600}>
              {formatearEntero(elegidos.size)} elegidos · suma {formatearImporte(sumaElegidos)}
            </Text>
          )}
        </Group>
      )}

      <ResumenBandeja
        contabilizado={contabilizado}
        deshecho={deshecho}
        alVerBorradores={alVerBorradores}
        alCerrar={() => {
          setContabilizado(null)
          setDeshecho(null)
        }}
      />

      {error && (
        <Alert color="red" title="No se pudo cargar la bandeja" role="alert">
          {error}
        </Alert>
      )}

      {cargando && !lista && <Loader size="xs" />}

      {lista && (
        <>
          <Table.ScrollContainer minWidth={900} h="60vh" type="native">
            <Table withTableBorder striped highlightOnHover fz="sm" stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  {puedeApuntar && (
                    <Table.Th w={40}>
                      <Checkbox
                        aria-label="Elegir todas las de esta página"
                        checked={todosElegidos}
                        indeterminate={!todosElegidos && documentos.some((d) => elegidos.has(d.id))}
                        onChange={(e) => {
                          const si = e.currentTarget.checked
                          elegibles.forEach((d) => elegir(d.id, si))
                        }}
                      />
                    </Table.Th>
                  )}
                  <Table.Th w={110}>Fecha</Table.Th>
                  <Table.Th w={150}>{tipo === FACTURAS ? 'Número' : 'Factura'}</Table.Th>
                  <Table.Th>{tipo === FACTURAS ? 'Cliente o proveedor' : 'Concepto'}</Table.Th>
                  <Table.Th w={120}>Cuenta</Table.Th>
                  <Table.Th w={130} ta="right">
                    {tipo === FACTURAS ? 'Total' : 'Importe'}
                  </Table.Th>
                  <Table.Th w={230}>Estado</Table.Th>
                  <Table.Th w={90}>Asiento</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {documentos.map((documento) => {
                  const fila = columnas(documento, tipo)
                  const aspecto = aspectoDeEstado(documento)
                  const explicacion = documento.motivo || EXPLICACION_ESTADO[documento.estado] || ''
                  return (
                    <Table.Tr
                      key={documento.id}
                      onClick={() => setAbierto(documento.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {puedeApuntar && (
                        // La casilla no abre el detalle: solo elige.
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label="Elegir"
                            checked={elegidos.has(documento.id)}
                            disabled={documento.estado !== 'pendiente'}
                            onChange={(e) => elegir(documento.id, e.currentTarget.checked)}
                          />
                        </Table.Td>
                      )}
                      <Table.Td>{formatearFecha(fila.fecha)}</Table.Td>
                      <Table.Td>{fila.numero}</Table.Td>
                      <Table.Td>
                        {tipo === FACTURAS ? (documento.nombre_tercero ?? '') : fila.detalle}
                        <Text fz="xs" c="dimmed">
                          {tipo === FACTURAS
                            ? [fila.detalle, documento.nif_tercero].filter(Boolean).join(' · ')
                            : [documento.nombre_tercero, documento.nif_tercero].filter(Boolean).join(' · ')}
                        </Text>
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        {documento.cuenta_tercero ? (
                          <Anchor component="button" type="button" fz="sm" ff="monospace" title="Ver el mayor" onClick={() => setMayor(documento.cuenta_tercero ?? '')}>
                            {documento.cuenta_tercero}
                          </Anchor>
                        ) : (
                          ''
                        )}
                        {documento.cuenta_tercero && (
                          <Text size="xs" c="dimmed">
                            {plan.porCodigo.get(documento.cuenta_tercero)?.descripcion ?? ''}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace">
                        {formatearImporte(aDecimal(fila.importe))}
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2} align="flex-start">
                          <Tooltip
                            label={explicacion}
                            disabled={explicacion === ''}
                            withArrow
                            multiline
                            maw={320}
                          >
                            <Badge color={aspecto?.color ?? 'gray'} variant="light">
                              {aspecto?.nombre ?? documento.estado}
                            </Badge>
                          </Tooltip>
                          {documento.bloqueado === 1 && (
                            <Badge color="red" variant="outline" size="xs">
                              Bloqueado
                            </Badge>
                          )}
                          {'fase_pagare' in documento && documento.fase_pagare && FASES_PAGARE[documento.fase_pagare] && (
                            <Tooltip
                              label={`${documento.medio_pago ?? ''}${documento.fecha_vencimiento ? ` · vence ${formatearFecha(documento.fecha_vencimiento)}` : ''}${documento.fecha_negociado ? ` · negociado ${formatearFecha(documento.fecha_negociado)}` : ''} — ${FASES_PAGARE[documento.fase_pagare].explicacion}`}
                              withArrow
                              multiline
                              maw={360}
                            >
                              <Badge color={FASES_PAGARE[documento.fase_pagare].color} variant="light" size="xs">
                                {documento.medio_pago_tipo ?? 'Efecto'} · {FASES_PAGARE[documento.fase_pagare].nombre}
                              </Badge>
                            </Tooltip>
                          )}
                          {documento.revisado === 1 && (
                            <Tooltip
                              label={`Revisado${documento.revisado_por ? ` por ${documento.revisado_por}` : ''}${documento.revisado_fecha ? ` el ${formatearFecha(documento.revisado_fecha)}` : ''}`}
                              withArrow
                            >
                              <Badge color="teal" variant="outline" size="xs">
                                ✓ Revisado
                              </Badge>
                            </Tooltip>
                          )}
                          {documento.anotacion && (
                            <Tooltip label={`${documento.anotacion}${documento.anotacion_por ? ` — ${documento.anotacion_por}` : ''}`} withArrow multiline maw={360}>
                              <Badge color="grape" variant="outline" size="xs">
                                Nota
                              </Badge>
                            </Tooltip>
                          )}
                          {documento.cambio_en_origen === 1 && (
                            <Text fz="xs" c="orange">
                              {AVISO_CAMBIADA}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>{documento.asiento ?? ''}</Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {documentos.length === 0 && (
            <Text size="sm" c="dimmed">
              No hay nada en la bandeja con este filtro.
            </Text>
          )}

          <ModalMayor cuenta={mayor} ejercicio={ejercicio} alCerrar={() => setMayor('')} />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {cuantosDocumentos(lista.total, tipo)}
              {elegidos.size > 0 ? ` · ${formatearEntero(elegidos.size)} elegidos, suma ${formatearImporte(sumaElegidos)}` : ''}
            </Text>
            {paginas > 1 && <Pagination total={paginas} value={pagina} onChange={setPagina} size="sm" />}
          </Group>
        </>
      )}

      <DialogoDocumento
        tipo={tipo}
        id={abierto}
        nivel={nivel}
        alCerrar={() => setAbierto(null)}
        alCambiado={() => setRecarga((n) => n + 1)}
      />

      <DialogoCotejo
        abierto={preguntando === 'agrupar'}
        ejercicio={ejercicio}
        idsIniciales={[...elegidos]}
        cuentaInicial={cuentaTexto.trim() || cuentaDeLoElegido}
        libroInicial={libro === TODOS ? '' : libro}
        alCerrar={() => setPreguntando(null)}
        alHecho={() => {
          setElegidos(new Set())
          volverALeer()
        }}
      />

      <DialogoConfirmar
        abierto={preguntando === 'elegidos'}
        titulo="Contabilizar lo elegido"
        texto={`De lo elegido (${cuantosDocumentos(
          elegidos.size,
          tipo,
        )}) se contabiliza lo que esté por contabilizar. Entra como borradores: no pasan al libro hasta que lo confirmes. Las cuentas que no existan se crean en el plan contable.`}
        rotulo="Contabilizar"
        alCerrar={() => setPreguntando(null)}
        alConfirmar={() => contabilizar({ ids: [...elegidos] })}
      />

      <DialogoConfirmar
        abierto={preguntando === 'periodo'}
        titulo="Contabilizar periodo"
        texto={`${
          filtroParcial
            ? `Se va a contabilizar todo lo que esté por contabilizar de ${comoSeLlama(periodo, ejercicio)}, también lo que no se ve con el tipo o la búsqueda que hay puestos.`
            : `Se van a contabilizar ${cuantosDocumentos(pendientesDelPeriodo, tipo)} por contabilizar de ${comoSeLlama(periodo, ejercicio)}.`
        } Entran como borradores: no pasan al libro hasta que los confirmes. La que no se pueda queda apartada con su motivo y no frena a las demás.`}
        rotulo="Contabilizar"
        alCerrar={() => setPreguntando(null)}
        alConfirmar={() => contabilizar({ ejercicio, periodo })}
      />

      <DialogoConfirmar
        abierto={preguntando === 'deshacer'}
        titulo="Deshacer la contabilización"
        texto="De lo elegido, lo que siga en borrador vuelve a «Por contabilizar» y su borrador se quita. Lo que ya tenga el asiento confirmado se queda como está: el libro no se borra."

        rotulo="Deshacer"
        alCerrar={() => setPreguntando(null)}
        alConfirmar={async () => {
          setContabilizado(null)
          setDeshecho(await deshacerContabilizacion(tipo, [...elegidos]))
          setPreguntando(null)
          volverALeer()
        }}
      />
    </Stack>
  )
}
