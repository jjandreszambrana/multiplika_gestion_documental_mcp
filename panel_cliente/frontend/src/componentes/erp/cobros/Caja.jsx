import { useCallback, useEffect, useMemo, useState } from "react"
import { ActionIcon, Alert, Badge, Button, Group, Loader, NumberInput, SegmentedControl, Select, Stack, Table, Text, TextInput, Tooltip } from "@mantine/core"
import { IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE } from "@contabilidad/components/tabla.ts"
import { formatearFecha, formatearImporte } from "../../../formato"
import { DERECHA, opcionesRejilla } from "../rejilla"
import { Confirmar, HOY, registros } from "./comun"
import { RUTA_COBROS } from "./ruta"

// La caja: los movimientos de efectivo que no son cobros (apertura, entradas,
// salidas, retiradas, cierre) y los arqueos, que cuadran lo cobrado hasta
// una fecha y dejan esos cobros cerrados.
const TIPOS = {
  APERTURA: ["blue", "Apertura"],
  ENTRADA: ["green", "Entrada"],
  SALIDA: ["orange", "Salida"],
  RETIRADA: ["red", "Retirada"],
  CIERRE: ["dark", "Cierre"],
}
const INICIO_MES = () => `${HOY().slice(0, 8)}01`

export default function Caja({ pedir }) {
  const [vista, setVista] = useState("movimientos")
  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <SegmentedControl
        style={{ alignSelf: "flex-start" }} value={vista} onChange={setVista}
        data={[{ value: "movimientos", label: "Movimientos" }, { value: "arqueos", label: "Arqueos" }]}
      />
      {vista === "movimientos" ? <Movimientos pedir={pedir} /> : <Arqueos pedir={pedir} />}
    </Stack>
  )
}

function Movimientos({ pedir }) {
  const [desde, setDesde] = useState(INICIO_MES())
  const [hasta, setHasta] = useState("")
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [accion, setAccion] = useState(null)

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    const cuerpo = { offset: 0, limit: 5000, orden: "id DESC" }
    if (desde) cuerpo.fecha_desde = desde
    if (hasta) cuerpo.fecha_hasta = hasta
    pedir(`${RUTA_COBROS}/caja/listar`, cuerpo)
      .then((r) => setFilas(registros(r)))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir, desde, hasta])
  useEffect(cargar, [cargar])

  const columnas = useMemo(() => [
    { accessorKey: "fecha_hora_registro", header: "Fecha", size: 160, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    {
      accessorKey: "tipo", header: "Tipo", size: 120, grow: false,
      Cell: ({ cell }) => {
        const [color, txt] = TIPOS[cell.getValue()] || ["gray", cell.getValue()]
        return <Badge color={color} variant="light">{txt}</Badge>
      },
    },
    { accessorKey: "importe", header: "Importe", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "anotacion", header: "Nota", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE },
    {
      id: "acciones", header: "", size: 50, grow: false,
      Cell: ({ row }) => !row.original.id_arqueo && (
        <Tooltip label="Borrar">
          <ActionIcon size="sm" variant="subtle" color="red" aria-label="Borrar" onClick={() => setAccion({ tipo: "borrar", mov: row.original })}><IconTrash size={14} /></ActionIcon>
        </Tooltip>
      ),
    },
  ], [])

  const tabla = useMantineReactTable({
    ...opcionesRejilla(), columns: columnas, data: filas || [],
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: "No hay movimientos de caja en estas fechas." },
  })

  const hecho = () => { setAccion(null); cargar() }
  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group align="flex-end" gap="sm">
        <TextInput type="date" label="Desde" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
        <TextInput type="date" label="Hasta" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
        <Button leftSection={<IconPlus size={15} />} onClick={() => setAccion({ tipo: "nuevo" })}>Anotar movimiento</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
      {accion?.tipo === "nuevo" && <NuevoMovimiento pedir={pedir} alCerrar={() => setAccion(null)} alHecho={hecho} />}
      {accion?.tipo === "borrar" && (
        <Confirmar
          titulo="Borrar el movimiento" boton="Borrar" color="red" alCerrar={() => setAccion(null)} alHecho={hecho}
          detalle={`${TIPOS[accion.mov.tipo]?.[1] || accion.mov.tipo} · ${formatearImporte(accion.mov.importe)}`}
          hacer={() => pedir(`${RUTA_COBROS}/caja/eliminar`, { id: accion.mov.id })}
        />
      )}
    </Stack>
  )
}

function NuevoMovimiento({ pedir, alCerrar, alHecho }) {
  const [tipo, setTipo] = useState("ENTRADA")
  const [importe, setImporte] = useState("")
  const [nota, setNota] = useState("")
  return (
    <Confirmar
      titulo="Anotar movimiento de caja" boton="Anotar" alCerrar={alCerrar} alHecho={alHecho}
      hacer={() => Number(importe) > 0
        ? pedir(`${RUTA_COBROS}/caja/crear`, { tipo, importe: Number(importe), anotacion: nota || null, id_arqueo: null, id_zona: null })
        : Promise.reject(new Error("Pon el importe"))}
    >
      <Group grow>
        <Select label="Tipo" data={Object.entries(TIPOS).map(([v, [, t]]) => ({ value: v, label: t }))} value={tipo} onChange={setTipo} allowDeselect={false} />
        <NumberInput label="Importe" required decimalScale={2} decimalSeparator="," min={0} value={importe} onChange={setImporte} />
      </Group>
      <TextInput label="Nota" placeholder="Para qué" value={nota} onChange={(e) => setNota(e.currentTarget.value)} />
    </Confirmar>
  )
}

function Arqueos({ pedir }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [accion, setAccion] = useState(null)

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    pedir(`${RUTA_COBROS}/arqueos/listar`, { offset: 0, limit: 2000, orden: "id DESC" })
      .then((r) => setFilas(registros(r)))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir])
  useEffect(cargar, [cargar])

  const columnas = useMemo(() => [
    { accessorKey: "fecha_hora_registro", header: "Fecha", size: 160, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { id: "medio", header: "Medio", size: 160, grow: false, accessorFn: (f) => f.descripcion_medio_pago || f.medio_pago_descripcion || "" },
    { accessorKey: "importe", header: "Cobrado", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "importe_dispuesto", header: "Dispuesto", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "importe_ingresado", header: "A ingresar", size: 120, grow: false, ...DERECHA, Cell: ({ cell }) => formatearImporte(cell.getValue()) },
    { accessorKey: "anotacion", header: "Nota", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE },
    {
      id: "acciones", header: "", size: 50, grow: false,
      Cell: ({ row }) => (
        <Tooltip label="Deshacer el arqueo">
          <ActionIcon size="sm" variant="subtle" color="red" aria-label="Deshacer" onClick={() => setAccion({ tipo: "borrar", arqueo: row.original })}><IconTrash size={14} /></ActionIcon>
        </Tooltip>
      ),
    },
  ], [])

  const tabla = useMantineReactTable({
    ...opcionesRejilla(), columns: columnas, data: filas || [],
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: "Todavía no hay arqueos." },
  })

  const hecho = () => { setAccion(null); cargar() }
  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group gap="sm">
        <Button leftSection={<IconPlus size={15} />} onClick={() => setAccion({ tipo: "nuevo" })}>Hacer arqueo</Button>
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <MantineReactTable table={tabla} />
      {accion?.tipo === "nuevo" && <NuevoArqueo pedir={pedir} alCerrar={() => setAccion(null)} alHecho={hecho} />}
      {accion?.tipo === "borrar" && (
        <Confirmar
          titulo="Deshacer el arqueo" boton="Deshacer" color="red" alCerrar={() => setAccion(null)} alHecho={hecho}
          texto="Se borra el arqueo y sus cobros vuelven a quedar sin arquear (y se pueden volver a tocar)."
          detalle={`${formatearFecha(accion.arqueo.fecha_hora_registro)} · ${formatearImporte(accion.arqueo.importe)}`}
          hacer={() => pedir(`${RUTA_COBROS}/arqueos/eliminar`, { id: accion.arqueo.id, desvincular_cobros: 1 })}
        />
      )}
    </Stack>
  )
}

function NuevoArqueo({ pedir, alCerrar, alHecho }) {
  const [hasta, setHasta] = useState(HOY())
  const [nota, setNota] = useState("")
  const [previa, setPrevia] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => {
    setCargando(true)
    setError(null)
    pedir(`${RUTA_COBROS}/arqueos/previsualizar`, { hasta_fecha: hasta })
      .then((r) => setPrevia(registros(r)))
      .catch((err) => {
        setPrevia([])
        setError(err.message)
      })
      .finally(() => setCargando(false))
  }, [pedir, hasta])
  return (
    <Confirmar
      titulo="Hacer arqueo" boton="Hacer el arqueo" alCerrar={alCerrar} alHecho={alHecho}
      texto="Cuadra lo cobrado hasta esa fecha. Los cobros que entran quedan cerrados: para corregirlos habrá que deshacer el arqueo."
      hacer={() => pedir(`${RUTA_COBROS}/arqueos/crear`, { hasta_fecha: hasta, anotacion: nota || null })}
    >
      <TextInput type="date" label="Hasta el día" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
      {cargando ? <Loader size="sm" /> : error ? <Alert color="red">{error}</Alert> : !previa?.length ? (
        <Text c="dimmed" fz="sm">No hay cobros sin arquear hasta ese día.</Text>
      ) : (
        <Table withTableBorder fz="sm">
          <Table.Thead><Table.Tr><Table.Th>Medio</Table.Th><Table.Th ta="right">Cobrado</Table.Th><Table.Th ta="right">Dispuesto</Table.Th><Table.Th ta="right">A ingresar</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {previa.map((p, i) => (
              <Table.Tr key={i}>
                <Table.Td>{p.descripcion_medio_pago}</Table.Td>
                <Table.Td ta="right">{formatearImporte(p.importe)}</Table.Td>
                <Table.Td ta="right">{formatearImporte(p.importe_dispuesto)}</Table.Td>
                <Table.Td ta="right">{formatearImporte(p.importe_ingresado)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <TextInput label="Nota" value={nota} onChange={(e) => setNota(e.currentTarget.value)} />
    </Confirmar>
  )
}
