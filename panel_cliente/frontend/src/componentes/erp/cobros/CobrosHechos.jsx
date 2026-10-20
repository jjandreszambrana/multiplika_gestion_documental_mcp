import { useCallback, useEffect, useMemo, useState } from "react"
import { ActionIcon, Alert, Badge, Button, Group, Menu, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core"
import { IconDots, IconRefresh } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE } from "@contabilidad/components/tabla.ts"
import { formatearFecha, formatearImporte } from "../../../formato"
import { DERECHA, opcionesRejilla } from "../rejilla"
import { RUTA_COBROS } from "./ruta"

// Los cobros anotados. Uno equivocado se deshace (si no está en una remesa,
// un arqueo o exportado); uno que el banco ha devuelto se anota como
// devolución, y el recibo vuelve a quedar pendiente. Los que están "en
// cartera" (cheques, pagarés...) se dan por cobrados al cobrarlos.
const ESTADO = { 0: ["gray", "Pendiente"], 1: ["blue", "En cartera"], 2: ["green", "Cobrado"], 3: ["dark", "Deshecho"], 4: ["red", "Devolución"] }
const HOY = () => new Date().toISOString().slice(0, 10)
const INICIO_ANIO = `${new Date().getFullYear()}-01-01`

export default function CobrosHechos({ pedir }) {
  const [desde, setDesde] = useState(INICIO_ANIO)
  const [hasta, setHasta] = useState("")
  const [estado, setEstado] = useState(null)
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [accion, setAccion] = useState(null) // { tipo, cobro }

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    const cuerpo = { offset: 0, limit: 5000, orden: "fecha_operacion DESC" }
    if (desde) cuerpo.fecha_desde = desde
    if (hasta) cuerpo.fecha_hasta = hasta
    if (estado !== null) cuerpo.id_estado = Number(estado)
    pedir(`${RUTA_COBROS}/listar`, cuerpo)
      .then((r) => setFilas(r.registros))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir, desde, hasta, estado])
  useEffect(cargar, [cargar])

  const columnas = useMemo(() => [
    { accessorKey: "fecha_operacion", header: "Fecha", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "NombreRazon_receptor", header: "Cliente", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE },
    { accessorKey: "numero_factura_completo", header: "Factura", size: 130, grow: false },
    { accessorKey: "medio_pago_descripcion", header: "Medio", size: 160, grow: false },
    { accessorKey: "importe", header: "Importe", size: 110, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    {
      id: "estado", header: "Estado", size: 130, grow: false,
      Cell: ({ row }) => {
        const [color, txt] = ESTADO[row.original.id_estado] || ["gray", row.original.estado_cobro]
        return (
          <Group gap={4} wrap="nowrap">
            <Badge color={color} variant="light">{txt}</Badge>
            {row.original.id_remesa > 0 && <Badge color="indigo" variant="outline" size="xs">Remesa</Badge>}
          </Group>
        )
      },
    },
    {
      id: "acciones", header: "", size: 50, grow: false,
      Cell: ({ row }) => {
        const c = row.original
        if ([3, 4].includes(c.id_estado) || Number(c.importe) <= 0) return null
        return (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target><ActionIcon size="sm" variant="subtle" aria-label="Acciones"><IconDots size={15} /></ActionIcon></Menu.Target>
            <Menu.Dropdown>
              {c.id_estado === 1 && <Menu.Item onClick={() => setAccion({ tipo: "cobrado", cobro: c })}>Dar por cobrado</Menu.Item>}
              {c.id_estado === 2 && <Menu.Item onClick={() => setAccion({ tipo: "devolucion", cobro: c })}>Anotar devolución del banco</Menu.Item>}
              <Menu.Item color="red" onClick={() => setAccion({ tipo: "deshacer", cobro: c })}>Deshacer el cobro</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )
      },
    },
  ], [])

  const tabla = useMantineReactTable({
    ...opcionesRejilla(),
    columns: columnas,
    data: filas || [],
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: "No hay cobros con estos filtros." },
  })

  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group align="flex-end" gap="sm">
        <TextInput type="date" label="Desde" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
        <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
        <Select
          label="Estado" placeholder="Todos" clearable w={170} value={estado} onChange={setEstado}
          data={Object.entries(ESTADO).map(([v, [, t]]) => ({ value: v, label: t }))}
        />
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
      {accion && <Accion pedir={pedir} {...accion} alCerrar={() => setAccion(null)} alHecho={() => { setAccion(null); cargar() }} />}
    </Stack>
  )
}

const TEXTOS = {
  deshacer: { titulo: "Deshacer el cobro", texto: "El cobro se anula y sus recibos vuelven a quedar pendientes. Si ya está en una remesa o en un arqueo de caja no se puede: entonces, anota una devolución.", boton: "Deshacer", color: "red" },
  devolucion: { titulo: "Devolución del banco", texto: "El banco ha devuelto el cobro (un recibo impagado, por ejemplo). Los recibos vuelven a quedar pendientes y el cobro original no se toca.", boton: "Anotar devolución", color: "red" },
  cobrado: { titulo: "Dar por cobrado", texto: "El cheque, pagaré o efecto ya se ha cobrado en el banco.", boton: "Dar por cobrado" },
}

function Accion({ pedir, tipo, cobro, alCerrar, alHecho }) {
  const [nota, setNota] = useState("")
  const [importe, setImporte] = useState(Number(cobro.importe))
  const [fecha, setFecha] = useState(HOY())
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const t = TEXTOS[tipo]
  const hacer = () => {
    setTrabajando(true)
    setError(null)
    const llamada = tipo === "deshacer"
      ? pedir(`${RUTA_COBROS}/anular`, { id: cobro.id, anotacion: nota || null })
      : tipo === "devolucion"
        ? pedir(`${RUTA_COBROS}/devolucion`, { id_cobro_origen: cobro.id, importe: Number(importe), fecha_operacion: fecha, anotacion: nota || null })
        : pedir(`${RUTA_COBROS}/cambiar_estado`, { id: cobro.id, nuevo_estado: 2 })
    llamada.then(alHecho).catch((err) => setError(err.message)).finally(() => setTrabajando(false))
  }
  return (
    <Modal opened onClose={alCerrar} title={t.titulo}>
      <Stack gap="sm">
        <Text fz="sm">{cobro.NombreRazon_receptor} · {formatearImporte(cobro.importe)} · {formatearFecha(cobro.fecha_operacion)}</Text>
        <Text>{t.texto}</Text>
        {tipo === "devolucion" && (
          <Group grow>
            <NumberInput label="Importe devuelto" decimalScale={2} decimalSeparator="," min={0} max={Number(cobro.importe)} value={importe} onChange={setImporte} />
            <TextInput type="date" label="Fecha" value={fecha} onChange={(e) => setFecha(e.currentTarget.value)} />
          </Group>
        )}
        {tipo !== "cobrado" && <TextInput label="Nota" placeholder="Motivo" value={nota} onChange={(e) => setNota(e.currentTarget.value)} />}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button color={t.color} loading={trabajando} onClick={hacer}>{t.boton}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
