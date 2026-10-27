import { useEffect, useState } from "react"
import { Alert, Badge, Button, Card, FileInput, Group, SegmentedControl, Stack, Table, Text } from "@mantine/core"
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

function Propuesta({ propuesta }) {
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

function Acciones({ movimiento, onResolver, trabajando }) {
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
  const resolver = (m, accion, sinFactura = false) => {
    setResolviendo(m.id)
    api
      .resolverMovimientoBancario(proyecto.id, extracto.id, m.id, { accion, sin_factura: sinFactura })
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
                    <Table.Td><Propuesta propuesta={m.propuesta} /></Table.Td>
                    <Table.Td><Acciones movimiento={m} onResolver={resolver} trabajando={resolviendo === m.id} /></Table.Td>
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
