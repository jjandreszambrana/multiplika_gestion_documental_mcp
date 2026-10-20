import { useCallback, useEffect, useMemo, useState } from "react"
import { ActionIcon, Alert, Button, Group, Loader, Menu, Modal, NumberInput, Select, Stack, Table, Text, TextInput } from "@mantine/core"
import { IconDots, IconPlus, IconRefresh } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE } from "@contabilidad/components/tabla.ts"
import { formatearFecha, formatearImporte } from "../../../formato"
import { DERECHA, opcionesRejilla } from "../rejilla"
import { Confirmar, HOY, useClientes, useMedios } from "./comun"
import { RUTA_COBROS } from "./ruta"

// Anticipos: dinero que un cliente adelanta antes de tener factura (o de
// más). Queda a su favor y luego se aplica a sus recibos, o se le devuelve.
export default function Anticipos({ pedir }) {
  const clientes = useClientes(pedir)
  const nombre = useMemo(() => Object.fromEntries(clientes.map((c) => [c.value, c.nombre])), [clientes])
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [accion, setAccion] = useState(null) // { tipo, anticipo }

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    pedir(`${RUTA_COBROS}/anticipos/listar`, { offset: 0, limit: 5000, orden: "fecha_operacion DESC" })
      .then((r) => setFilas(r.registros))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir])
  useEffect(cargar, [cargar])

  const columnas = useMemo(() => [
    { accessorKey: "fecha_operacion", header: "Fecha", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { id: "cliente", header: "Cliente", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE, accessorFn: (f) => f.NombreRazon_receptor || nombre[String(f.id_receptor)] || `Cliente ${f.id_receptor}` },
    { accessorKey: "medio_pago_descripcion", header: "Medio", size: 160, grow: false },
    { accessorKey: "importe_original", header: "Adelantado", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "aplicado", header: "Aplicado", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "disponible", header: "A su favor", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => <b>{formatearImporte(cell.getValue())}</b> },
    {
      id: "acciones", header: "", size: 50, grow: false,
      Cell: ({ row }) => Number(row.original.disponible) > 0.009 && (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target><ActionIcon size="sm" variant="subtle" aria-label="Acciones"><IconDots size={15} /></ActionIcon></Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setAccion({ tipo: "aplicar", anticipo: row.original })}>Aplicar a sus recibos</Menu.Item>
            <Menu.Item color="red" onClick={() => setAccion({ tipo: "devolver", anticipo: row.original })}>Devolvérselo</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ], [nombre])

  const tabla = useMantineReactTable({
    ...opcionesRejilla(),
    columns: columnas,
    data: filas || [],
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: "Ningún cliente tiene dinero adelantado." },
  })

  const cerrar = () => setAccion(null)
  const hecho = () => { setAccion(null); cargar() }
  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group gap="sm">
        <Button leftSection={<IconPlus size={15} />} onClick={() => setAccion({ tipo: "nuevo" })}>Anotar anticipo</Button>
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
      {accion?.tipo === "nuevo" && <NuevoAnticipo pedir={pedir} clientes={clientes} alCerrar={cerrar} alHecho={hecho} />}
      {accion?.tipo === "aplicar" && <Aplicar pedir={pedir} anticipo={accion.anticipo} alCerrar={cerrar} alHecho={hecho} />}
      {accion?.tipo === "devolver" && <Devolver pedir={pedir} anticipo={accion.anticipo} alCerrar={cerrar} alHecho={hecho} />}
    </Stack>
  )
}

function NuevoAnticipo({ pedir, clientes, alCerrar, alHecho }) {
  const medios = useMedios(pedir)
  const [v, setV] = useState({ id_receptor: null, fecha: HOY(), id_medio: null, importe: "", referencia: "" })
  const poner = (k, x) => setV((a) => ({ ...a, [k]: x }))
  const listo = v.id_receptor && v.id_medio && Number(v.importe) > 0
  return (
    <Confirmar
      titulo="Anotar anticipo" boton="Anotar" alCerrar={alCerrar} alHecho={alHecho}
      texto="El dinero queda a favor del cliente hasta que lo apliques a sus recibos."
      hacer={() => listo ? pedir(`${RUTA_COBROS}/crear`, {
        id_receptor: Number(v.id_receptor), fecha_operacion: v.fecha, referencia: v.referencia || null, concepto: "Anticipo",
        retener_sin_exportar: 0, computable_agente: 1, aplicaciones: [], anticipo_restante: Number(v.importe),
        medios: [{ id_medio_pago: Number(v.id_medio), importe: Number(v.importe), referencia: v.referencia || null }],
      }) : Promise.reject(new Error("Falta el cliente, el medio de pago o el importe"))}
    >
      <Select label="Cliente" required searchable data={clientes} value={v.id_receptor} onChange={(x) => poner("id_receptor", x)} />
      <Group grow>
        <TextInput type="date" label="Fecha" value={v.fecha} onChange={(e) => poner("fecha", e.currentTarget.value)} />
        <NumberInput label="Importe" required decimalScale={2} decimalSeparator="," min={0} value={v.importe} onChange={(x) => poner("importe", x)} />
      </Group>
      <Select label="Cómo se ha cobrado" required data={medios || []} value={v.id_medio} onChange={(x) => poner("id_medio", x)} />
      <TextInput label="Referencia" value={v.referencia} onChange={(e) => poner("referencia", e.currentTarget.value)} />
    </Confirmar>
  )
}

function Aplicar({ pedir, anticipo, alCerrar, alHecho }) {
  const [recibos, setRecibos] = useState(null)
  const [importes, setImportes] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const disponible = Number(anticipo.disponible)
  useEffect(() => {
    pedir(`${RUTA_COBROS}/recibos/listar`, { offset: 0, limit: 2000, estado_calculado: "pendientes", solo_vencidos: false, id_receptor: anticipo.id_receptor })
      .then((r) => setRecibos(r.registros))
      .catch((err) => {
        setRecibos([])
        setError(err.message)
      })
  }, [pedir, anticipo.id_receptor])
  const total = Object.values(importes).reduce((s, x) => s + (Number(x) || 0), 0)
  const guardar = () => {
    setGuardando(true)
    setError(null)
    const aplicaciones = recibos.filter((r) => Number(importes[r.id_recibo]) > 0)
      .map((r) => ({ id_recibo: r.id_recibo, id_factura: r.id_factura, emitida_por: r.emitida_por || "VF", importe: Number(importes[r.id_recibo]) }))
    pedir(`${RUTA_COBROS}/anticipos/aplicar`, { id_cobro: anticipo.id_cobro ?? anticipo.id, aplicaciones })
      .then(alHecho)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }
  return (
    <Modal opened onClose={alCerrar} title="Aplicar el anticipo a sus recibos" size="lg">
      <Stack gap="sm">
        <Text fz="sm">A su favor: <b>{formatearImporte(disponible)}</b></Text>
        {recibos === null ? <Loader size="sm" /> : !recibos.length ? <Text c="dimmed" fz="sm">Este cliente no tiene recibos pendientes.</Text> : (
          <Table withTableBorder fz="sm">
            <Table.Thead><Table.Tr><Table.Th>Factura</Table.Th><Table.Th>Vence</Table.Th><Table.Th ta="right">Pendiente</Table.Th><Table.Th ta="right" w={150}>Se aplica</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {recibos.map((r) => (
                <Table.Tr key={r.id_recibo}>
                  <Table.Td>{r.numero_factura}</Table.Td>
                  <Table.Td>{formatearFecha(r.fecha_vencimiento)}</Table.Td>
                  <Table.Td ta="right">{formatearImporte(r.importe_pendiente)}</Table.Td>
                  <Table.Td>
                    <NumberInput size="xs" decimalScale={2} decimalSeparator="," min={0} max={Number(r.importe_pendiente)} value={importes[r.id_recibo] ?? ""} onChange={(x) => setImportes((a) => ({ ...a, [r.id_recibo]: x }))} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Text ta="right" fw={700} c={total > disponible + 0.009 ? "red" : undefined}>Se aplica: {formatearImporte(total)}</Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button loading={guardando} disabled={total <= 0 || total > disponible + 0.009} onClick={guardar}>Aplicar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function Devolver({ pedir, anticipo, alCerrar, alHecho }) {
  const [importe, setImporte] = useState(Number(anticipo.disponible))
  const [fecha, setFecha] = useState(HOY())
  const [nota, setNota] = useState("")
  return (
    <Confirmar
      titulo="Devolver el anticipo" boton="Devolver" color="red" alCerrar={alCerrar} alHecho={alHecho}
      texto="Se le devuelve al cliente el dinero que tiene a su favor (todo o una parte)."
      hacer={() => pedir(`${RUTA_COBROS}/anticipos/devolver`, { id_cobro_origen: anticipo.id_cobro ?? anticipo.id, importe: Number(importe), fecha_operacion: fecha, anotacion: nota || null })}
    >
      <Group grow>
        <NumberInput label="Importe" decimalScale={2} decimalSeparator="," min={0} max={Number(anticipo.disponible)} value={importe} onChange={setImporte} />
        <TextInput type="date" label="Fecha" value={fecha} onChange={(e) => setFecha(e.currentTarget.value)} />
      </Group>
      <TextInput label="Nota" value={nota} onChange={(e) => setNota(e.currentTarget.value)} />
    </Confirmar>
  )
}
