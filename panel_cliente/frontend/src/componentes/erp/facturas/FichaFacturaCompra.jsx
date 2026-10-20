import { useElementSize } from "@mantine/hooks"
import { useCallback, useEffect, useState } from "react"
import {
  ActionIcon, Alert, Badge, Button, Group, Loader, Modal, NumberInput, Paper, Select, SimpleGrid, Stack, Switch,
  Table, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { formatearImporte } from "../../../formato"
import { estadoCompra, lista } from "./estados"
import { ABAJO, FIJO } from "./FichaFacturaVenta"

// Ficha de una factura de compra. Se guarda la cabecera y después se
// añaden las líneas (los importes los calcula el SIF). Al aprobarla queda
// lista para la contabilidad (y para el SII, en las empresas que van por
// SII). Enviada al SII no se puede tocar hasta que responda.
const RUTA = "/facturas_recibidas/facturas_recibidas_sii"
const HOY = () => new Date().toISOString().slice(0, 10)
const opcion = (valor, texto) => ({ value: String(valor), label: texto })
const RECTIFICATIVAS = [7, 8, 9, 10, 11]

// El SIF no tiene "obtener" de una factura de compra y su listado no filtra
// por id: se busca por número y proveedor
async function leer(pedir, numero, idEmisor, id) {
  const r = await pedir(`${RUTA}/listar`, { offset: 0, limit: 100, numero_factura: numero, id_emisor: idEmisor })
  return r.registros.find((f) => f.id === id) || null
}

export default function FichaFacturaCompra({ pedir, fila, alVolver }) {
  const [factura, setFactura] = useState(fila)
  const [lineas, setLineas] = useState([])
  const [cab, setCab] = useState(() => cabeceraDe(fila))
  const [listas, setListas] = useState({ proveedores: [], tipos: [], regimenes: [], gastos: [], medios: [] })
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [linea, setLinea] = useState(null)
  const [confirmar, setConfirmar] = useState(null) // "aprobar" | "borrar"

  const id = factura?.id
  const arriba = useElementSize()
  const estado = factura?.id_estado_msif ?? 0
  const editable = estado !== 2

  useEffect(() => {
    const todos = (ruta, cuerpo = {}) => pedir(ruta, { offset: 0, limit: 10000, ...cuerpo }).then((r) => r.registros).catch(() => [])
    Promise.all([
      todos("/obligados/emisores/listar", { limit: 500 }),
      pedir(`${RUTA}/listas/tipos_factura`).then((r) => r.registros).catch(() => []),
      pedir(`${RUTA}/listas/regimenes_iva`).then((r) => r.registros).catch(() => []),
      todos("/maestros/clasificacion_gastos/listar", { limit: 1000 }),
      todos("/maestros/medios_pago/listar"),
    ]).then(([proveedores, tipos, regimenes, gastos, medios]) => setListas({
      proveedores: proveedores.map((p) => opcion(p.id, `${p.NombreRazon}${p.NIF ? ` (${p.NIF})` : ""}`)),
      tipos: tipos.map((t) => opcion(t.id, t.tipo)),
      regimenes: regimenes.map((t) => opcion(t.id, t.regimen)),
      gastos: [opcion(0, "Sin clasificar"), ...gastos.map((g) => opcion(g.id, `${g.descripcion}${g.cuenta_contable ? ` · ${g.cuenta_contable}` : ""}`))],
      medios: [opcion(0, "Ninguno"), ...medios.map((m) => opcion(m.id, m.descripcion))],
    }))
  }, [pedir])

  const recargar = useCallback(async (actual = factura) => {
    if (!actual?.id) return
    setError(null)
    try {
      const [f, d] = await Promise.all([
        leer(pedir, actual.numero_factura, actual.id_emisor, actual.id),
        pedir(`${RUTA}/detalles/listar`, { id_factura: actual.id, offset: 0, limit: 5000 }),
      ])
      if (f) {
        setFactura(f)
        setCab(cabeceraDe(f))
      }
      setLineas(d.registros)
    } catch (err) {
      setError(err.message)
    }
  }, [factura, pedir])
  useEffect(() => { recargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const poner = (campo, valor) => setCab((c) => ({ ...c, [campo]: valor }))

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    setAviso(null)
    try {
      const cuerpo = cuerpoDe(cab)
      if (id) {
        await pedir(`${RUTA}/modificar`, { ...cuerpo, id })
        await recargar({ ...factura, numero_factura: cuerpo.numero_factura, id_emisor: cuerpo.id_emisor })
      } else {
        const { id_tipo_gasto, ...alta } = cuerpo
        const r = await pedir(`${RUTA}/crear`, alta)
        // El tipo de gasto no se puede dar al crearla: va después
        if (id_tipo_gasto) await pedir(`${RUTA}/modificar`, { id: r.id_factura, id_tipo_gasto })
        const nueva = await leer(pedir, alta.numero_factura, alta.id_emisor, r.id_factura)
        await recargar(nueva || { id: r.id_factura, numero_factura: alta.numero_factura, id_emisor: alta.id_emisor })
      }
      setAviso("Guardada.")
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!cab) return <Loader size="sm" />
  const [color, texto] = factura ? estadoCompra(factura) : ["gray", "Nueva"]
  const esRectificativa = RECTIFICATIVAS.includes(Number(cab.id_tipo))

  return (
    <Stack gap="md">
      <Stack gap="xs" style={FIJO} ref={arriba.ref}>
      <Button variant="default" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={alVolver} style={{ alignSelf: "flex-start" }}>
        Volver a las facturas
      </Button>
      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <Title order={3}>{id ? `Factura ${factura.numero_factura}` : "Nueva factura de compra"}</Title>
          <Badge color={color} variant="light">{texto}</Badge>
        </Group>
        <Group gap="xs">
          {editable && <Button variant="default" loading={guardando} onClick={guardar}>Guardar</Button>}
          {id && [0, 6].includes(estado) && <Button onClick={() => setConfirmar("aprobar")} disabled={!lineas.length}>Aprobar</Button>}
          {id && ![2, 3, 4].includes(estado) && <Button color="red" variant="subtle" onClick={() => setConfirmar("borrar")}>Borrar</Button>}
        </Group>
      </Group>
      </Stack>

      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert color="green" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      {estado === 2 && <Alert color="blue">Enviada al SII: no se puede cambiar hasta que llegue la respuesta.</Alert>}
      {[3, 4].includes(estado) && (
        <Alert color="yellow">Ya está en el SII: si la cambias, se le mandará la modificación. El proveedor, el número y la fecha de la factura ya no se pueden cambiar.</Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Select
              {...ABAJO} label="Proveedor" required searchable data={listas.proveedores} value={cab.id_emisor} disabled={!editable}
              onChange={(v) => poner("id_emisor", v)} style={{ gridColumn: "span 2" }}
              description={editable ? "Si no está, dalo de alta en Proveedores" : undefined}
            />
            <TextInput {...ABAJO} label="Número de la factura" required value={cab.numero_factura} disabled={!editable} onChange={(e) => poner("numero_factura", e.currentTarget.value)} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 5 }} spacing="sm">
            <TextInput {...ABAJO} label="Fecha de la factura" type="date" required value={cab.fecha_emision} disabled={!editable} onChange={(e) => poner("fecha_emision", e.currentTarget.value)} />
            <TextInput {...ABAJO} label="Fecha contable" type="date" required value={cab.fecha_contable} disabled={!editable} onChange={(e) => poner("fecha_contable", e.currentTarget.value)} description={editable ? "La del periodo de IVA en que entra" : undefined} />
            <TextInput {...ABAJO} label="Fecha de la operación" type="date" value={cab.fecha_transaccion} disabled={!editable} onChange={(e) => poner("fecha_transaccion", e.currentTarget.value)} />
            <Select {...ABAJO} label="Tipo de factura" data={listas.tipos} value={cab.id_tipo} allowDeselect={false} disabled={!editable} onChange={(v) => poner("id_tipo", v)} />
            <Select {...ABAJO} label="Régimen de IVA" data={listas.regimenes} value={cab.id_clave_regimen} allowDeselect={false} disabled={!editable} onChange={(v) => poner("id_clave_regimen", v)} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
            <Select {...ABAJO} label="Tipo de gasto" searchable data={listas.gastos} value={cab.id_tipo_gasto} disabled={!editable} onChange={(v) => poner("id_tipo_gasto", v)} style={{ gridColumn: "span 2" }} />
            <Select {...ABAJO} label="Medio de pago" data={listas.medios} value={cab.id_medio_pago} disabled={!editable} onChange={(v) => poner("id_medio_pago", v)} />
            <NumberInput {...ABAJO} label="% IRPF" value={cab.irpf} decimalScale={2} decimalSeparator="," min={0} disabled={!editable} onChange={(v) => poner("irpf", v)} />
          </SimpleGrid>
          {esRectificativa && (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Select
                {...ABAJO} label="Cómo rectifica" disabled={!editable} value={cab.TipoRectificativa} onChange={(v) => poner("TipoRectificativa", v)}
                data={[{ value: "I", label: "Por diferencias" }, { value: "S", label: "Por sustitución" }]}
              />
              <TextInput {...ABAJO} label="Factura que rectifica" value={cab.numero_factura_rectificada} disabled={!editable} onChange={(e) => poner("numero_factura_rectificada", e.currentTarget.value)} />
              <TextInput {...ABAJO} label="Fecha de la que rectifica" type="date" value={cab.fecha_emision_rectificada} disabled={!editable} onChange={(e) => poner("fecha_emision_rectificada", e.currentTarget.value)} />
            </SimpleGrid>
          )}
          <TextInput {...ABAJO} label="Descripción" value={cab.descripcion} disabled={!editable} onChange={(e) => poner("descripcion", e.currentTarget.value)} />
        </Stack>
      </Paper>

      {id ? (
        <Lineas alto={arriba.height + 8} lineas={lineas} editable={editable} alEditar={setLinea} alBorrar={async (l) => {
          setError(null)
          try {
            await pedir(`${RUTA}/detalles/eliminar`, { id_detalle: l.id })
            await recargar()
          } catch (err) {
            setError(err.message)
          }
        }} />
      ) : (
        <Text c="dimmed" fz="sm">Guarda la cabecera para añadir las líneas.</Text>
      )}
      {factura && <Totales factura={factura} />}

      {linea && (
        <FichaLinea linea={linea} pedir={pedir} idFactura={id} alCerrar={() => setLinea(null)} alGuardar={async () => { setLinea(null); await recargar() }} />
      )}
      <Confirmacion
        accion={confirmar} pedir={pedir} id={id} alCerrar={() => setConfirmar(null)}
        alHecho={async (accion) => {
          setConfirmar(null)
          if (accion === "borrar") alVolver()
          else await recargar()
        }}
      />
    </Stack>
  )
}

function cabeceraDe(f) {
  const s = (v) => (v === null || v === undefined ? null : String(v))
  const fecha = (v) => (v ? String(v).slice(0, 10) : "")
  if (!f) {
    return {
      id_emisor: null, numero_factura: "", fecha_emision: HOY(), fecha_contable: HOY(), fecha_transaccion: "",
      id_tipo: "0", id_tipo_gasto: "0", id_clave_regimen: "0", id_medio_pago: "0", irpf: 0, descripcion: "",
      TipoRectificativa: "I", numero_factura_rectificada: "", fecha_emision_rectificada: "",
    }
  }
  return {
    id_emisor: s(f.id_emisor), numero_factura: f.numero_factura || "", fecha_emision: fecha(f.fecha_emision),
    fecha_contable: fecha(f.fecha_contable), fecha_transaccion: fecha(f.fecha_transaccion), id_tipo: s(f.id_tipo ?? 0),
    id_tipo_gasto: s(f.id_tipo_gasto ?? 0), id_clave_regimen: s(f.id_clave_regimen ?? 0), id_medio_pago: s(f.id_medio_pago ?? 0),
    irpf: f.irpf ?? 0, descripcion: f.descripcion || "", TipoRectificativa: f.TipoRectificativa || "I",
    numero_factura_rectificada: f.numero_factura_rectificada || "", fecha_emision_rectificada: fecha(f.fecha_emision_rectificada),
  }
}

function cuerpoDe(cab) {
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v))
  const cuerpo = {
    id_emisor: num(cab.id_emisor), numero_factura: cab.numero_factura.trim(), fecha_emision: cab.fecha_emision,
    fecha_contable: cab.fecha_contable, fecha_registro: cab.fecha_contable, fecha_transaccion: cab.fecha_transaccion || null,
    id_tipo: num(cab.id_tipo) ?? 0, id_tipo_gasto: num(cab.id_tipo_gasto) || null, id_clave_regimen: num(cab.id_clave_regimen) ?? 0,
    id_medio_pago: num(cab.id_medio_pago), irpf: num(cab.irpf) ?? 0, descripcion: cab.descripcion || null,
  }
  if (RECTIFICATIVAS.includes(cuerpo.id_tipo)) {
    Object.assign(cuerpo, {
      TipoRectificativa: cab.TipoRectificativa, numero_factura_rectificada: cab.numero_factura_rectificada || null,
      fecha_emision_rectificada: cab.fecha_emision_rectificada || null,
    })
  }
  return cuerpo
}

function Lineas({ alto, lineas, editable, alEditar, alBorrar }) {
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Title order={5}>Líneas</Title>
        {editable && <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => alEditar({})}>Añadir línea</Button>}
      </Group>
      {/* Los nombres de las columnas se quedan debajo de la parte fija de arriba */}
      <Table striped withTableBorder fz="sm" stickyHeader stickyHeaderOffset={alto}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Descripción</Table.Th><Table.Th ta="right">Cantidad</Table.Th><Table.Th ta="right">Precio</Table.Th>
            <Table.Th ta="right">% Dto.</Table.Th><Table.Th ta="right">% IVA</Table.Th><Table.Th ta="right">% Rec.</Table.Th>
            <Table.Th ta="right">Base</Table.Th><Table.Th ta="right">Total</Table.Th>
            {editable && <Table.Th w={70} />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lineas.length ? lineas.map((l) => (
            <Table.Tr key={l.id}>
              <Table.Td>
                {l.descripcion}
                {!!Number(l.isp) && <Badge ml="xs" size="xs" variant="light">Inversión del sujeto pasivo</Badge>}
                {!!Number(l.bien_inversion) && <Badge ml="xs" size="xs" variant="light" color="grape">Bien de inversión</Badge>}
              </Table.Td>
              <Table.Td ta="right">{Number(l.cantidad).toLocaleString("es-ES")}</Table.Td>
              <Table.Td ta="right">{formatearImporte(l.precio_unitario)}</Table.Td>
              <Table.Td ta="right">{Number(l.descuento || 0).toLocaleString("es-ES")}</Table.Td>
              <Table.Td ta="right">{Number(l.iva || 0).toLocaleString("es-ES")}</Table.Td>
              <Table.Td ta="right">{Number(l.re || 0).toLocaleString("es-ES")}</Table.Td>
              <Table.Td ta="right">{formatearImporte(l.importe_base_imponible)}</Table.Td>
              <Table.Td ta="right">{formatearImporte(l.importe_total)}</Table.Td>
              {editable && (
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="Cambiar"><ActionIcon size="sm" variant="subtle" aria-label="Cambiar" onClick={() => alEditar(l)}><IconPencil size={14} /></ActionIcon></Tooltip>
                    <Tooltip label="Quitar"><ActionIcon size="sm" variant="subtle" color="red" aria-label="Quitar" onClick={() => alBorrar(l)}><IconTrash size={14} /></ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          )) : (
            <Table.Tr><Table.Td colSpan={9}><Text c="dimmed" fz="sm">Sin líneas.</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

function Totales({ factura }) {
  const sub = lista(factura.sub_totales)
  return (
    <Group justify="flex-end">
      <Table withTableBorder fz="sm" w="auto">
        <Table.Thead>
          <Table.Tr><Table.Th ta="right">% IVA</Table.Th><Table.Th ta="right">Base</Table.Th><Table.Th ta="right">IVA</Table.Th><Table.Th ta="right">Recargo</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sub.map((t) => (
            <Table.Tr key={`${t.iva}-${t.re}`}>
              <Table.Td ta="right">{t.iva}</Table.Td><Table.Td ta="right">{formatearImporte(t.importe_base_imponible)}</Table.Td>
              <Table.Td ta="right">{formatearImporte(t.importe_iva)}</Table.Td><Table.Td ta="right">{formatearImporte(t.importe_re)}</Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr><Table.Td colSpan={3} ta="right">IVA deducible</Table.Td><Table.Td ta="right">{formatearImporte(factura.CuotaDeducible)}</Table.Td></Table.Tr>
          {Number(factura.importe_irpf) > 0 && (
            <Table.Tr><Table.Td colSpan={3} ta="right">Retención IRPF ({factura.irpf} %)</Table.Td><Table.Td ta="right">−{formatearImporte(factura.importe_irpf)}</Table.Td></Table.Tr>
          )}
          <Table.Tr><Table.Td colSpan={3} ta="right" fw={700}>Total</Table.Td><Table.Td ta="right" fw={700}>{formatearImporte(factura.importe_total)}</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>
    </Group>
  )
}

function FichaLinea({ linea, pedir, idFactura, alCerrar, alGuardar }) {
  const nueva = linea.id === undefined
  const [v, setV] = useState({
    descripcion: linea.descripcion || "", cantidad: linea.cantidad ?? 1, precio_unitario: linea.precio_unitario ?? "",
    descuento: linea.descuento ?? 0, iva: linea.iva ?? 21, re: linea.re ?? 0, isp: Number(linea.isp || 0), bien_inversion: Number(linea.bien_inversion || 0),
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const poner = (k, x) => setV((a) => ({ ...a, [k]: x }))
  const guardar = (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = { ...v, descuento: v.descuento || 0, re: v.re || 0 }
    pedir(`${RUTA}/detalles/${nueva ? "crear" : "modificar"}`, nueva ? { ...cuerpo, id_factura: idFactura } : { ...cuerpo, id: linea.id })
      .then(alGuardar)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }
  return (
    <Modal opened onClose={alCerrar} title={nueva ? "Nueva línea" : "Cambiar línea"} size="lg">
      <form onSubmit={guardar}>
        <Stack gap="sm">
          <Textarea label="Descripción" required autosize minRows={2} value={v.descripcion} onChange={(e) => poner("descripcion", e.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 5 }} spacing="sm">
            <NumberInput label="Cantidad" required decimalScale={4} decimalSeparator="," value={v.cantidad} onChange={(x) => poner("cantidad", x)} />
            <NumberInput label="Precio (sin IVA)" required decimalScale={4} decimalSeparator="," value={v.precio_unitario} onChange={(x) => poner("precio_unitario", x)} />
            <NumberInput label="% Descuento" decimalScale={2} decimalSeparator="," min={0} value={v.descuento} onChange={(x) => poner("descuento", x)} />
            <NumberInput label="% IVA" required decimalScale={2} decimalSeparator="," min={0} value={v.iva} onChange={(x) => poner("iva", x)} />
            <NumberInput label="% Recargo" decimalScale={2} decimalSeparator="," min={0} value={v.re} onChange={(x) => poner("re", x)} />
          </SimpleGrid>
          <Group>
            <Switch label="Inversión del sujeto pasivo" checked={!!v.isp} onChange={(e) => poner("isp", e.currentTarget.checked ? 1 : 0)} />
            <Switch label="Bien de inversión" checked={!!v.bien_inversion} onChange={(e) => poner("bien_inversion", e.currentTarget.checked ? 1 : 0)} />
          </Group>
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>Cancelar</Button>
            <Button type="submit" loading={guardando}>Guardar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

const TEXTOS = {
  aprobar: { titulo: "Aprobar la factura", texto: "Queda lista para la contabilidad (y para enviarla al SII, si la empresa va por SII). Se podrá seguir corrigiendo.", boton: "Aprobar" },
  borrar: { titulo: "Borrar la factura", texto: "Se borra del SIF. No se puede deshacer.", boton: "Borrar", color: "red" },
}

function Confirmacion({ accion, pedir, id, alCerrar, alHecho }) {
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  useEffect(() => setError(null), [accion])
  if (!accion) return null
  const t = TEXTOS[accion]
  const hacer = async () => {
    setTrabajando(true)
    setError(null)
    try {
      if (accion === "aprobar") await pedir(`${RUTA}/aprobar`, { id })
      if (accion === "borrar") await pedir(`${RUTA}/eliminar`, { id, forzar: 0 })
      alHecho(accion)
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(false)
    }
  }
  return (
    <Modal opened onClose={alCerrar} title={t.titulo}>
      <Stack gap="sm">
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
