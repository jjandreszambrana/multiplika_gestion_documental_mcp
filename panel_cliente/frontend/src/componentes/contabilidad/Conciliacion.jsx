import { useEffect, useState } from "react"
import { Alert, Badge, Button, Card, FileInput, Group, Stack, Table, Text } from "@mantine/core"
import { api } from "../../api"

// Conciliación bancaria (ver docs/planificacion/conciliacion-bancaria.md).
// Esta fase sube el extracto (Norma 43) y lo enseña; el emparejado con las
// facturas del SIF llega después. La GD no escribe nada en el SIF.

const importe = (n) => Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (f) => new Date(f).toLocaleDateString("es-ES")
const ESTADOS = {
  sin_emparejar: "Sin emparejar", exacto: "Exacto", dudoso: "Dudoso", confirmado: "Confirmado", descartado: "Descartado",
}
const NUM = { fontVariantNumeric: "tabular-nums" }

function Movimientos({ proyecto, extracto, onVolver, onError }) {
  const [datos, setDatos] = useState(null)
  useEffect(() => {
    api.movimientosExtracto(proyecto.id, extracto.id).then(setDatos).catch((err) => onError(err.message))
  }, [proyecto.id, extracto.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>
          Cuenta {extracto.banco}-{extracto.oficina}-{extracto.cuenta} · {fecha(extracto.fecha_desde)} a {fecha(extracto.fecha_hasta)}
        </Text>
        <Button variant="default" onClick={onVolver}>Volver a los extractos</Button>
      </Group>
      {!extracto.cuadra && (
        <Alert color="yellow">
          Los movimientos de este extracto no suman lo que dice el banco: del saldo inicial {importe(extracto.saldo_inicial)} € al final {importe(extracto.saldo_final)} €. Puede que falte alguna línea.
        </Alert>
      )}
      {!datos ? (
        <Text>Cargando...</Text>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table withTableBorder fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th><Table.Th>Concepto</Table.Th><Table.Th ta="right">Importe</Table.Th><Table.Th>Estado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {datos.movimientos.map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td>{fecha(m.fecha_operacion)}</Table.Td>
                  <Table.Td>{m.concepto || m.referencia1 || m.numero_documento || ""}</Table.Td>
                  <Table.Td ta="right" style={NUM} c={Number(m.importe) < 0 ? "red.7" : undefined}>{importe(m.importe)}</Table.Td>
                  <Table.Td><Badge variant="light" color="gray">{ESTADOS[m.estado] || m.estado}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
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
