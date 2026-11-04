import { useEffect, useState } from "react"
import { Alert, Badge, Button, Card, Checkbox, FileInput, Group, Modal, SegmentedControl, Select, Stack, Table, Tabs, Text, TextInput } from "@mantine/core"
import { api } from "../../api"
import CuentaMayor from "./CuentaMayor"

// Conciliación bancaria (ver docs/planificacion/conciliacion-bancaria.md).
// Los extractos (Norma 43) de una misma cuenta bancaria se unen en una sola cuenta
// corrida, sin días repetidos y avisando de los huecos. Cada movimiento se compara
// con el mayor de la subcuenta 572 de esa cuenta: asentado, o pendiente de asentar
// (con una factura que encaja, si la hay). La GD no escribe nada en el SIF: la
// decisión es del contable.

const importe = (n) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (f) => new Date(f).toLocaleDateString("es-ES")
const ESTADOS = {
  sin_emparejar: "Sin emparejar", exacto: "Exacto", dudoso: "Dudoso", asentado: "Asentado", asiento_propuesto: "Asiento propuesto", confirmado: "Confirmado", descartado: "Descartado",
}
const COLORES = { sin_emparejar: "gray", exacto: "green", dudoso: "yellow", asentado: "teal", asiento_propuesto: "violet", confirmado: "blue", descartado: "yellow.8" }
const NUM = { fontVariantNumeric: "tabular-nums" }

function Propuesta({ propuesta, decision, fecha: fechaMov }) {
  if (decision?.elegidas_a_mano) {
    return (
      <Stack gap={2}>
        <Text fz="xs" c="dimmed">Elegidas por el contable</Text>
        {(decision.candidatas || []).map((c) => (
          <Text key={`${c.sentido}-${c.id}`} fz="sm">
            {c.sentido === "cobro" ? "Cobro" : "Pago"} · factura {c.numero_factura || c.id_factura} · {c.tercero} · {importe(c.pendiente)} €
          </Text>
        ))}
      </Stack>
    )
  }
  if (!propuesta) return null
  if (propuesta.asiento) {
    const a = propuesta.asiento
    return (
      <Stack gap={2}>
        <Text fz="xs" c="dimmed">{propuesta.motivo}</Text>
        {(a.apuntes || []).map((l, i) => (
          <Text key={i} fz="sm" style={NUM}>
            <CuentaMayor cuenta={l.cuenta} ejercicio={String(a.fecha || fechaMov || "").slice(0, 4)} /> · {Number(l.debe) ? `debe ${importe(l.debe)}` : `haber ${importe(l.haber)}`} €
          </Text>
        ))}
      </Stack>
    )
  }
  if (propuesta.apunte) {
    const a = propuesta.apunte
    return (
      <Text fz="sm">
        Asiento {a.asiento} · {fecha(a.fecha)} · {a.concepto || ""}{a.es_borrador ? " (en borrador)" : ""}
      </Text>
    )
  }
  return (
    <Stack gap={2}>
      <Text fz="xs" c="dimmed">{propuesta.motivo}</Text>
      {(propuesta.candidatas || []).map((c) => (
        <Text key={`${c.sentido}-${c.id}`} fz="sm">
          {c.sentido === "cobro" ? "Cobro" : "Pago"} · factura {c.numero_factura || c.id_factura} · {c.tercero} · pendiente {importe(c.pendiente)} €
        </Text>
      ))}
    </Stack>
  )
}

// Elegir a mano las facturas de un movimiento, entre las pendientes del SIF
function ElegirFactura({ proyecto, extracto, movimiento, onCerrar, onElegidas, onCuenta, onError }) {
  const [modo, setModo] = useState("factura")
  const [cuentas, setCuentas] = useState([])
  const [cuenta, setCuenta] = useState(null)
  const [busquedaCuenta, setBusquedaCuenta] = useState("")
  useEffect(() => {
    if (modo !== "cuenta") return undefined
    const espera = setTimeout(() => {
      api.cuentasPlanConciliacion(proyecto.id, extracto.id, busquedaCuenta)
        .then((r) => setCuentas(r.cuentas.map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.descripcion}` }))))
        .catch((err) => onError(err.message))
    }, 300)
    return () => clearTimeout(espera)
  }, [modo, busquedaCuenta]) // eslint-disable-line react-hooks/exhaustive-deps
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
  const opcionesCuenta = cuenta && !cuentas.some((c) => c.value === cuenta.value) ? [cuenta, ...cuentas] : cuentas
  const suma = elegidas.reduce((t, c) => t + Number(c.pendiente), 0)
  const abono = Number(movimiento.importe) > 0
  return (
    <Modal opened onClose={onCerrar} size="lg" title={`${abono ? "Cobro" : "Pago"} de ${importe(Math.abs(movimiento.importe))} € — elige la contrapartida`}>
      <Stack gap="sm">
        <SegmentedControl
          value={modo} onChange={setModo} w="fit-content"
          data={[{ value: "factura", label: "Una o varias facturas" }, { value: "cuenta", label: "Otra cuenta contable" }]}
        />
        {modo === "cuenta" ? (
          <>
            <Select
              id="conciliacion-cuenta-contrapartida" label="Cuenta contable" placeholder="Busca por número o por nombre"
              data={opcionesCuenta} value={cuenta?.value || null} searchable nothingFoundMessage="Ninguna cuenta con eso"
              filter={({ options }) => options} onSearchChange={setBusquedaCuenta}
              onChange={(v) => setCuenta(opcionesCuenta.find((c) => c.value === v) || null)}
            />
            <Group justify="space-between">
              <Text fz="sm" c="dimmed">Se propone el asiento contra el banco por {importe(Math.abs(movimiento.importe))} €</Text>
              <Button disabled={!cuenta} onClick={() => onCuenta(cuenta.value)}>Proponer asiento con esta cuenta</Button>
            </Group>
          </>
        ) : (<>
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
        </>)}
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
  if (estado === "asentado") return null
  if (estado === "asiento_propuesto") {
    return (
      <Group gap="xs" wrap="nowrap">
        <Button size="compact-xs" loading={trabajando} onClick={() => onResolver(movimiento, "contabilizar")}>Contabilizar</Button>
        <Button size="compact-xs" variant="default" loading={trabajando} onClick={() => onElegir(movimiento)}>Elegir otra</Button>
        <Button size="compact-xs" variant="subtle" color="gray" loading={trabajando} onClick={() => onResolver(movimiento, "descartar")}>Descartar</Button>
      </Group>
    )
  }
  return (
    <Group gap="xs" wrap="nowrap">
      {propuesta && <Button size="compact-xs" loading={trabajando} onClick={() => onResolver(movimiento, "confirmar")}>Confirmar</Button>}
      <Button size="compact-xs" variant="default" loading={trabajando} onClick={() => onElegir(movimiento)}>Elegir otra</Button>
      <Button size="compact-xs" variant="subtle" color="gray" loading={trabajando} onClick={() => onResolver(movimiento, "descartar")}>Descartar</Button>
    </Group>
  )
}

function Movimientos({ proyecto, cuenta, onVolver, onError }) {
  const [datos, setDatos] = useState(null)
  const [extractos, setExtractos] = useState([])
  const [filtro, setFiltro] = useState("todos")
  const [comparando, setComparando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [sinBanco, setSinBanco] = useState(null)
  const [yaEnDiario, setYaEnDiario] = useState(false)

  const cargar = () => Promise.all([
    api.movimientosCuenta(proyecto.id, cuenta.id).then(setDatos),
    api.extractosCuenta(proyecto.id, cuenta.id).then((r) => setExtractos(r.extractos)),
  ]).catch((err) => onError(err.message))
  useEffect(() => { cargar() }, [proyecto.id, cuenta.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [eligiendoPeriodo, setEligiendoPeriodo] = useState(false)
  const [periodo, setPeriodo] = useState({ desde: "", hasta: "" })
  const abrirComparar = () => {
    const dias = (datos?.movimientos || []).map((m) => String(m.fecha_operacion).slice(0, 10)).sort()
    setPeriodo({ desde: dias[0] || "", hasta: dias[dias.length - 1] || "" })
    setEligiendoPeriodo(true)
  }
  const comparar = () => {
    setEligiendoPeriodo(false)
    setComparando(true)
    setAviso(null)
    api
      .compararCuenta(proyecto.id, cuenta.id, periodo.desde, periodo.hasta)
      .then((r) => {
        setAviso(`Revisados ${r.revisados} movimientos: ${r.asentado} ya asentados; de los pendientes, ${r.exacto} con factura exacta, ${r.dudoso} dudosos, ${r.asiento_propuesto} con asiento propuesto y ${r.sin_emparejar} sin coincidencia.${r.avisos.length ? ` ${r.avisos.join(" ")}` : ""}`)
        setSinBanco(r.sin_banco)
        return cargar()
      })
      .catch((err) => onError(err.message))
      .finally(() => setComparando(false))
  }

  const borrarExtracto = (e) => {
    if (!window.confirm("¿Borrar este extracto? Se puede volver a subir.")) return
    api.eliminarExtracto(proyecto.id, e.id).then(cargar).catch((err) => onError(err.message))
  }

  const [resolviendo, setResolviendo] = useState(null)
  const [eligiendo, setEligiendo] = useState(null)
  const [marcados, setMarcados] = useState([])
  // Contabilizar = pasar el asiento a propuestas y aceptarlo: queda como borrador en el Diario del SIF
  const contabilizarUno = (m) =>
    api.proponerAsientoMovimiento(proyecto.id, m.id_conciliacion, m.id)
      .then((nuevo) => api.resolverPropuestaContable(proyecto.id, nuevo.decision.id_propuesta, { aceptar: true }))
  const contabilizarMarcados = async () => {
    setResolviendo("lote")
    const fallos = []
    for (const m of datos.movimientos.filter((x) => marcados.includes(x.id))) {
      try { await contabilizarUno(m) } catch (err) { fallos.push(`${fecha(m.fecha_operacion)} ${importe(m.importe)} €: ${err.message}`) }
    }
    setMarcados([])
    await cargar()
    setResolviendo(null)
    if (fallos.length) onError(`No se pudieron contabilizar ${fallos.length}: ${fallos.join(" · ")}`)
  }
  const resolver = (m, accion, sinFactura = false, candidatas = null, cuenta = null) => {
    if (accion === "contabilizar") {
      setResolviendo(m.id)
      contabilizarUno(m).then(cargar).catch((err) => onError(err.message)).finally(() => setResolviendo(null))
      return
    }
    setResolviendo(m.id)
    ;(accion === "asiento"
      ? api.proponerAsientoMovimiento(proyecto.id, m.id_conciliacion, m.id)
      : accion === "cuenta" ? api.elegirCuentaMovimiento(proyecto.id, m.id_conciliacion, m.id, cuenta)
      : api.resolverMovimientoBancario(proyecto.id, m.id_conciliacion, m.id, { accion, sin_factura: sinFactura, candidatas }))
      .then((nuevo) => setDatos((d) => ({ ...d, movimientos: d.movimientos.map((x) => (x.id === nuevo.id ? nuevo : x)) })))
      .catch((err) => {
        // Un asiento ya confirmado en el Diario no se deshace desde aquí
        if (accion === "reabrir" && err.message.includes("ya está en el Diario")) setYaEnDiario(true)
        else onError(err.message)
      })
      .finally(() => setResolviendo(null))
  }

  const filas = datos?.movimientos.filter((m) => filtro === "todos" || m.estado === filtro)
  const propuestos = datos?.movimientos.filter((m) => m.estado === "asiento_propuesto") ?? []
  const cuantos = (e) => datos?.movimientos.filter((m) => m.estado === e).length ?? 0

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>
          Cuenta {cuenta.banco}-{cuenta.oficina}-{cuenta.cuenta} · subcuenta {cuenta.subcuenta ? <CuentaMayor cuenta={cuenta.subcuenta} ejercicio={new Date().getFullYear()} /> : "sin elegir"}
        </Text>
        <Group>
          <Button onClick={abrirComparar} loading={comparando} disabled={!cuenta.subcuenta}>Comparar con la contabilidad</Button>
          <Button variant="default" onClick={onVolver}>Volver a las cuentas</Button>
        </Group>
      </Group>
      <Modal opened={eligiendoPeriodo} onClose={() => setEligiendoPeriodo(false)} title="¿Qué movimientos se comparan?">
        <Stack gap="sm">
          <Text fz="sm">Se revisan los movimientos del extracto con fecha entre estas dos (las dos incluidas). Los que ya confirmaste o descartaste no se tocan.</Text>
          <Group grow>
            <TextInput type="date" label="Desde" value={periodo.desde} onChange={(e) => setPeriodo((p) => ({ ...p, desde: e.currentTarget.value }))} />
            <TextInput type="date" label="Hasta" value={periodo.hasta} onChange={(e) => setPeriodo((p) => ({ ...p, hasta: e.currentTarget.value }))} />
          </Group>
          <Text fz="sm" c="dimmed">
            {(datos?.movimientos || []).filter((m) => { const d = String(m.fecha_operacion).slice(0, 10); return (!periodo.desde || d >= periodo.desde) && (!periodo.hasta || d <= periodo.hasta) }).length} movimientos en ese periodo
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEligiendoPeriodo(false)}>Cancelar</Button>
            <Button onClick={comparar}>Comparar</Button>
          </Group>
        </Stack>
      </Modal>
      {aviso && <Alert color="green" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      {yaEnDiario && (
        <Alert color="yellow" title="Ya está en el Diario" withCloseButton onClose={() => setYaEnDiario(false)}>
          Este asiento ya está en el Diario, así que no se puede deshacer desde aquí. Para quitarlo, usa «Deshacer» en Propuestas o bórralo en el Diario: aquí se actualizará solo.
        </Alert>
      )}
      {eligiendo && (
        <ElegirFactura
          proyecto={proyecto} extracto={{ id: eligiendo.id_conciliacion }} movimiento={eligiendo} onError={onError} onCerrar={() => setEligiendo(null)}
          onElegidas={(elegidas) => { resolver(eligiendo, "confirmar", false, elegidas); setEligiendo(null) }}
          onCuenta={(cuenta) => { resolver(eligiendo, "cuenta", false, null, cuenta); setEligiendo(null) }}
        />
      )}
      {!datos ? (
        <Text>Cargando...</Text>
      ) : (
        <Tabs defaultValue="movimientos" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="movimientos">Movimientos</Tabs.Tab>
            <Tabs.Tab value="asientos">Asientos{sinBanco ? ` (${sinBanco.length})` : ""}</Tabs.Tab>
            <Tabs.Tab value="lecturas">Historial de lecturas ({extractos.length}{(cuenta.huecos || []).length ? ` · ${(cuenta.huecos || []).length} avisos` : ""})</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="movimientos">
          <Stack gap="md">
          <SegmentedControl
            value={filtro} onChange={setFiltro} w="fit-content"
            data={[
              { value: "todos", label: `Todos (${datos.movimientos.length})` },
              { value: "asentado", label: `Asentados (${cuantos("asentado")})` },
              { value: "exacto", label: `Con factura exacta (${cuantos("exacto")})` },
              { value: "dudoso", label: `Dudosos (${cuantos("dudoso")})` },
              { value: "asiento_propuesto", label: `Asiento propuesto (${cuantos("asiento_propuesto")})` },
              { value: "sin_emparejar", label: `Sin coincidencia (${cuantos("sin_emparejar")})` },
              { value: "confirmado", label: `Confirmados (${cuantos("confirmado")})` },
            ]}
          />
          {marcados.length > 0 && (
            <Group>
              <Button loading={resolviendo === "lote"} onClick={contabilizarMarcados}>Contabilizar {marcados.length} {marcados.length === 1 ? "marcado" : "marcados"}</Button>
              <Button variant="default" disabled={resolviendo === "lote"} onClick={() => setMarcados([])}>Quitar la marca</Button>
              <Text fz="sm" c="dimmed">Quedan como borrador en el Diario, pendientes de que los confirmes allí.</Text>
            </Group>
          )}
          <Table.ScrollContainer minWidth={900} mah="calc(100vh - 300px)" type="native">
            <Table withTableBorder fz="sm" stickyHeader>
              <Table.Thead bg="var(--mantine-color-body)">
                <Table.Tr>
                  <Table.Th w={30}>
                    <Checkbox
                      aria-label="Marcar todos los asientos propuestos" disabled={!propuestos.length}
                      checked={propuestos.length > 0 && marcados.length === propuestos.length}
                      indeterminate={marcados.length > 0 && marcados.length < propuestos.length}
                      onChange={(e) => setMarcados(e.currentTarget.checked ? propuestos.map((m) => m.id) : [])}
                    />
                  </Table.Th>
                  <Table.Th>Fecha</Table.Th><Table.Th>Concepto</Table.Th><Table.Th ta="right">Importe</Table.Th><Table.Th>Estado</Table.Th><Table.Th>En contabilidad / propuesta</Table.Th><Table.Th>Decisión</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filas.map((m) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>
                      {m.estado === "asiento_propuesto" && (
                        <Checkbox
                          aria-label="Marcar este asiento" checked={marcados.includes(m.id)}
                          onChange={(e) => { const marcar = e.currentTarget.checked; setMarcados((x) => (marcar ? [...x, m.id] : x.filter((i) => i !== m.id))) }}
                        />
                      )}
                    </Table.Td>
                    <Table.Td>{fecha(m.fecha_operacion)}</Table.Td>
                    <Table.Td>{m.concepto || m.referencia1 || m.numero_documento || ""}</Table.Td>
                    <Table.Td ta="right" style={NUM} c={Number(m.importe) < 0 ? "red.7" : undefined}>{importe(m.importe)}</Table.Td>
                    <Table.Td><Badge variant={m.estado === "descartado" ? "filled" : "light"} color={COLORES[m.estado] || "gray"}>{ESTADOS[m.estado] || m.estado}</Badge></Table.Td>
                    <Table.Td><Propuesta propuesta={m.propuesta} decision={m.decision} fecha={m.fecha_operacion} /></Table.Td>
                    <Table.Td><Acciones movimiento={m} onResolver={resolver} onElegir={setEligiendo} trabajando={resolviendo === m.id} /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="asientos">
            <Stack gap="xs">
              <Text fw={600}>En contabilidad pero no en el banco{sinBanco ? ` (${sinBanco.length})` : ""}</Text>
              {!sinBanco ? (
                <Text c="dimmed" fz="sm">Pulsa «Comparar con la contabilidad» para ver los asientos de la cuenta que no están en el extracto.</Text>
              ) : sinBanco.length === 0 ? <Text c="dimmed" fz="sm">Todos los apuntes de la cuenta están en el extracto.</Text> : (
                <Table withTableBorder fz="sm">
                  <Table.Tbody>
                    {sinBanco.map((a) => (
                      <Table.Tr key={a.pase}>
                        <Table.Td>{fecha(a.fecha)}</Table.Td>
                        <Table.Td>Asiento {a.asiento}{a.es_borrador ? " (borrador)" : ""} · {a.concepto || ""}</Table.Td>
                        <Table.Td ta="right" style={NUM}>{importe(Number(a.debe) - Number(a.haber))}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="lecturas">
          <Stack gap="xs">
            {(cuenta.huecos || []).map((h) => <Alert key={h} color="yellow" title="Advertencia de la lectura">{h}</Alert>)}
            <Text fw={600}>Historial de lecturas: extractos subidos de esta cuenta</Text>
            {extractos.map((e) => (
              <Group key={e.id} justify="space-between">
                <Text fz="sm">{fecha(e.fecha_desde)} a {fecha(e.fecha_hasta)} · saldo {importe(e.saldo_inicial)} → {importe(e.saldo_final)} €{e.cuadra ? "" : " · no cuadra"}</Text>
                <Button size="compact-xs" variant="subtle" color="red" onClick={() => borrarExtracto(e)}>Borrar</Button>
              </Group>
            ))}
          </Stack>
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}

function CuentaBancaria({ proyecto, cuenta, onAbrir, onCambiada, onError }) {
  const [subcuenta, setSubcuenta] = useState(cuenta.subcuenta || "")
  const [guardando, setGuardando] = useState(false)
  const [opciones, setOpciones] = useState([])
  useEffect(() => {
    api.subcuentasBanco(proyecto.id, cuenta.id)
      .then((r) => setOpciones(r.subcuentas.map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.descripcion}` }))))
      .catch((err) => onError(err.message))
  }, [proyecto.id, cuenta.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = () => {
    setGuardando(true)
    api.asociarSubcuenta(proyecto.id, cuenta.id, subcuenta).then(onCambiada).catch((err) => onError(err.message)).finally(() => setGuardando(false))
  }
  const asentados = cuenta.por_estado?.asentado || 0
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Stack gap={2}>
            <Text fw={600}>Cuenta {cuenta.banco}-{cuenta.oficina}-{cuenta.cuenta}</Text>
            <Text fz="sm" c="dimmed">
              {cuenta.extractos} extracto(s) · {cuenta.fecha_desde ? `${fecha(cuenta.fecha_desde)} a ${fecha(cuenta.fecha_hasta)}` : ""} · {cuenta.movimientos} movimientos ({asentados} asentados) · saldo {cuenta.saldo_final != null ? importe(cuenta.saldo_final) : "—"} €
            </Text>
          </Stack>
          <Button variant="default" onClick={() => onAbrir(cuenta)}>Ver cuenta</Button>
        </Group>
        <Group align="flex-end" gap="xs">
          <Select
            id={`conciliacion-subcuenta-${cuenta.id}`} label="Subcuenta del banco en contabilidad" placeholder="Busca por número o por nombre del banco"
            data={opciones} value={subcuenta || null} onChange={(v) => setSubcuenta(v || "")} searchable clearable nothingFoundMessage="Ninguna subcuenta 572 con eso" w={380}
            error={!cuenta.subcuenta ? "Elígela una vez para poder comparar" : undefined}
          />
          <Button onClick={guardar} loading={guardando} disabled={subcuenta === (cuenta.subcuenta || "")}>Guardar</Button>
        </Group>
        {cuenta.huecos.map((h) => <Alert key={h} color="yellow">{h}</Alert>)}
      </Stack>
    </Card>
  )
}

export default function Conciliacion({ proyecto, empresa }) {
  const [cuentas, setCuentas] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const cargar = () => api.listarCuentasBancarias(proyecto.id, empresa.id_empresa).then((r) => setCuentas(r.cuentas)).catch((err) => setError(err.message))
  useEffect(() => { cargar() }, [proyecto.id, empresa.id_empresa]) // eslint-disable-line react-hooks/exhaustive-deps

  const subir = () => {
    setSubiendo(true)
    setError(null)
    setAviso(null)
    api
      .subirExtracto(proyecto.id, empresa.id_empresa, archivo)
      .then((r) => {
        setArchivo(null)
        const solapados = r.creados.reduce((t, e) => t + (e.solapados || 0), 0)
        setAviso(
          [
            r.creados.length && `Subidos ${r.creados.length} extracto(s).`,
            solapados && `${solapados} movimientos ya estaban en extractos anteriores y no se han repetido.`,
            r.repetidos.length && `Ya estaban subidos: ${r.repetidos.join("; ")}.`,
          ].filter(Boolean).join(" "),
        )
        cargar()
      })
      .catch((err) => setError(err.message))
      .finally(() => setSubiendo(false))
  }

  if (abierta) return (
    <Stack>
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      <Movimientos proyecto={proyecto} cuenta={abierta} onVolver={() => { setAbierta(null); cargar() }} onError={setError} />
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
      {!cuentas ? (
        <Text>Cargando...</Text>
      ) : cuentas.length === 0 ? (
        <Text c="dimmed">Todavía no has subido ningún extracto de esta empresa.</Text>
      ) : (
        cuentas.map((c) => <CuentaBancaria key={c.id} proyecto={proyecto} cuenta={c} onAbrir={setAbierta} onCambiada={cargar} onError={setError} />)
      )}
    </Stack>
  )
}
