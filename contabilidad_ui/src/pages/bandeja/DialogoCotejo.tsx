import { Alert, Badge, Button, Checkbox, Group, Modal, ScrollArea, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import Decimal from 'decimal.js'
import { useEffect, useMemo, useState } from 'react'
import { listarApuntes, type Apunte } from '../../api/asientos'
import {
  confirmarAgrupacion,
  listarBandeja,
  MOVIMIENTOS,
  revisarDocumentos,
  type MovimientoBandeja,
} from '../../api/bandeja'
import { textoDeError } from '../../api/errores'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { aDecimal } from '../../lib/dinero'
import { formatearFecha, formatearImporte } from '../../lib/format'

interface Props {
  abierto: boolean
  ejercicio: number
  /** Con qué se abre: lo que había elegido en la lista y su cuenta. */
  idsIniciales: number[]
  cuentaInicial: string
  libroInicial: string
  alCerrar: () => void
  /** Tras agrupar: las listas tienen que volver a leerse. */
  alHecho: () => void
}

const TOPE = 25000

/**
 * Dos marcos: a la izquierda los cobros o pagos por contabilizar de una cuenta;
 * a la derecha, el mayor de esa cuenta. Según se marcan los de la izquierda se
 * suman y se buscan en el mayor los apuntes con esa suma exacta. Al elegir uno,
 * todos los marcados pasan a contabilizados y quedan como un grupo.
 */
export default function DialogoCotejo({ abierto, ejercicio, idsIniciales, cuentaInicial, libroInicial, alCerrar, alHecho }: Props) {
  const plan = usePlanEnMemoria()
  const titulo = (c: string | null | undefined) => (c ? (plan.porCodigo.get(c)?.descripcion ?? '') : '')
  const [cuentaTexto, setCuentaTexto] = useState(cuentaInicial)
  const [cuenta] = useDebouncedValue(cuentaTexto.trim(), 500)
  const [libro, setLibro] = useState(libroInicial)
  const [movimientos, setMovimientos] = useState<MovimientoBandeja[]>([])
  const [apuntes, setApuntes] = useState<Apunte[]>([])
  const [marcados, setMarcados] = useState<Set<number>>(new Set(idsIniciales))
  const [cargando, setCargando] = useState(false)
  const [agrupando, setAgrupando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!abierto) return
    setHecho(null)
    setCuentaTexto(cuentaInicial)
    setLibro(libroInicial)
    setMarcados(new Set(idsIniciales))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Los dos marcos se leen cuando cambia la cuenta o el tipo.
  useEffect(() => {
    if (!abierto || cuenta === '') return
    let vigente = true
    setCargando(true)
    setError(null)
    Promise.all([
      listarBandeja({
        tipo: MOVIMIENTOS, estado: 'pendiente', libro, ejercicio, periodo: '', buscar: '', cuenta,
        pagina: 1, porPagina: 500,
      }),
      listarApuntes({
        ejercicio, cuenta, desde: '', hasta: '', incluir: 'todas', diario: '', concepto: '', documento: '',
        asientoDesde: '', asientoHasta: '', importeDesde: '', importeHasta: '', idBorrador: null,
        offset: 0, limit: TOPE,
      }),
    ])
      .then(([lista, mayor]) => {
        if (!vigente) return
        setMovimientos(lista.documentos as MovimientoBandeja[])
        setApuntes(mayor.apuntes.filter((a) => a.cuenta.startsWith(cuenta)))
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [abierto, cuenta, libro, ejercicio, recarga])

  const elegidos = movimientos.filter((m) => marcados.has(m.id))
  const suma = elegidos.reduce((t, m) => t.plus(aDecimal(m.importe)), new Decimal(0))
  // La columna que toca: en bancos y cajas (57) un cobro entra por el debe y un pago por el haber;
  // en la cuenta del cliente o proveedor, al revés. Las facturas quedan en la otra columna.
  const clases = new Set(elegidos.map((m) => m.clase))
  const mezcla = clases.size > 1
  const esCobro = clases.size === 1 ? clases.has('cobro') : libro === 'cobro'
  const enDebe = cuenta.startsWith('57') ? esCobro : !esCobro
  const coinciden = useMemo(
    () =>
      suma.isZero() || mezcla
        ? []
        : apuntes.filter((a) => {
            const [propia, contraria] = enDebe ? [a.debe, a.haber] : [a.haber, a.debe]
            // También vale la contraria en negativo: es el mismo movimiento apuntado al revés.
            return propia.equals(suma) || contraria.equals(suma.negated())
          }),
    [apuntes, suma, mezcla, enDebe],
  )
  // Lleva el mayor hasta el primer apunte que coincide.
  const primerPase = coinciden[0]?.pase
  useEffect(() => {
    if (primerPase === undefined) return
    document.getElementById(`cotejo-pase-${primerPase}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [primerPase])

  const pasesQueCoinciden = new Set(coinciden.map((a) => a.pase))

  function marcar(id: number, si: boolean) {
    setMarcados((antes) => {
      const nuevo = new Set(antes)
      if (si) nuevo.add(id)
      else nuevo.delete(id)
      return nuevo
    })
  }

  const sinRevisar = elegidos.filter((m) => m.revisado !== 1)

  async function revisarTodos() {
    setError(null)
    try {
      const r = await revisarDocumentos(MOVIMIENTOS, sinRevisar.map((m) => m.id), true)
      if (r.no_se_pueden.length > 0) setError(r.no_se_pueden[0].motivo)
      else setHecho(`${sinRevisar.length} dados por revisados.`)
      setRecarga((n) => n + 1)
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }

  async function agrupar(apunte: Apunte) {
    setAgrupando(true)
    setError(null)
    try {
      await confirmarAgrupacion(
        elegidos.map((m) => m.id),
        apunte,
      )
      setHecho(`Agrupados ${elegidos.length} por ${formatearImporte(suma)} con el asiento ${apunte.asiento}.`)
      setMarcados(new Set())
      setRecarga((n) => n + 1)
      alHecho()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setAgrupando(false)
    }
  }

  return (
    <Modal opened={abierto} onClose={alCerrar} title="Cotejar cobros y pagos con el mayor" size="98%" centered>
      <Stack gap="sm">
        {hecho && (
          <Alert color="teal" withCloseButton onClose={() => setHecho(null)}>
            {hecho}
          </Alert>
        )}

        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Group align="end" gap="sm">
          <TextInput label="Cuenta" description={titulo(cuenta) || "Banco o caja, o la del cliente o proveedor"} value={cuentaTexto} onChange={(e) => setCuentaTexto(e.currentTarget.value)} w={220} />
          <Select
            label="Tipo"
            data={[
              { value: '', label: 'Cobros y pagos' },
              { value: 'cobro', label: 'Cobros' },
              { value: 'pago', label: 'Pagos' },
            ]}
            value={libro}
            onChange={(v) => setLibro(v ?? '')}
            allowDeselect={false}
            w={170}
          />
          <Button variant="default" onClick={() => void revisarTodos()} disabled={sinRevisar.length === 0}>
            Dar por revisados los marcados ({sinRevisar.length})
          </Button>
          <Text fw={600}>
            {elegidos.length} marcados · suma {formatearImporte(suma)}
          </Text>
          <Text size="sm" c={coinciden.length > 0 ? 'teal' : 'dimmed'}>
            {suma.isZero()
              ? 'Marca cobros o pagos a la izquierda.'
              : mezcla
                ? 'Hay cobros y pagos marcados: se agrupan por separado.'
              : coinciden.length > 0
                ? `${coinciden.length} apunte${coinciden.length === 1 ? '' : 's'} del mayor con esa suma`
                : 'Ningún apunte del mayor suma eso'}
          </Text>
        </Group>

        <Group align="flex-start" grow wrap="nowrap">
          <Stack gap={4}>
            <Text fw={600} size="sm">Bandeja · por contabilizar ({movimientos.length})</Text>
            <ScrollArea h="65vh" type="auto">
              <Table stickyHeader highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={30}>
                      <Checkbox
                        aria-label="Marcar todos"
                        checked={movimientos.length > 0 && elegidos.length === movimientos.length}
                        indeterminate={elegidos.length > 0 && elegidos.length < movimientos.length}
                        onChange={(e) => setMarcados(e.currentTarget.checked ? new Set(movimientos.map((m) => m.id)) : new Set())}
                      />
                    </Table.Th>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Tercero</Table.Th>
                    <Table.Th>Concepto</Table.Th>
                    <Table.Th ta="right">Importe</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {movimientos.map((m) => (
                    <Table.Tr key={m.id} bg={marcados.has(m.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                      <Table.Td>
                        <Checkbox checked={marcados.has(m.id)} onChange={(e) => marcar(m.id, e.currentTarget.checked)} aria-label="Marcar" />
                      </Table.Td>
                      <Table.Td>{formatearFecha(m.fecha)}</Table.Td>
                      <Table.Td>
                        {m.nombre_tercero}
                        <Text size="xs" c="dimmed">
                          {[m.cuenta_tercero, titulo(m.cuenta_tercero)].filter(Boolean).join(' · ')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {m.concepto}{' '}
                        {m.revisado === 1 && <Badge size="xs" color="gray" variant="light">Revisado</Badge>}
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace">{formatearImporte(aDecimal(m.importe))}</Table.Td>
                    </Table.Tr>
                  ))}
                  {!cargando && movimientos.length === 0 && (
                    <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">Nada por contabilizar en esa cuenta.</Text></Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>

          <Stack gap={4}>
            <Text fw={600} size="sm">Mayor de {cuenta || '…'}{titulo(cuenta) ? ` · ${titulo(cuenta)}` : ''} · {ejercicio} ({apuntes.length})</Text>
            <ScrollArea h="65vh" type="auto">
              <Table stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Fecha</Table.Th>
                    <Table.Th>Asiento</Table.Th>
                    <Table.Th>Concepto</Table.Th>
                    <Table.Th ta="right" c={coinciden.length > 0 && enDebe ? 'teal' : undefined}>Debe</Table.Th>
                    <Table.Th ta="right" c={coinciden.length > 0 && !enDebe ? 'teal' : undefined}>Haber</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {apuntes.map((a) => {
                    const coincide = pasesQueCoinciden.has(a.pase)
                    return (
                      <Table.Tr key={a.pase} id={`cotejo-pase-${a.pase}`} bg={coincide ? 'var(--mantine-color-teal-light)' : undefined}>
                        <Table.Td>{a.fecha ? formatearFecha(a.fecha) : ''}</Table.Td>
                        <Table.Td>
                          {a.asiento}{' '}
                          {a.es_borrador && <Badge size="xs" color="orange" variant="light">Borrador</Badge>}
                        </Table.Td>
                        <Table.Td>
                          {a.concepto}
                          {a.cuenta !== cuenta && (
                            <Text size="xs" c="dimmed">{a.cuenta} · {titulo(a.cuenta)}</Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="right" ff="monospace">{a.debe.isZero() ? '' : formatearImporte(a.debe)}</Table.Td>
                        <Table.Td ta="right" ff="monospace">{a.haber.isZero() ? '' : formatearImporte(a.haber)}</Table.Td>
                        <Table.Td>
                          {coincide && (
                            <Button size="xs" onClick={() => void agrupar(a)} loading={agrupando}>
                              Agrupar con este
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Stack>
        </Group>
      </Stack>
    </Modal>
  )
}
