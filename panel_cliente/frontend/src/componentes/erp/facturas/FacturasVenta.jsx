import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Badge, Button, Group, SegmentedControl, Stack, TextInput, Title } from "@mantine/core"
import { IconPlus, IconRefresh } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE, opcionesDeTabla } from "@contabilidad/components/tabla.ts"
import { api } from "../../../api"
import { formatearFecha, formatearImporte } from "../../../formato"
import FichaFacturaVenta from "./FichaFacturaVenta"
import { estadoFactura } from "./estados"

// Facturas de venta (Verifactu) de la empresa: las del SIF salen de sus
// borradores, que guardan también las ya emitidas (id_estado_msif 1) con el
// estado de su envío a la AEAT. Se abren en su ficha.
const RUTA = "/facturas_emitidas_borradores"
const ANIO = new Date().getFullYear()

export default function FacturasVenta({ proyecto, empresa }) {
  const pedir = useCallback(
    (ruta, cuerpo) => api.erpSif(proyecto.id, empresa.id_empresa, ruta, cuerpo),
    [proyecto.id, empresa.id_empresa],
  )
  const [desde, setDesde] = useState(`${ANIO}-01-01`)
  const [hasta, setHasta] = useState("")
  const [cuales, setCuales] = useState("todas")
  const [cliente, setCliente] = useState("")
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  // id del borrador, "nueva" o { rectifica: factura emitida }
  const [abierta, setAbierta] = useState(null)

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    const cuerpo = {
      offset: 0, limit: 5000, orden: "fecha_emision DESC",
      id_estado_borrador: { op: "in", valor: cuales === "borradores" ? [0] : cuales === "emitidas" ? [1] : [0, 1] },
    }
    if (desde) cuerpo.desde_fecha = desde
    if (hasta) cuerpo.hasta_fecha = hasta
    if (cliente.trim()) cuerpo.NombreRazon_receptor = { op: "like", valor: `%${cliente.trim()}%` }
    pedir(`${RUTA}/listar`, cuerpo)
      .then((r) => setFilas(r.registros))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir, desde, hasta, cuales, cliente])
  useEffect(cargar, [cargar])

  const columnas = useMemo(() => [
    { accessorKey: "numero_factura", header: "Número", size: 140, grow: false, Cell: ({ row }) => (row.original.id_estado_msif ? row.original.numero_factura : "—") },
    { accessorKey: "fecha_emision", header: "Fecha", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "NombreRazon_receptor", header: "Cliente", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE },
    { accessorKey: "NIF_receptor", header: "NIF", size: 110, grow: false },
    { accessorKey: "descripcion_abreviada_tipo_factura", header: "Tipo", size: 70, grow: false },
    {
      accessorKey: "importe_total", header: "Total", size: 120, grow: false,
      mantineTableBodyCellProps: { align: "right" }, mantineTableHeadCellProps: { align: "right" },
      Cell: ({ cell }) => formatearImporte(cell.getValue()),
    },
    {
      id: "estado", header: "Estado", size: 190, grow: false,
      Cell: ({ row }) => {
        const [color, texto] = estadoFactura(row.original)
        return <Badge color={color} variant="light">{texto}</Badge>
      },
    },
  ], [])

  const tabla = useMantineReactTable({
    ...opcionesDeTabla(),
    columns: columnas,
    data: filas || [],
    enablePagination: false,
    enableBottomToolbar: false,
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: "No hay facturas con estos filtros." },
    mantineTableBodyRowProps: ({ row }) => ({ onClick: () => setAbierta(row.original.id), style: { cursor: "pointer" } }),
  })

  if (abierta !== null) {
    return (
      <FichaFacturaVenta
        key={typeof abierta === "object" ? `rectifica-${abierta.rectifica.id}` : abierta}
        proyecto={proyecto} empresa={empresa} pedir={pedir}
        idBorrador={typeof abierta === "number" ? abierta : null}
        rectifica={typeof abierta === "object" ? abierta.rectifica : null}
        alAbrir={setAbierta}
        alVolver={() => { setAbierta(null); cargar() }}
      />
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Facturas de venta</Title>
        <Button leftSection={<IconPlus size={15} />} onClick={() => setAbierta("nueva")}>Nueva factura</Button>
      </Group>
      <Group align="flex-end" gap="sm">
        <TextInput type="date" label="Desde" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
        <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
        <TextInput label="Cliente" placeholder="Nombre o parte" value={cliente} onChange={(e) => setCliente(e.currentTarget.value)} />
        <SegmentedControl
          value={cuales} onChange={setCuales}
          data={[{ value: "todas", label: "Todas" }, { value: "borradores", label: "Borradores" }, { value: "emitidas", label: "Emitidas" }]}
        />
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
    </Stack>
  )
}
