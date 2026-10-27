import { useEffect, useState } from "react"
import { Alert, Badge, Button, Card, Checkbox, FileInput, Group, Modal, SegmentedControl, Stack, Table, Text, TextInput } from "@mantine/core"
import { api } from "../../api"

// Conciliación bancaria (ver docs/planificacion/conciliacion-bancaria.md).
// Se sube el extracto (Norma 43), se buscan las facturas del SIF que encajan
// con cada movimiento y se enseña la propuesta. La GD no escribe nada en el SIF:
// la decisión es del contable.

const importe = (n) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (f) => new Date(f).toLocaleDateString("es-ES")
const ESTADOS = {
  sin_emparejar: "Sin emparejar", exacto: "Exacto", dudoso: "Dudoso", confirmado: "Confirmado", descartado: "Descartado",
}
const COLORES = { sin_emparejar: "gray", exacto: "green", dudoso: "yellow", confirmado: "blue", descartado: "gray" }
const NUM = { fontVariantNumeric: "tabular-nums" }

function Propuesta({ propuesta, decision }) {
  if (decision?.elegidas_a_mano) {
    return (
      <Stack gap={2}>
        <Text fz="xs" c="dimmed">Elegidas por el contable</Text>
        {decision.candidatas.map((c) => (
          <Text key={`${c.sentido}-${c.id}`} fz="sm">
            {c.sentido === "cobro" ? "Cobro" : "Pago"} · factura {c.numero_factura || c.id_factura} · {c.tercero} · {importe(c.pendiente)} €
          </Text>
        ))}
      </Stack>
    )
  }
  if (!propuesta) return null
  return (
    <Stack gap={2}>
      <Text fz="xs" c="dimmed">{propuesta.motivo}</Text>
      {propuesta.candidatas.map((c) => (
        <Text key={`${c.sentido}-${c.id}`} fz="sm">
          {c.sentido === "cobro" ? "Cobro" : "Pago"} · factura {c.numero_factura || c.id_factura} · {c.tercero} · pendiente {importe(c.pendiente)} €
        </Text>
      ))}
    </Stack>
  )
}

// Elegir a mano las facturas de un movimiento, entre las pendientes del SIF
function ElegirFactura({ proyecto, extracto, movimiento, onCerrar, onElegidas, onError }) {
  const [texto, setTexto] = useState("")
  const [lista, setLista] = useState(null)
  const [marcadas, setMarcadas] = useState({})
  const clave = (c) => `${c.sentido}-${c.id}`

  useEffect(() => {
    setLista(null)
    const espera = setTimeout(() => {
      api.candidatasMovimientoBancario(proyecto.id, extracto.id, movimiento.id, texto)
        .then((r) => setLista(r.candidatas))
        .catch((err) => { setLista([]); onError(err.message) })
    }, 300)
    return () => clearTimeout(espera)
  }, [texto]) // eslint-disable-line react-hooks/exhaustive-deps

  const elegidas = Object.values(marcadas)
  const suma = elegidas.reduce((t, c) => t + Number(c.pendiente), 0)
  const abono = Number(movimiento.importe) > 0
  return (
    <Modal opened onClose={onCerrar} size="lg" title={`${abono ? "Cobro" : "Pago"} de ${importe(Math.abs(movimiento.importe))} € — elige la factura`}>
      <Stack gap="sm">
        <TextInput id="conciliacion-buscar-factura" aria-label="Buscar factura" placeholder="Número de factura, nombre o NIF" value={texto} onChange={(e) => setTexto(e.currentTarget.value)} />
        {!lista ? <Text>Cargando...</Text> : lista.length === 0 ? <Text c="dimmed">No hay facturas pendientes con ese filtro.</Text> : (
          <Stack gap={4} mah={360} style={{ overflowY: "auto" }}>
            {lista.map((c) => (
              <Checkbox
                key={clave(c)} checked={!!marcadas[clave(c)]}
                onChange={(e) => {
                  const marcar = e.currentTarget.checked
                  setMarcadas((m) => { const n = { ...m }; if (marcar) n[clave(c)] = c; else delete n[clave(c)]; return n })
                }}
                label={`Factura ${c.numero_factura || c.id_factura} · ${c.tercero || ""} · vence ${c.fecha_vencimiento ? fecha(c.fecha_vencimiento) : "—"} · pendiente ${importe(c.pendiente)} €`}
              />
            ))}
          </Stack>
        )}
        <Group justify="space-between">
          <Text fz="sm" c={elegidas.length && Math.abs(suma - Math.abs(Number(movimiento.importe))) > 0.009 ? "orange" : "dimmed"}>
            {elegidas.length ? `Elegidas ${elegidas.length}: ${importe(suma)} € de ${importe(Math.abs(movimiento.importe))} €` : "Marca una o varias facturas"}
          </Text>
          <Button disabled={!elegidas.length} onClick={() => onElegidas(elegidas)}>Confirmar con estas</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function Acciones({ movimiento, onResolver, onElegir, trabajando }) {
  const { estado, propuesta } = movimiento
  if (estado === "confirmado" || estado === "descartado") {
    return (
      <Group gap="xs" wrap="nowrap">
        <Text fz="xs" c="dimmed">{movimiento.decision?.sin_factura ? "Sin factura" : ""}</Text>
        <Button size="compact-xs" variant="default" loading={trabajando} onClick={() => onResolver(movimiento, "reabrir")}>Deshacer</Button>
      </Group>
    )
  }
  return (
    <Group gap="xs" wrap="nowrap">
      {propuesta && <Button size="compact-xs" loading={trabajando} onClick={() => onResolver(movimiento, "confirmar")}>Confirmar</Button>}
      <Button size="compact-xs" variant="default" loading={trabajando} onClick={() => onElegir(movimiento)}>Elegir otra</Button>
      <Button size="compact-xs" variant="default" loading={trabajando} onClick={() => onResolver(movimiento, "confirmar", true)}>Sin factura</Button>
      <Button size="compact-xs" variant="subtle" color="gray" loading={trabajando} onClick={() => onResolver(movimiento, "descartar")}>Descartar</Button>
    </Group>
  )
}

function Movimientos({ proyecto, extracto, onVolver, onError }) {
  const [datos, setDatos] = useState(null)
  const [filtro, setFiltro] = useState("todos")
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const cargar = () => api.movimientosExtracto(proyecto.id, extracto.id).then(setDatos).catch((err) => onError(err.message))
  useEffect(() => { cargar() }, [proyecto.id, extracto.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const buscar = () => {
    setBuscando(true)
    setAviso(null)
    api
      .emparejarExtracto(proyecto.id, extracto.id)
      .then((r) => {
        setAviso(`Revisados ${r.revisados} movimientos: ${r.exacto} exactos, ${r.dudoso} dudosos y ${r.sin_emparejar} sin emparejar.${r.avisos.length ? ` ${r.avisos.join(" ")}` : ""}`)
        return cargar()
      })
      .catch((err) => onError(err.message))
      .finally(() => setBuscando(false))
  }

  const [resolviendo, setResolviendo] = useState(null)
  const [eligiendo, setEligiendo] = useState(null)
  const resolver = (m, accion, sinFactura = false, candidatas = null) => {
    setResolviendo(m.id)
    api
      .resolverMovimientoBancario(proyecto.id, extracto.id, m.id, { accion, sin_factura: sinFactura, candidatas })
      .then((nuevo) => setDatos((d) => ({ ...d, movimientos: d.movimientos.map((x) => (x.id === nuevo.id ? nuevo : x)) })))
      .catch((err) => onError(err.message))
      .finally(() => setResolviendo(null))
  }

  const filas = datos?.movimientos.filter((m) => filtro === "todos" || m.estado === filtro)
  const cuantos = (e) => datos?.movimientos.filter((m) => m.estado === e).length ?? 0

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>
          Cuenta {extracto.banco}-{extracto.oficina}-{extracto.cuenta} · {fecha(extracto.fecha_desde)} a {fecha(extracto.fecha_hasta)}
        </Text>
        <Group>
          <Button onClick={buscar} loading={buscando}>Buscar facturas</Button>
          <Button variant="default" onClick={onVolver}>Volver a los extractos</Button>
        </Group>
      </Group>
      {!extracto.cuadra && (
        <Alert color="yellow">
          Los movimientos de este extracto no suman lo que dice el banco: del saldo inicial {importe(extracto.saldo_inicial)} € al final {importe(extracto.saldo_final)} €. Puede que falte alguna línea.
        </Alert>
      )}
      {aviso && <Alert color="green" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      {eligiendo && (
        <ElegirFactura
          proyecto={proyecto} extracto={extracto} movimiento={eligiendo} onError={onError} onCerrar={() => setEligiendo(null)}
          onElegidas={(elegidas) => { resolver(eligiendo, "confirmar", false, elegidas); setEligiendo(null) }}
        />
      )}
      {!datos ? (
        <Text>Cargando...</Text>
      ) : (
        <>
          <SegmentedControl
            value={filtro} onChange={setFiltro} w="fit-content"
            data={[
              { value: "todos", label: `Todos (${datos.movimientos.length})` },
              { value: "exacto", label: `Exactos (${cuantos("exacto")})` },
              { value: "dudoso", label: `Dudosos (${cuantos("dudoso")})` },
              { value: "sin_emparejar", label: `Sin emparejar (${cuantos("sin_emparejar")})` },
              { value: "confirmado", label: `Confirmados (${cuantos("confirmado")})` },
            ]}
          />
          <Table.ScrollContainer minWidth={900}>
            <Table withTableBorder fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha</Table.Th><Table.Th>Concepto</Table.Th><Table.Th ta="right">Importe</Table.Th><Table.Th>Estado</Table.Th><Table.Th>Propuesta</Table.Th><Table.Th>Decisión</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filas.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>{fecha(m.fecha_operacion)}</Table.Td>
                    <Table.Td>{m.concepto || m.referencia1 || m.numero_documento || ""}</Table.Td>
                    <Table.Td ta="right" style={NUM} c={Number(m.importe) < 0 ? "red.7" : undefined}>{importe(m.importe)}</Table.Td>
                    <Table.Td><Badge variant="light" color={COLORES[m.estado] || "gray"}>{ESTADOS[m.estado] || m.estado}</Badge></Table.Td>
                    <Table.Td><Propuesta propuesta={m.propuesta} decision={m.decision} /></Table.Td>
                    <Table.Td><Acciones movimiento={m} onResolver={resolver} onElegir={setEligiendo} trabajando={resolviendo === m.id} /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </>
      )}
    </Stack>
  )
}

export default function Conciliacion({ proyecto, empresa }) {
  const [extractos, setExtractos] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const cargar = () => {
    api.listarExtractos(proyecto.id, empresa.id_empresa).then((r) => setExtractos(r.extractos)).catch((err) => setError(err.message))
  }
  useEffect(cargar, [proyecto.id, empresa.id_empresa])

  const subir = () => {
    setSubiendo(true)
    setError(null)
    setAviso(null)
    api
      .subirExtracto(proyecto.id, empresa.id_empresa, archivo)
      .then((r) => {
        setArchivo(null)
        setAviso(
          [r.creados.length && `Subidos ${r.creados.length} extracto(s).`, r.repetidos.length && `Ya estaban subidos: ${r.repetidos.join("; ")}.`]
            .filter(Boolean).join(" "),
        )
        cargar()
      })
      .catch((err) => setError(err.message))
      .finally(() => setSubiendo(false))
  }

  const borrar = (e) => {
    if (!window.confirm("¿Borrar este extracto? Se puede volver a subir.")) return
    api.eliminarExtracto(proyecto.id, e.id).then(cargar).catch((err) => setError(err.message))
  }

  if (abierto) return (
    <Stack>
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      <Movimientos proyecto={proyecto} extracto={abierto} onVolver={() => setAbierto(null)} onError={setError} />
    </Stack>
  )

  return (
    <Stack gap="md">
      <Group align="flex-end" wrap="wrap">
        <FileInput
          id="conciliacion-archivo" label="Extracto del banco (Norma 43)" placeholder="Elige el fichero"
          value={archivo} onChange={setArchivo} style={{ flex: 1, minWidth: 220 }}
        />
        <Button onClick={subir} loading={subiendo} disabled={!archivo}>Subir extracto</Button>
      </Group>
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert color="green" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      {!extractos ? (
        <Text>Cargando...</Text>
      ) : extractos.length === 0 ? (
        <Text c="dimmed">Todavía no has subido ningún extracto de esta empresa.</Text>
      ) : (
        extractos.map((e) => (
          <Card key={e.id} withBorder>
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Text fw={600}>Cuenta {e.banco}-{e.oficina}-{e.cuenta}{e.titular ? ` · ${e.titular}` : ""}</Text>
                <Text fz="sm" c="dimmed">
                  {fecha(e.fecha_desde)} a {fecha(e.fecha_hasta)} · {e.movimientos} movimientos · saldo {importe(e.saldo_inicial)} → {importe(e.saldo_final)} €
                </Text>
              </Stack>
              <Group gap="xs">
                {!e.cuadra && <Badge color="yellow" variant="light">No cuadra</Badge>}
                <Button variant="default" onClick={() => setAbierto(e)}>Ver movimientos</Button>
                <Button variant="subtle" color="red" onClick={() => borrar(e)}>Borrar</Button>
              </Group>
            </Group>
          </Card>
        ))
      )}
    </Stack>
  )
}
