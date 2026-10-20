import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActionIcon, Alert, Badge, Button, Group, Loader, Menu, Modal, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput,
} from "@mantine/core"
import { IconDots, IconPlus, IconRefresh } from "@tabler/icons-react"
import { MantineReactTable, useMantineReactTable } from "mantine-react-table"
import { CELDA_QUE_CRECE } from "@contabilidad/components/tabla.ts"
import { formatearFecha, formatearImporte } from "../../../formato"
import { opcionesRejilla } from "../rejilla"
import { Confirmar, registros, useClientes, useMedios } from "./comun"
import { RUTA_REMESAS } from "./ruta"

// Remesas automáticas: el SIF arma solo una remesa con los recibos
// domiciliados que vencen pronto, los días y a la hora que se diga. Las
// deja en borrador (para revisarlas en Remesas) y puede darlas por abonadas
// pasados unos días sin devoluciones.
const RUTA = `${RUTA_REMESAS}/programacion`
const SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((d, i) => ({ value: String(i + 1), label: d }))
const MES = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: i === 30 ? "Último día" : String(i + 1) }))
const lista = (texto) => (texto ? String(texto).split(",").map((x) => x.trim()).filter(Boolean) : [])
const cuando = (p) => {
  const dias = [
    ...lista(p.dias_semana).map((d) => SEMANA[Number(d) - 1]?.label.slice(0, 3)),
    ...lista(p.dias_mes).map((d) => (d === "31" ? "último del mes" : `día ${d}`)),
  ].filter(Boolean)
  return `${dias.join(", ") || "—"}${p.hora != null ? ` · ${p.hora}:00` : ""}`
}

export default function RemesasAutomaticas({ pedir }) {
  const medios = useMedios(pedir, true)
  const nombreMedio = useMemo(() => Object.fromEntries((medios || []).map((m) => [m.value, m.label])), [medios])
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [accion, setAccion] = useState(null)

  const cargar = useCallback(() => {
    setFilas(null)
    setError(null)
    pedir(`${RUTA}/listar`, {})
      .then((r) => setFilas(registros(r)))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir])
  useEffect(cargar, [cargar])

  const ejecutar = useCallback((p) => {
    setError(null)
    setAviso(null)
    pedir(`${RUTA}/ejecutar_ahora`, { id: p.id })
      .then(() => { setAviso("Hecho. Si había recibos, la remesa está en borrador en la pestaña Remesas."); cargar() })
      .catch((err) => setError(err.message))
  }, [pedir, cargar])

  const columnas = useMemo(() => [
    { accessorKey: "descripcion", header: "Nombre", grow: true, mantineTableBodyCellProps: CELDA_QUE_CRECE },
    { id: "medio", header: "Cuenta", size: 220, grow: false, accessorFn: (p) => nombreMedio[String(p.id_medio_pago)] || p.id_medio_pago },
    { id: "cuando", header: "Cuándo", size: 220, grow: false, accessorFn: cuando },
    { accessorKey: "dias_antelacion", header: "Antelación", size: 100, grow: false, Cell: ({ cell }) => `${cell.getValue() ?? 0} días` },
    { accessorKey: "fecha_hora_ultima_ejecucion", header: "Última vez", size: 150, grow: false, Cell: ({ cell }) => formatearFecha(cell.getValue()) },
    { accessorKey: "activo", header: "", size: 90, grow: false, Cell: ({ cell }) => <Badge color={cell.getValue() ? "green" : "gray"} variant="light">{cell.getValue() ? "Activa" : "Parada"}</Badge> },
    {
      id: "acciones", header: "", size: 50, grow: false,
      Cell: ({ row }) => (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target><ActionIcon size="sm" variant="subtle" aria-label="Acciones"><IconDots size={15} /></ActionIcon></Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setAccion({ tipo: "editar", prog: row.original })}>Cambiar</Menu.Item>
            <Menu.Item onClick={() => ejecutar(row.original)}>Lanzarla ahora</Menu.Item>
            <Menu.Item onClick={() => setAccion({ tipo: "historial", prog: row.original })}>Ver lo que ha hecho</Menu.Item>
            <Menu.Item color="red" onClick={() => setAccion({ tipo: "borrar", prog: row.original })}>Borrarla</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ], [nombreMedio, ejecutar])

  const tabla = useMantineReactTable({
    ...opcionesRejilla(), columns: columnas, data: filas || [],
    state: { isLoading: filas === null },
    localization: { noRecordsToDisplay: "No hay remesas automáticas." },
  })

  const cerrar = () => setAccion(null)
  const hecho = () => { setAccion(null); cargar() }
  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Group gap="sm">
        <Button leftSection={<IconPlus size={15} />} onClick={() => setAccion({ tipo: "editar", prog: {} })}>Nueva remesa automática</Button>
        <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={cargar}>Refrescar</Button>
      </Group>
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert color="green" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      <MantineReactTable table={tabla} />
      {accion?.tipo === "editar" && <Ficha pedir={pedir} medios={medios || []} prog={accion.prog} alCerrar={cerrar} alHecho={hecho} />}
      {accion?.tipo === "historial" && <Historial pedir={pedir} prog={accion.prog} alCerrar={cerrar} />}
      {accion?.tipo === "borrar" && (
        <Confirmar
          titulo="Borrar la remesa automática" boton="Borrar" color="red" alCerrar={cerrar} alHecho={hecho}
          texto="Deja de hacerse. Las remesas que ya creó no se tocan." detalle={accion.prog.descripcion}
          hacer={() => pedir(`${RUTA}/eliminar`, { id: accion.prog.id })}
        />
      )}
    </Stack>
  )
}

function Ficha({ pedir, medios, prog, alCerrar, alHecho }) {
  const clientes = useClientes(pedir)
  const nueva = prog.id === undefined
  const [v, setV] = useState({
    descripcion: prog.descripcion || "", activo: prog.activo ?? true,
    id_medio_pago: prog.id_medio_pago ? String(prog.id_medio_pago) : medios.length === 1 ? medios[0].value : null,
    dias_semana: lista(prog.dias_semana), dias_mes: lista(prog.dias_mes), hora: prog.hora ?? 8,
    dias_antelacion: prog.dias_antelacion ?? 5, importe_minimo: prog.importe_minimo ?? 0,
    ids_receptores_excluidos: (Array.isArray(prog.ids_receptores_excluidos) ? prog.ids_receptores_excluidos : lista(prog.ids_receptores_excluidos)).map(String),
    generar_fichero: prog.generar_fichero ?? false, dias_abono_automatico: prog.dias_abono_automatico ?? 0, email_aviso: prog.email_aviso || "",
  })
  const poner = (k, x) => setV((a) => ({ ...a, [k]: x }))
  const cuerpo = () => ({
    descripcion: v.descripcion || null, activo: !!v.activo, id_medio_pago: Number(v.id_medio_pago),
    dias_semana: v.dias_semana.join(",") || null, dias_mes: v.dias_mes.join(",") || null, hora: Number(v.hora),
    dias_antelacion: Number(v.dias_antelacion) || 0, importe_minimo: Number(v.importe_minimo) || 0,
    ids_receptores_excluidos: v.ids_receptores_excluidos.map(Number), generar_fichero: !!v.generar_fichero,
    dias_abono_automatico: Number(v.dias_abono_automatico) || 0, email_aviso: v.email_aviso || null,
  })
  return (
    <Confirmar
      titulo={nueva ? "Nueva remesa automática" : "Cambiar la remesa automática"} boton="Guardar" alCerrar={alCerrar} alHecho={alHecho}
      hacer={() => !v.id_medio_pago ? Promise.reject(new Error("Elige la cuenta que cobra"))
        : !v.dias_semana.length && !v.dias_mes.length ? Promise.reject(new Error("Elige algún día"))
          : pedir(`${RUTA}/${nueva ? "crear" : "modificar"}`, nueva ? cuerpo() : { ...cuerpo(), id: prog.id })}
    >
      <TextInput label="Nombre" placeholder="Remesa de los lunes" value={v.descripcion} onChange={(e) => poner("descripcion", e.currentTarget.value)} />
      <Select label="Cuenta que cobra" required data={medios} value={v.id_medio_pago} onChange={(x) => poner("id_medio_pago", x)} />
      <SimpleGrid cols={2} spacing="sm">
        <MultiSelect label="Días de la semana" data={SEMANA} value={v.dias_semana} onChange={(x) => poner("dias_semana", x)} clearable />
        <MultiSelect label="Días del mes" data={MES} value={v.dias_mes} onChange={(x) => poner("dias_mes", x)} clearable />
        <NumberInput label="A partir de la hora" min={0} max={23} value={v.hora} onChange={(x) => poner("hora", x)} />
        <NumberInput label="Recibos que vencen en los próximos (días)" min={0} max={90} value={v.dias_antelacion} onChange={(x) => poner("dias_antelacion", x)} />
        <NumberInput label="Solo si suma al menos" decimalScale={2} decimalSeparator="," min={0} value={v.importe_minimo} onChange={(x) => poner("importe_minimo", x)} />
        <NumberInput label="Darla por abonada a los (días, 0 = no)" min={0} max={90} value={v.dias_abono_automatico} onChange={(x) => poner("dias_abono_automatico", x)} />
      </SimpleGrid>
      <MultiSelect label="Clientes que no entran" searchable data={clientes} value={v.ids_receptores_excluidos} onChange={(x) => poner("ids_receptores_excluidos", x)} />
      <TextInput label="Avisar por email a" value={v.email_aviso} onChange={(e) => poner("email_aviso", e.currentTarget.value)} />
      <Group>
        <Switch label="Sacar también el fichero para el banco" checked={!!v.generar_fichero} onChange={(e) => poner("generar_fichero", e.currentTarget.checked)} />
        <Switch label="Activa" checked={!!v.activo} onChange={(e) => poner("activo", e.currentTarget.checked)} />
      </Group>
    </Confirmar>
  )
}

function Historial({ pedir, prog, alCerrar }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    pedir(`${RUTA}/ejecuciones/listar`, { id_programacion: prog.id, offset: 0, limit: 200 })
      .then((r) => setFilas(registros(r)))
      .catch((err) => {
        setFilas([])
        setError(err.message)
      })
  }, [pedir, prog.id])
  return (
    <Modal opened onClose={alCerrar} title={`Lo que ha hecho · ${prog.descripcion || ""}`} size="lg">
      {error && <Alert color="red">{error}</Alert>}
      {filas === null ? <Loader size="sm" /> : !filas.length ? <Text c="dimmed" fz="sm">Todavía no se ha lanzado.</Text> : (
        <Table withTableBorder fz="sm">
          <Table.Thead><Table.Tr><Table.Th>Cuándo</Table.Th><Table.Th>Resultado</Table.Th><Table.Th ta="right">Recibos</Table.Th><Table.Th ta="right">Importe</Table.Th><Table.Th>Remesa</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {filas.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>{formatearFecha(e.fecha_hora)}{e.manual ? " (a mano)" : ""}</Table.Td>
                <Table.Td>{e.resultado}{e.detalle ? <Text fz="xs" c="dimmed">{String(e.detalle).slice(0, 200)}</Text> : null}</Table.Td>
                <Table.Td ta="right">{e.recibos_incluidos ?? ""}</Table.Td>
                <Table.Td ta="right">{e.importe != null ? formatearImporte(e.importe) : ""}</Table.Td>
                <Table.Td>{e.id_remesa || ""}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Modal>
  )
}
