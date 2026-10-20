import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert, Badge, Button, Checkbox, Group, Modal, NumberInput, Select, Stack, Table, Text, TextInput,
} from "@mantine/core"
import { IconCash, IconRefresh } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE } from "@contabilidad/components/tabla.ts"
import { formatearFecha, formatearImporte } from "../../../formato"
import { DERECHA, opcionesRejilla } from "../rejilla"
import { RUTA_COBROS } from "./ruta"

// Lo que queda por cobrar: los recibos de las facturas de venta. Se marcan
// los de un cliente y se anota el cobro (entero o en parte).
const SITUACION = {
  pendiente_remesar: ["blue", "Para remesar"],
  remesado: ["indigo", "En remesa"],
  abonado: ["green", "Abonado"],
  impagado: ["red", "Devuelto"],
}
const HOY = () => new Date().toISOString().slice(0, 10)

export default function Cartera({ pedir }) {
  const [cuales, setCuales] = useState("pendientes")
  const [vencidos, setVencidos] = useState(false)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [texto, setTexto] = useState("")
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [seleccion, setSeleccion] = useState({})
  const [cobrando, setCobrando] = useState(null)

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    setSeleccion({})
    const cuerpo = { offset: 0, limit: 5000, estado_calculado: cuales, solo_vencidos: vencidos }
    if (desde) cuerpo.fecha_venc_desde = desde
    if (hasta) cuerpo.fecha_venc_hasta = hasta
    if (texto.trim()) cuerpo.texto = texto.trim()
    pedir(`${RUTA_COBROS}/recibos/listar`, cuerpo)
      .then((r) => setFilas(r.registros))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir, cuales, vencidos, desde, hasta, texto])
  useEffect(cargar, [cargar])

  const columnas = useMemo(() => [
    { accessorKey: "fecha_vencimiento", header: "Vence", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "numero_factura", header: "Factura", size: 130, grow: false },
    { accessorKey: "receptor_nombre", header: "Cliente", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE },
    { accessorKey: "importe", header: "Importe", size: 110, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "importe_cobrado", header: "Cobrado", size: 110, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "importe_pendiente", header: "Pendiente", size: 110, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "medio_pago_descripcion", header: "Medio previsto", size: 150, grow: false },
    {
      id: "situacion", header: "Situación", size: 160, grow: false,
      Cell: ({ row }) => {
        const f = row.original
        if (Number(f.importe_pendiente) <= 0.009) return <Badge color="green" variant="light">Cobrado</Badge>
        const [color, txt] = SITUACION[f.situacion] || (Number(f.dias_retraso) > 0 ? ["red", `Vencido hace ${f.dias_retraso} d`] : ["gray", "Pendiente"])
        return <Badge color={color} variant="light">{txt}</Badge>
      },
    },
  ], [])

  const tabla = useMantineReactTable({
    ...opcionesRejilla(),
    columns: columnas,
    data: filas || [],
    getRowId: (f) => String(f.id_recibo),
    enableRowSelection: (row) => Number(row.original.importe_pendiente) > 0.009,
    onRowSelectionChange: setSeleccion,
    state: { isLoading: filas === null, rowSelection: seleccion },
    localization: { noRecordsToDisplay: "No hay recibos con estos filtros." },
  })

  const elegidos = (filas || []).filter((f) => seleccion[String(f.id_recibo)])
  const clientes = new Set(elegidos.map((f) => f.id_receptor))

  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group align="flex-end" gap="sm">
        <Select
          label="Qué recibos" w={170} allowDeselect={false} value={cuales} onChange={setCuales}
          data={[{ value: "pendientes", label: "Por cobrar" }, { value: "cobrados", label: "Cobrados" }, { value: "todos", label: "Todos" }]}
        />
        <TextInput type="date" label="Vencen desde" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
        <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
        <TextInput label="Buscar" placeholder="Cliente o factura" value={texto} onChange={(e) => setTexto(e.currentTarget.value)} />
        <Checkbox mb={8} label="Solo vencidos" checked={vencidos} onChange={(e) => setVencidos(e.currentTarget.checked)} />
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
        <Button
          leftSection={<IconCash size={15} />} disabled={!elegidos.length || clientes.size > 1}
          onClick={() => setCobrando(elegidos)}
        >
          Anotar cobro{elegidos.length ? ` (${elegidos.length})` : ""}
        </Button>
      </Group>
      {clientes.size > 1 && <Alert color="yellow">Un cobro es de un solo cliente: marca solo recibos del mismo.</Alert>}
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
      {cobrando && (
        <AnotarCobro pedir={pedir} recibos={cobrando} alCerrar={() => setCobrando(null)} alHecho={() => { setCobrando(null); cargar() }} />
      )}
    </Stack>
  )
}

function AnotarCobro({ pedir, recibos, alCerrar, alHecho }) {
  const [fecha, setFecha] = useState(HOY())
  const [medios, setMedios] = useState([])
  const [idMedio, setIdMedio] = useState(recibos[0].id_medio_pago_previsto ? String(recibos[0].id_medio_pago_previsto) : null)
  const [referencia, setReferencia] = useState("")
  const [importes, setImportes] = useState(() => Object.fromEntries(recibos.map((r) => [r.id_recibo, Number(r.importe_pendiente)])))
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    pedir("/maestros/medios_pago/listar", { offset: 0, limit: 1000 })
      .then((r) => setMedios(r.registros.filter((m) => m.estado !== 0).map((m) => ({ value: String(m.id), label: m.descripcion }))))
      .catch(() => setMedios([]))
  }, [pedir])

  const total = recibos.reduce((s, r) => s + (Number(importes[r.id_recibo]) || 0), 0)
  const guardar = () => {
    setGuardando(true)
    setError(null)
    const aplicaciones = recibos
      .filter((r) => Number(importes[r.id_recibo]) > 0)
      .map((r) => ({ id_recibo: r.id_recibo, id_factura: r.id_factura, emitida_por: r.emitida_por || "VF", importe: Number(importes[r.id_recibo]) }))
    pedir(`${RUTA_COBROS}/crear`, {
      id_receptor: recibos[0].id_receptor, fecha_operacion: fecha, referencia: referencia || null,
      retener_sin_exportar: 0, computable_agente: 1,
      medios: [{ id_medio_pago: Number(idMedio), importe: Math.round(total * 100) / 100, referencia: referencia || null }],
      aplicaciones,
    })
      .then(alHecho)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }

  return (
    <Modal opened onClose={alCerrar} title={`Anotar cobro · ${recibos[0].receptor_nombre}`} size="lg">
      <Stack gap="sm">
        <Group grow>
          <TextInput type="date" label="Fecha del cobro" required value={fecha} onChange={(e) => setFecha(e.currentTarget.value)} />
          <Select label="Cómo se ha cobrado" required data={medios} value={idMedio} onChange={setIdMedio} searchable />
        </Group>
        <TextInput label="Referencia" placeholder="Nº de transferencia, cheque…" value={referencia} onChange={(e) => setReferencia(e.currentTarget.value)} />
        <Table withTableBorder fz="sm">
          <Table.Thead>
            <Table.Tr><Table.Th>Factura</Table.Th><Table.Th>Vence</Table.Th><Table.Th ta="right">Pendiente</Table.Th><Table.Th ta="right" w={150}>Se cobra</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {recibos.map((r) => (
              <Table.Tr key={r.id_recibo}>
                <Table.Td>{r.numero_factura}</Table.Td>
                <Table.Td>{formatearFecha(r.fecha_vencimiento)}</Table.Td>
                <Table.Td ta="right">{formatearImporte(r.importe_pendiente)}</Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs" decimalScale={2} decimalSeparator="," min={0} max={Number(r.importe_pendiente)} value={importes[r.id_recibo]}
                    onChange={(v) => setImportes((a) => ({ ...a, [r.id_recibo]: v }))}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text ta="right" fw={700}>Total cobrado: {formatearImporte(total)}</Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button loading={guardando} disabled={!idMedio || total <= 0} onClick={guardar}>Anotar cobro</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
