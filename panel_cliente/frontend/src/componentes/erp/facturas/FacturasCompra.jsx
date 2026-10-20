import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Badge, Button, Group, Select, Stack, TextInput, Title } from "@mantine/core"
import { IconPlus, IconRefresh } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE, opcionesDeTabla } from "@contabilidad/components/tabla.ts"
import { api } from "../../../api"
import { formatearFecha, formatearImporte } from "../../../formato"
import FichaFacturaCompra from "./FichaFacturaCompra"
import { ESTADOS_COMPRA, estadoCompra } from "./estados"

// Facturas de compra (las recibidas de proveedores) de la empresa. Se
// filtran por la fecha contable, que es la que manda en el IVA y en la
// contabilidad, y se abren en su ficha.
export const RUTA_COMPRAS = "/facturas_recibidas/facturas_recibidas_sii"
const ANIO = new Date().getFullYear()

export default function FacturasCompra({ proyecto, empresa }) {
  const pedir = useCallback(
    (ruta, cuerpo) => api.erpSif(proyecto.id, empresa.id_empresa, ruta, cuerpo),
    [proyecto.id, empresa.id_empresa],
  )
  const [desde, setDesde] = useState(`${ANIO}-01-01`)
  const [hasta, setHasta] = useState("")
  const [estado, setEstado] = useState(null)
  const [proveedor, setProveedor] = useState("")
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [abierta, setAbierta] = useState(null) // la fila del listado, o "nueva"

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    const cuerpo = { offset: 0, limit: 5000, orden: "fecha_contable DESC, id DESC" }
    if (desde) cuerpo.desde_fecha_contable = desde
    if (hasta) cuerpo.hasta_fecha_contable = hasta
    if (estado !== null) cuerpo.id_estado_msif = Number(estado)
    if (proveedor.trim()) cuerpo.NombreRazon_emisor = { op: "like", valor: `%${proveedor.trim()}%` }
    pedir(`${RUTA_COMPRAS}/listar`, cuerpo)
      .then((r) => setFilas(r.registros))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir, desde, hasta, estado, proveedor])
  useEffect(cargar, [cargar])

  const derecha = { mantineTableBodyCellProps: { align: "right" }, mantineTableHeadCellProps: { align: "right" } }
  const columnas = useMemo(() => [
    { accessorKey: "numero_factura", header: "Número", size: 140, grow: false },
    { accessorKey: "fecha_emision", header: "Fecha", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "fecha_contable", header: "Contable", size: 100, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "NombreRazon_emisor", header: "Proveedor", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE },
    { accessorKey: "NIF_emisor", header: "NIF", size: 110, grow: false },
    { accessorKey: "clave_tipo", header: "Tipo", size: 60, grow: false },
    { accessorKey: "importe_base_imponible", header: "Base", size: 110, grow: false, ...derecha, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "importe_total", header: "Total", size: 110, grow: false, ...derecha, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    {
      id: "estado", header: "Estado", size: 170, grow: false,
      Cell: ({ row }) => {
        const [color, texto] = estadoCompra(row.original)
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
    mantineTableBodyRowProps: ({ row }) => ({ onClick: () => setAbierta(row.original), style: { cursor: "pointer" } }),
  })

  if (abierta !== null) {
    return (
      <FichaFacturaCompra
        key={abierta === "nueva" ? "nueva" : abierta.id}
        pedir={pedir} fila={abierta === "nueva" ? null : abierta}
        alAbrir={setAbierta}
        alVolver={() => { setAbierta(null); cargar() }}
      />
    )
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Facturas de compra</Title>
        <Button leftSection={<IconPlus size={15} />} onClick={() => setAbierta("nueva")}>Nueva factura</Button>
      </Group>
      <Group align="flex-end" gap="sm">
        <TextInput type="date" label="Contable desde" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
        <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
        <TextInput label="Proveedor" placeholder="Nombre o parte" value={proveedor} onChange={(e) => setProveedor(e.currentTarget.value)} />
        <Select
          label="Estado" placeholder="Todos" clearable value={estado} onChange={setEstado} w={200}
          data={Object.entries(ESTADOS_COMPRA).map(([valor, [, texto]]) => ({ value: valor, label: texto }))}
        />
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
    </Stack>
  )
}
