import { useElementSize } from "@mantine/hooks"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Button, Group, Loader, Modal, NumberInput, Paper, Select, SimpleGrid, Stack, Switch,
  Table, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconFileTypePdf, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { api } from "../../../api"
import { formatearFecha, formatearImporte } from "../../../formato"
import { estadoFactura, SERIES_RECTIFICATIVAS, TIPO_POR_SERIE, lista } from "./estados"

// Ficha de una factura de venta Verifactu. En borrador se edita todo
// (cabecera y líneas; los importes los calcula el SIF); al emitirla el SIF la
// numera, le pone la fecha de hoy y la manda a la AEAT, y ya solo se puede
// ver, sacar en PDF, cambiar la nota, rectificar o anular.
const RUTA = "/facturas_emitidas_borradores"
const HOY = () => new Date().toISOString().slice(0, 10)
const opcion = (valor, texto) => ({ value: String(valor), label: texto })
// Las leyendas debajo de la casilla: así las casillas de una fila quedan a la
// misma altura aunque unas tengan leyenda y otras no
export const FIJO = { position: "sticky", top: 0, zIndex: 30, background: "var(--mantine-color-body)", paddingBottom: 8 }
export const ABAJO = { inputWrapperOrder: ["label", "input", "description", "error"] }

export default function FichaFacturaVenta({ proyecto, empresa, pedir, idBorrador, rectifica, alAbrir, alVolver }) {
  const [id, setId] = useState(idBorrador)
  const [factura, setFactura] = useState(null)
  const [lineas, setLineas] = useState([])
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [listas, setListas] = useState({ clientes: [], series: [], formas: [], medios: [], iva: [], tipos: [] })
  const [establecimientos, setEstablecimientos] = useState([])
  const [cab, setCab] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [linea, setLinea] = useState(null) // la que se edita ({} = nueva)
  const [confirmar, setConfirmar] = useState(null) // "emitir" | "borrar" | "anular"

  const emitida = !!factura?.id_estado_msif
  const arriba = useElementSize()

  // Las listas de la cabecera
  useEffect(() => {
    const todos = (ruta, cuerpo = {}) => pedir(ruta, { offset: 0, limit: 10000, ...cuerpo }).then((r) => r.registros).catch(() => [])
    Promise.all([
      todos("/obligados/receptores/listar"),
      todos("/maestros/series/listar"),
      todos("/maestros/formas_pago/listar"),
      todos("/maestros/medios_pago/listar"),
      pedir(`${RUTA}/listas/tipos_iva`).then((r) => r.registros).catch(() => ["0", "4", "10", "21"].map((tipo) => ({ tipo }))),
      pedir(`${RUTA}/listas/tipos_facturas`).then((r) => r.registros).catch(() => []),
    ]).then(([clientes, series, formas, medios, iva, tipos]) => setListas({
      clientes: clientes.map((c) => opcion(c.id, `${c.NombreRazon}${c.NIF ? ` (${c.NIF})` : ""}`)),
      series,
      formas: [opcion(0, "Ninguna"), ...formas.map((f) => opcion(f.id, f.descripcion))],
      medios: [opcion(0, "Ninguno"), ...medios.map((m) => opcion(m.id, m.descripcion))],
      iva: iva.map((t) => opcion(t.tipo, `${t.tipo} %`)),
      tipos,
    }))
  }, [pedir])

  const cargar = useCallback(() => {
    if (!id) return
    setError(null)
    Promise.all([
      pedir(`${RUTA}/listar`, { offset: 0, limit: 1, id, id_estado_borrador: { op: "in", valor: [0, 1] } }),
      pedir(`${RUTA}/detalle/listar`, { id_factura: { op: "=", valor: id }, offset: 0, limit: 5000 }),
    ])
      .then(([f, d]) => {
        const fila = f.registros[0]
        setFactura(fila)
        setLineas(d.registros)
        setCab(cabeceraDe(fila))
      })
      .catch((err) => setError(err.message))
  }, [id, pedir])
  useEffect(cargar, [cargar])

  // Una guardada trae el texto de su serie: se busca su id en la lista
  useEffect(() => {
    if (!cab || cab.id_serie || !cab.serie) return
    const s = listas.series.find((x) => x.serie === cab.serie)
    if (s) setCab((c) => ({ ...c, id_serie: String(s.id) }))
  }, [cab, listas.series])

  // Nueva (o rectificativa de una emitida): cabecera de partida
  useEffect(() => {
    if (id || cab || (rectifica && !listas.series.length)) return
    const serie = rectifica && listas.series.find((s) => SERIES_RECTIFICATIVAS.includes(s.id_tipo_serie) && (rectifica.id_tipo === 1) === (s.id_tipo_serie === 4))
    setCab({
      id_receptor: rectifica ? String(rectifica.id_receptor) : null,
      id_serie: serie ? String(serie.id) : null,
      fecha_emision: HOY(), fecha_transaccion: "", descripcion: rectifica ? `Rectifica la factura ${rectifica.numero_factura}` : "",
      id_forma_pago: "0", id_medio_pago: "0", descuento_comercial: 0, descuento_pp: 0, irpf: 0,
      referencia_obligado: "", nota_factura: "", id_establecimiento_entrega: null,
      id_tipo: serie ? String(TIPO_POR_SERIE[serie.id_tipo_serie]) : null,
      TipoRectificativa: rectifica ? "I" : null, uuid_relacionada: rectifica?.uuid || null, rectificativa_no_relacionada: 0,
    })
  }, [id, cab, rectifica, listas.series])

  // Los establecimientos del cliente elegido
  useEffect(() => {
    if (!cab?.id_receptor) return setEstablecimientos([])
    pedir("/obligados/receptores/establecimientos/listar", { id_receptor: Number(cab.id_receptor), offset: 0, limit: 1000 })
      .then((r) => setEstablecimientos(r.registros.map((e) => opcion(e.id, e.descripcion))))
      .catch(() => setEstablecimientos([]))
  }, [pedir, cab?.id_receptor])

  const serie = listas.series.find((s) => String(s.id) === cab?.id_serie)
  const esRectificativa = serie && SERIES_RECTIFICATIVAS.includes(serie.id_tipo_serie)
  const tiposDeSerie = useMemo(
    () => listas.tipos.filter((t) => serie?.id_tipo_serie === 1 ? [3, 4, 5, 6].includes(t.id) : t.id === TIPO_POR_SERIE[serie?.id_tipo_serie]),
    [listas.tipos, serie],
  )
  const poner = (campo, valor) => setCab((c) => ({ ...c, [campo]: valor }))
  const elegirSerie = (valor) => {
    const s = listas.series.find((x) => String(x.id) === valor)
    setCab((c) => ({ ...c, id_serie: valor, id_tipo: s ? String(TIPO_POR_SERIE[s.id_tipo_serie]) : null }))
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    setAviso(null)
    try {
      const cuerpo = cuerpoDe(cab, serie)
      if (id) {
        await pedir(`${RUTA}/modificar`, { ...cuerpo, id })
        cargar()
      } else {
        const r = await pedir(`${RUTA}/crear`, cuerpo)
        setId(r.id_factura)
        alAbrir?.(r.id_factura)
      }
      setAviso("Guardada.")
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const pdf = async () => {
    setError(null)
    try {
      const { blob } = emitida
        ? await api.erpSifDescarga(proyecto.id, empresa.id_empresa, "/facturas_emitidas/print_pdf/download", { list_ids: [factura.id_factura_emitida] })
        : await api.erpSifDescarga(proyecto.id, empresa.id_empresa, `${RUTA}/print_pdf/download`, { list_ids: [id] })
      window.open(URL.createObjectURL(blob), "_blank")
    } catch (err) {
      setError(err.message)
    }
  }

  const rectificar = async () => {
    setError(null)
    try {
      const r = await pedir("/facturas_emitidas/obtener", { id: factura.id_factura_emitida })
      const original = r.registros?.[0] || r
      alAbrir?.({ rectifica: { ...original, id_receptor: factura.id_receptor } })
    } catch (err) {
      setError(err.message)
    }
  }

  const volver = (
    <Button variant="default" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={alVolver} style={{ alignSelf: "flex-start" }}>
      Volver a las facturas
    </Button>
  )
  if ((id && !factura) || !cab) {
    return <Stack gap="md">{volver}{error ? <Alert color="red">{error}</Alert> : <Loader size="sm" />}</Stack>
  }

  const [color, texto] = factura ? estadoFactura(factura) : ["gray", "Nueva"]
  const editable = !emitida

  return (
    <Stack gap="md">
      {/* Lo de arriba (volver, título y botones) no se va con el scroll */}
      <Stack gap="xs" style={FIJO} ref={arriba.ref}>
      {volver}
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Group gap="sm">
            <Title order={3}>{emitida ? `Factura ${factura.numero_factura}` : rectifica ? "Nueva rectificativa" : id ? "Borrador de factura" : "Nueva factura"}</Title>
            <Badge color={color} variant="light">{texto}</Badge>
          </Group>
          {emitida && <Text fz="sm" c="dimmed">{factura.descripcion_tipo_factura} · {formatearFecha(factura.fecha_emision)}</Text>}
        </Stack>
        <Group gap="xs">
          {id && <Button variant="default" leftSection={<IconFileTypePdf size={15} />} onClick={pdf}>{emitida ? "PDF" : "Vista previa"}</Button>}
          {editable && <Button variant="default" loading={guardando} onClick={guardar}>Guardar</Button>}
          {editable && id && <Button onClick={() => setConfirmar("emitir")} disabled={!lineas.length}>Emitir</Button>}
          {editable && id && <Button color="red" variant="subtle" onClick={() => setConfirmar("borrar")}>Borrar borrador</Button>}
          {emitida && !factura.anulada && <Button variant="default" onClick={rectificar}>Rectificar</Button>}
          {emitida && !factura.anulada && <Button color="red" variant="subtle" onClick={() => setConfirmar("anular")}>Anular</Button>}
        </Group>
      </Group>
      </Stack>

      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert color="green" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      {emitida && <EstadoAeat factura={factura} />}

      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Select
              {...ABAJO} label="Cliente" required searchable data={listas.clientes} value={cab.id_receptor} disabled={!editable}
              onChange={(v) => setCab((c) => ({ ...c, id_receptor: v, id_establecimiento_entrega: null }))} style={{ gridColumn: "span 2" }}
            />
            <Select {...ABAJO} label="Establecimiento" description={editable ? "Dónde se entrega" : undefined} data={establecimientos} value={cab.id_establecimiento_entrega} clearable disabled={!editable} onChange={(v) => poner("id_establecimiento_entrega", v)} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 5 }} spacing="sm">
            <Select
              {...ABAJO} label="Serie" required data={listas.series.map((s) => opcion(s.id, s.serie_descripcion || s.serie))} value={cab.id_serie}
              disabled={!editable || !!id} onChange={elegirSerie} description={id && editable ? "Para cambiarla, crea otra factura" : undefined}
            />
            <TextInput {...ABAJO} label="Fecha" type="date" required value={cab.fecha_emision || ""} disabled={!editable} onChange={(e) => poner("fecha_emision", e.currentTarget.value)} description={editable ? "Al emitir se pone la de ese día" : undefined} />
            <TextInput {...ABAJO} label="Fecha de la operación" type="date" value={cab.fecha_transaccion || ""} disabled={!editable} onChange={(e) => poner("fecha_transaccion", e.currentTarget.value)} />
            <Select {...ABAJO} label="Forma de pago" data={listas.formas} value={cab.id_forma_pago} disabled={!editable} onChange={(v) => poner("id_forma_pago", v)} />
            <Select {...ABAJO} label="Medio de pago" data={listas.medios} value={cab.id_medio_pago} disabled={!editable} onChange={(v) => poner("id_medio_pago", v)} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
            <TextInput {...ABAJO} label="Su referencia" value={cab.referencia_obligado || ""} disabled={!editable} onChange={(e) => poner("referencia_obligado", e.currentTarget.value)} />
            <NumberInput {...ABAJO} label="% Descuento comercial" value={cab.descuento_comercial ?? ""} decimalScale={2} decimalSeparator="," min={0} disabled={!editable} onChange={(v) => poner("descuento_comercial", v)} />
            <NumberInput {...ABAJO} label="% Descuento pronto pago" value={cab.descuento_pp ?? ""} decimalScale={2} decimalSeparator="," min={0} disabled={!editable} onChange={(v) => poner("descuento_pp", v)} />
            <NumberInput {...ABAJO} label="% IRPF" value={cab.irpf ?? ""} decimalScale={2} decimalSeparator="," min={0} disabled={!editable} onChange={(v) => poner("irpf", v)} />
          </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" verticalSpacing="xs">
          {esRectificativa && (
            <>
              {serie.id_tipo_serie === 1 && (
                <Select label="Motivo de la rectificación" required data={tiposDeSerie.map((t) => opcion(t.id, `${t.tipo} · ${t.descripcion}`))} value={cab.id_tipo} disabled={!editable} onChange={(v) => poner("id_tipo", v)} />
              )}
              <Select
                label="Cómo rectifica" required disabled={!editable} value={cab.TipoRectificativa}
                data={[{ value: "I", label: "Por diferencias (solo la diferencia)" }, { value: "S", label: "Por sustitución (la factura entera)" }]}
                onChange={(v) => poner("TipoRectificativa", v)}
              />
              <Switch
                mt="lg" label="No rectifica una factura concreta" disabled={!editable} checked={!!cab.rectificativa_no_relacionada}
                onChange={(e) => poner("rectificativa_no_relacionada", e.currentTarget.checked ? 1 : 0)}
              />
              {rectifica && <Text fz="sm" mt="lg">Rectifica la factura <b>{rectifica.numero_factura}</b></Text>}
            </>
          )}
          <TextInput label="Descripción" value={cab.descripcion || ""} disabled={!editable} onChange={(e) => poner("descripcion", e.currentTarget.value)} style={{ gridColumn: "1 / -1" }} />
          <Nota factura={factura} cab={cab} poner={poner} editable={editable} pedir={pedir} alGuardar={cargar} />
        </SimpleGrid>
        </Stack>
      </Paper>

      {id ? (
        <Lineas alto={arriba.height + 8} lineas={lineas} editable={editable} alEditar={setLinea} alBorrar={async (l) => {
          setError(null)
          try {
            await pedir(`${RUTA}/detalle/eliminar`, { id: l.id })
            cargar()
          } catch (err) {
            setError(err.message)
          }
        }} />
      ) : (
        <Text c="dimmed" fz="sm">Guarda la cabecera para añadir las líneas.</Text>
      )}
      {factura && <Totales factura={factura} />}

      {linea && (
        <FichaLinea
          linea={linea} iva={listas.iva} pedir={pedir} idFactura={id}
          alCerrar={() => setLinea(null)} alGuardar={() => { setLinea(null); cargar() }}
        />
      )}
      <Confirmacion
        accion={confirmar} factura={factura} pedir={pedir} idBorrador={id}
        alCerrar={() => setConfirmar(null)}
        alHecho={(accion) => {
          setConfirmar(null)
          if (accion === "borrar") alVolver()
          else cargar()
        }}
      />
    </Stack>
  )
}

function cabeceraDe(f) {
  const s = (v) => (v === null || v === undefined ? null : String(v))
  return {
    id_receptor: s(f.id_receptor), id_serie: null, serie: f.serie,
    fecha_emision: f.fecha_emision?.slice(0, 10) || "", fecha_transaccion: f.fecha_transaccion?.slice(0, 10) || "",
    descripcion: f.descripcion || "", id_forma_pago: s(f.id_forma_pago ?? 0), id_medio_pago: s(f.id_medio_pago ?? 0),
    descuento_comercial: f.descuento_comercial ?? 0, descuento_pp: f.descuento_pp ?? 0, irpf: f.irpf ?? 0,
    referencia_obligado: f.referencia_obligado || "", nota_factura: f.nota_factura || "",
    id_establecimiento_entrega: f.id_establecimiento_entrega ? s(f.id_establecimiento_entrega) : null,
    id_tipo: s(f.id_tipo), TipoRectificativa: f.TipoRectificativa || null, uuid_relacionada: f.uuid_relacionada || null,
    rectificativa_no_relacionada: f.rectificativa_no_relacionada || 0, id_tipo_serie: f.id_tipo_serie,
  }
}

function cuerpoDe(cab, serie) {
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v))
  const cuerpo = {
    id_receptor: num(cab.id_receptor), fecha_emision: cab.fecha_emision, fecha_transaccion: cab.fecha_transaccion || null,
    descripcion: cab.descripcion || "", id_forma_pago: num(cab.id_forma_pago), id_medio_pago: num(cab.id_medio_pago),
    descuento_comercial: num(cab.descuento_comercial) ?? 0, descuento_pp: num(cab.descuento_pp) ?? 0, irpf: num(cab.irpf) ?? 0,
    referencia_obligado: cab.referencia_obligado || null, nota_factura: cab.nota_factura || null,
    id_establecimiento_entrega: num(cab.id_establecimiento_entrega), id_tipo: num(cab.id_tipo) ?? 0, id_zona: null, importe_irpf: null,
    Subsanacion: null, RechazoPrevio: null, rectificativa_no_relacionada: cab.rectificativa_no_relacionada || 0,
  }
  if (serie) Object.assign(cuerpo, { id_serie: serie.id, serie: serie.serie })
  if (cab.TipoRectificativa) Object.assign(cuerpo, { TipoRectificativa: cab.TipoRectificativa, uuid_relacionada: cab.uuid_relacionada || null })
  return cuerpo
}

// La nota sale en la factura y se puede cambiar también ya emitida
function Nota({ factura, cab, poner, editable, pedir, alGuardar }) {
  const [nota, setNota] = useState(cab.nota_factura || "")
  const [error, setError] = useState(null)
  if (editable) {
    return <TextInput label="Nota en la factura" maxLength={50} value={cab.nota_factura || ""} onChange={(e) => poner("nota_factura", e.currentTarget.value)} style={{ gridColumn: "1 / -1" }} />
  }
  return (
    <Group align="flex-end" style={{ gridColumn: "1 / -1" }}>
      <TextInput label="Nota en la factura" maxLength={50} value={nota} onChange={(e) => setNota(e.currentTarget.value)} style={{ flex: 1 }} error={error} />
      {nota !== (factura.nota_factura || "") && (
        <Button variant="default" onClick={() => pedir(`${RUTA}/actualizar_nota`, { id_factura: factura.id, nota_factura: nota }).then(alGuardar).catch((e) => setError(e.message))}>
          Guardar nota
        </Button>
      )}
    </Group>
  )
}

function EstadoAeat({ factura }) {
  const filas = [
    ["Envío", factura.EstadoEnvio],
    ["Registro", factura.EstadoRegistro],
    ["Error", factura.CodigoErrorRegistro && `${factura.CodigoErrorRegistro} · ${factura.DescripcionErrorRegistro || ""}`],
    ["CSV", factura.csv],
    ["Presentada", factura.TimestampPresentacion && formatearFecha(factura.TimestampPresentacion)],
  ].filter(([, v]) => v)
  return (
    <Paper withBorder p="sm" radius="md">
      <Group gap="xl" wrap="wrap">
        {filas.length ? filas.map(([k, v]) => (
          <Stack key={k} gap={0}><Text fz="xs" c="dimmed">{k}</Text><Text fz="sm">{v}</Text></Stack>
        )) : <Text fz="sm" c="dimmed">Todavía sin respuesta de la AEAT: el SIF la envía solo y lo reintenta.</Text>}
        {factura.url_validacion && <Anchor href={factura.url_validacion} target="_blank" fz="sm">Comprobar en la AEAT</Anchor>}
      </Group>
    </Paper>
  )
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
            <Table.Th ta="right">% Dto.</Table.Th><Table.Th ta="right">% IVA</Table.Th><Table.Th ta="right">Base</Table.Th><Table.Th ta="right">Total</Table.Th>
            {editable && <Table.Th w={70} />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lineas.length ? lineas.map((l) => (
            <Table.Tr key={l.id}>
              <Table.Td>{l.descripcion}</Table.Td>
              <Table.Td ta="right">{Number(l.cantidad).toLocaleString("es-ES")}</Table.Td>
              <Table.Td ta="right">{formatearImporte(l.precio_unitario)}</Table.Td>
              <Table.Td ta="right">{Number(l.descuento || 0).toLocaleString("es-ES")}</Table.Td>
              <Table.Td ta="right">{l.iva}</Table.Td>
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
            <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" fz="sm">Sin líneas.</Text></Table.Td></Table.Tr>
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
          {Number(factura.importe_irpf) > 0 && (
            <Table.Tr><Table.Td colSpan={3} ta="right">Retención IRPF ({factura.irpf} %)</Table.Td><Table.Td ta="right">−{formatearImporte(factura.importe_irpf)}</Table.Td></Table.Tr>
          )}
          <Table.Tr><Table.Td colSpan={3} ta="right" fw={700}>Total</Table.Td><Table.Td ta="right" fw={700}>{formatearImporte(factura.importe_total)}</Table.Td></Table.Tr>
        </Table.Tbody>
      </Table>
    </Group>
  )
}

function FichaLinea({ linea, iva, pedir, idFactura, alCerrar, alGuardar }) {
  const nueva = linea.id === undefined
  const [v, setV] = useState({
    descripcion: linea.descripcion || "", cantidad: linea.cantidad ?? 1, precio_unitario: linea.precio_unitario ?? "",
    descuento: linea.descuento ?? 0, iva: linea.iva != null ? String(Number(linea.iva)) : "21",
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const poner = (k, x) => setV((a) => ({ ...a, [k]: x }))
  const guardar = (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = { descripcion: v.descripcion, cantidad: v.cantidad, precio_unitario: v.precio_unitario, descuento: v.descuento || 0, iva: v.iva }
    pedir(`${RUTA}/detalle/${nueva ? "crear" : "modificar"}`, nueva ? { ...cuerpo, id_factura: idFactura } : { ...cuerpo, id: linea.id })
      .then(alGuardar)
      .catch((err) => setError(err.message))
      .finally(() => setGuardando(false))
  }
  return (
    <Modal opened onClose={alCerrar} title={nueva ? "Nueva línea" : "Cambiar línea"} size="lg">
      <form onSubmit={guardar}>
        <Stack gap="sm">
          <Textarea label="Descripción" required autosize minRows={2} value={v.descripcion} onChange={(e) => poner("descripcion", e.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
            <NumberInput label="Cantidad" required decimalScale={4} decimalSeparator="," value={v.cantidad} onChange={(x) => poner("cantidad", x)} />
            <NumberInput label="Precio (sin IVA)" required decimalScale={4} decimalSeparator="," value={v.precio_unitario} onChange={(x) => poner("precio_unitario", x)} />
            <NumberInput label="% Descuento" decimalScale={2} decimalSeparator="," min={0} value={v.descuento} onChange={(x) => poner("descuento", x)} />
            <Select label="% IVA" required data={iva} value={v.iva} allowDeselect={false} onChange={(x) => poner("iva", x)} />
          </SimpleGrid>
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
  emitir: {
    titulo: "Emitir la factura",
    texto: "El SIF le pone número, la fecha de hoy y la envía a la AEAT. Después ya no se puede cambiar: solo rectificar o anular.",
    boton: "Emitir", color: undefined,
  },
  borrar: { titulo: "Borrar el borrador", texto: "Se quita este borrador. No tenía número ni se envió a la AEAT.", boton: "Borrar", color: "red" },
  anular: {
    titulo: "Anular la factura",
    texto: "Se envía a la AEAT la anulación de esta factura. No se puede deshacer. Si lo que hay que corregir es un importe o un dato, mejor una rectificativa.",
    boton: "Anular", color: "red",
  },
}

function Confirmacion({ accion, factura, pedir, idBorrador, alCerrar, alHecho }) {
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [motivo, setMotivo] = useState("")
  useEffect(() => setError(null), [accion])
  if (!accion) return null
  const t = TEXTOS[accion]
  const hacer = async () => {
    setTrabajando(true)
    setError(null)
    try {
      if (accion === "emitir") await pedir(`${RUTA}/aprobar_factura`, { id_factura: idBorrador })
      if (accion === "borrar") await pedir(`${RUTA}/eliminar`, { id: idBorrador })
      if (accion === "anular") await pedir("/facturas_emitidas/anular", { id_factura: factura.id_factura_emitida, motivo_anulacion: motivo || null })
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
        {accion === "anular" && <TextInput label="Motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} />}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button color={t.color} loading={trabajando} onClick={hacer}>{t.boton}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
