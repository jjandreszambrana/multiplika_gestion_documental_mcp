import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActionIcon, Alert, Badge, Button, Checkbox, Group, Loader, Menu, Modal, NumberInput, Select, Stack, Table, Text, TextInput,
} from "@mantine/core"
import { IconDots, IconPlus, IconRefresh } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { formatearFecha, formatearImporte } from "../../../formato"
import { DERECHA, opcionesRejilla } from "../rejilla"
import { RUTA_REMESAS } from "./ruta"

// Remesas SEPA (recibos domiciliados): se arman con los recibos pendientes
// de los clientes que pagan por domiciliación, se saca el fichero para el
// banco y, cuando el banco abona, se marcan abonadas (entonces cuentan como
// cobradas). Lo que el banco devuelva se anota como devolución.
const ESTADO = { 0: ["gray", "Borrador"], 1: ["blue", "Enviada al banco"], 2: ["green", "Abonada"], 3: ["red", "Con devoluciones"], 4: ["dark", "Cerrada"] }
const HOY = () => new Date().toISOString().slice(0, 10)
const TIPOS_SEPA = [5, 6]

export default function Remesas({ pedir }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [nueva, setNueva] = useState(false)
  const [accion, setAccion] = useState(null) // { tipo, remesa }

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    pedir(`${RUTA_REMESAS}/listar`, { offset: 0, limit: 2000, orden: "id DESC" })
      .then((r) => setFilas(r.registros))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir])
  useEffect(cargar, [cargar])

  // El fichero para el banco (XML SEPA pain.008)
  const fichero = useCallback(async (remesa) => {
    setError(null)
    setAviso(null)
    try {
      const r = await pedir(`${RUTA_REMESAS}/generar_fichero`, { id: remesa.id, marcar_enviada: remesa.estado === 0 })
      const enlace = document.createElement("a")
      enlace.href = URL.createObjectURL(new Blob([r.fichero_generado], { type: "application/xml" }))
      enlace.download = `remesa-${remesa.id}.xml`
      enlace.click()
      if (r.excluidos?.length) setAviso(`Se han dejado fuera ${r.excluidos.length} cobros: ${r.excluidos.map((x) => x.motivo).join("; ")}`)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }, [pedir, cargar])

  const columnas = useMemo(() => [
    { accessorKey: "id", header: "Nº", size: 70, grow: false },
    { accessorKey: "fecha_creacion", header: "Creada", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "fecha_vencimiento", header: "Cargo", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "medio_pago_descripcion", header: "Cuenta", grow: true },
    { accessorKey: "numero_cobros", header: "Recibos", size: 90, grow: false, ...DERECHA },
    { accessorKey: "importe_total", header: "Importe", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    {
      id: "estado", header: "Estado", size: 160, grow: false,
      Cell: ({ row }) => {
        const [color, txt] = ESTADO[row.original.estado] || ["gray", row.original.estado_descripcion]
        return <Badge color={color} variant="light">{txt}</Badge>
      },
    },
    {
      id: "acciones", header: "", size: 50, grow: false,
      Cell: ({ row }) => {
        const r = row.original
        if (r.estado === 4) return null
        return (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target><ActionIcon size="sm" variant="subtle" aria-label="Acciones"><IconDots size={15} /></ActionIcon></Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => fichero(r)}>{r.estado === 0 ? "Sacar el fichero para el banco" : "Volver a sacar el fichero"}</Menu.Item>
              {r.estado === 1 && <Menu.Item onClick={() => setAccion({ tipo: "abonada", remesa: r })}>El banco la ha abonado</Menu.Item>}
              {[1, 2, 3].includes(r.estado) && <Menu.Item onClick={() => setAccion({ tipo: "devoluciones", remesa: r })}>Anotar recibos devueltos</Menu.Item>}
              {r.estado !== 0 && <Menu.Item onClick={() => setAccion({ tipo: "cerrar", remesa: r })}>Cerrarla</Menu.Item>}
              {r.estado === 0 && <Menu.Item color="red" onClick={() => setAccion({ tipo: "eliminar", remesa: r })}>Borrarla</Menu.Item>}
            </Menu.Dropdown>
          </Menu>
        )
      },
    },
  ], [fichero])

  const tabla = useMantineReactTable({
    ...opcionesRejilla(),
    columns: columnas,
    data: filas || [],
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: "No hay remesas." },
  })

  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group gap="sm">
        <Button leftSection={<IconPlus size={15} />} onClick={() => setNueva(true)}>Nueva remesa</Button>
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
      </Group>
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert color="yellow" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      <MantineReactTable table={tabla} />
      {nueva && <NuevaRemesa pedir={pedir} alCerrar={() => setNueva(false)} alHecho={() => { setNueva(false); cargar() }} />}
      {accion?.tipo === "devoluciones" && <Devoluciones pedir={pedir} remesa={accion.remesa} alCerrar={() => setAccion(null)} alHecho={() => { setAccion(null); cargar() }} />}
      {accion && accion.tipo !== "devoluciones" && <Confirmar pedir={pedir} {...accion} alCerrar={() => setAccion(null)} alHecho={() => { setAccion(null); cargar() }} />}
    </Stack>
  )
}

function NuevaRemesa({ pedir, alCerrar, alHecho }) {
  const [medios, setMedios] = useState(null)
  const [idMedio, setIdMedio] = useState(null)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState(HOY())
  const [cargo, setCargo] = useState(HOY())
  const [recibos, setRecibos] = useState(null)
  const [elegidos, setElegidos] = useState(new Set())
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    pedir("/maestros/medios_pago/listar", { offset: 0, limit: 1000 })
      .then((r) => {
        const sepa = r.registros.filter((m) => TIPOS_SEPA.includes(Number(m.id_tipo)) && m.estado !== 0)
        setMedios(sepa.map((m) => ({ value: String(m.id), label: `${m.descripcion}${m.iban ? ` · ${m.iban}` : ""}` })))
        if (sepa.length === 1) setIdMedio(String(sepa[0].id))
      })
      .catch((err) => setError(err.message))
  }, [pedir])

  const buscar = () => {
    setError(null)
    setRecibos(null)
    const cuerpo = { id_medio_pago: Number(idMedio), offset: 0, limit: 10000 }
    if (desde) cuerpo.fecha_venc_desde = desde
    if (hasta) cuerpo.fecha_venc_hasta = hasta
    pedir(`${RUTA_REMESAS}/candidatos_recibos`, cuerpo)
      .then((r) => {
        setRecibos(r.registros)
        setElegidos(new Set(r.registros.filter((x) => x.tiene_mandato).map((x) => x.id_recibo)))
      })
      .catch((err) => {
        setRecibos([])
        setError(err.message)
      })
  }
  const total = (recibos || []).filter((r) => elegidos.has(r.id_recibo)).reduce((s, r) => s + Number(r.importe_pendiente), 0)
  const crear = () => {
    setGuardando(true)
    setError(null)
    pedir(`${RUTA_REMESAS}/crear_desde_recibos`, { id_medio_pago: Number(idMedio), ids_recibos: [...elegidos], fecha_presentacion: HOY(), fecha_vencimiento: cargo })
      .then(alHecho)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }
  const cambiar = (id) => setElegidos((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  return (
    <Modal opened onClose={alCerrar} title="Nueva remesa" size="xl">
      <Stack gap="sm">
        {medios !== null && !medios.length && (
          <Alert color="yellow">No hay ningún medio de pago de domiciliación SEPA. Créalo en Medios de pago, con su IBAN.</Alert>
        )}
        <Group align="flex-end" gap="sm">
          <Select label="Cuenta que cobra" required data={medios || []} value={idMedio} onChange={setIdMedio} w={320} />
          <TextInput type="date" label="Recibos que vencen desde" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
          <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
          <Button variant="default" disabled={!idMedio} onClick={buscar}>Buscar recibos</Button>
        </Group>
        {recibos === null && idMedio && <Text fz="sm" c="dimmed">Elige las fechas y pulsa Buscar recibos.</Text>}
        {recibos?.length === 0 && <Text fz="sm" c="dimmed">No hay recibos pendientes de domiciliar en esas fechas.</Text>}
        {!!recibos?.length && (
          <Table withTableBorder fz="sm" stickyHeader>
            <Table.Thead>
              <Table.Tr><Table.Th w={40} /><Table.Th>Cliente</Table.Th><Table.Th>Factura</Table.Th><Table.Th>Vence</Table.Th><Table.Th ta="right">Importe</Table.Th><Table.Th>Avisos</Table.Th></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recibos.map((r) => (
                <Table.Tr key={r.id_recibo}>
                  <Table.Td><Checkbox checked={elegidos.has(r.id_recibo)} onChange={() => cambiar(r.id_recibo)} aria-label="Incluir" /></Table.Td>
                  <Table.Td>{r.NombreRazon_receptor}</Table.Td>
                  <Table.Td>{r.numero_factura}</Table.Td>
                  <Table.Td>{formatearFecha(r.fecha_vencimiento)}</Table.Td>
                  <Table.Td ta="right">{formatearImporte(r.importe_pendiente)}</Table.Td>
                  <Table.Td>
                    {!r.tiene_mandato && <Badge color="red" variant="light" size="sm">Sin mandato SEPA</Badge>}
                    {!!r.devuelto_antes && <Badge color="orange" variant="light" size="sm" ml={4}>Devuelto antes</Badge>}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Group justify="space-between" align="flex-end">
          <TextInput type="date" label="Fecha de cargo al cliente" value={cargo} onChange={(e) => setCargo(e.currentTarget.value)} />
          <Text fw={700}>{elegidos.size} recibos · {formatearImporte(total)}</Text>
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button loading={guardando} disabled={!elegidos.size} onClick={crear}>Crear la remesa</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function Devoluciones({ pedir, remesa, alCerrar, alHecho }) {
  const [cobros, setCobros] = useState(null)
  const [importes, setImportes] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    pedir(`${RUTA_REMESAS}/obtener`, { id: remesa.id, incluir_cobros: true, incluir_fichero: false })
      .then((r) => setCobros((r.cobros || []).filter((c) => Number(c.importe) > 0 && ![3, 4].includes(c.id_estado))))
      .catch((err) => {
        setCobros([])
        setError(err.message)
      })
  }, [pedir, remesa.id])
  const elegidos = Object.entries(importes).filter(([, v]) => Number(v) > 0)
  const guardar = () => {
    setGuardando(true)
    setError(null)
    pedir(`${RUTA_REMESAS}/devoluciones`, { id: remesa.id, devoluciones: elegidos.map(([id, importe]) => ({ id_cobro: Number(id), importe: Number(importe) })) })
      .then(alHecho)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }
  return (
    <Modal opened onClose={alCerrar} title={`Recibos devueltos · remesa ${remesa.id}`} size="lg">
      <Stack gap="sm">
        <Text fz="sm">Pon el importe devuelto de cada recibo que el banco no ha podido cobrar. Esos recibos vuelven a quedar pendientes.</Text>
        {cobros === null ? <Loader size="sm" /> : (
          <Table withTableBorder fz="sm">
            <Table.Thead><Table.Tr><Table.Th>Cliente</Table.Th><Table.Th ta="right">Importe</Table.Th><Table.Th ta="right" w={150}>Devuelto</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {cobros.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.NombreRazon_receptor || c.receptor_nombre || `Cobro ${c.id}`}</Table.Td>
                  <Table.Td ta="right">{formatearImporte(c.importe)}</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <NumberInput size="xs" decimalScale={2} decimalSeparator="," min={0} max={Number(c.importe)} value={importes[c.id] ?? ""} onChange={(v) => setImportes((a) => ({ ...a, [c.id]: v }))} />
                      <Button size="compact-xs" variant="subtle" onClick={() => setImportes((a) => ({ ...a, [c.id]: Number(c.importe) }))}>Todo</Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button color="red" loading={guardando} disabled={!elegidos.length} onClick={guardar}>Anotar devoluciones</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

const TEXTOS = {
  abonada: { titulo: "Remesa abonada", texto: "El banco ha ingresado la remesa: sus recibos pasan a cobrados. Si luego devuelve alguno, anótalo como recibo devuelto.", boton: "Marcar abonada", estado: 2 },
  cerrar: { titulo: "Cerrar la remesa", texto: "Ya no se esperan más movimientos del banco. No se puede volver a abrir.", boton: "Cerrar", estado: 4 },
  eliminar: { titulo: "Borrar la remesa", texto: "Se borra y sus recibos vuelven a quedar pendientes de cobrar.", boton: "Borrar", color: "red" },
}

function Confirmar({ pedir, tipo, remesa, alCerrar, alHecho }) {
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const t = TEXTOS[tipo]
  const hacer = () => {
    setTrabajando(true)
    setError(null)
    const llamada = tipo === "eliminar"
      ? pedir(`${RUTA_REMESAS}/eliminar`, { id: remesa.id })
      : pedir(`${RUTA_REMESAS}/cambiar_estado`, { id: remesa.id, nuevo_estado: t.estado })
    llamada.then(alHecho).catch((err) => setError(err.message)).finally(() => setTrabajando(false))
  }
  return (
    <Modal opened onClose={alCerrar} title={t.titulo}>
      <Stack gap="sm">
        <Text fz="sm">Remesa {remesa.id} · {remesa.numero_cobros} recibos · {formatearImporte(remesa.importe_total)}</Text>
        <Text>{t.texto}</Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button color={t.color} loading={trabajando} onClick={hacer}>{t.boton}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
