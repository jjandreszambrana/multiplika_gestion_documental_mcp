import { useEffect, useState } from "react"
import {
  Alert, Badge, Button, Card, Group, SegmentedControl, Stack, Table, Text, Textarea,
} from "@mantine/core"
import { api } from "../../api"
import Markdown from "../Markdown"
import CuentaMayor from "./CuentaMayor"

// Bandeja de propuestas de la IA y avisos de la revisión automática (ver
// docs/contabilidad/planificacion.md → fase 4). Aceptar un asiento o un
// aviso no toca el SIF: lo pasa el contable. Aceptar un apartado de la
// memoria sí lo guarda en el SIF, con la clave de quien acepta.

const TIPOS = { asiento: "Asiento", reclasificacion: "Reclasificación", aviso: "Aviso", memoria: "Memoria" }
const importe = (n) => (n ? Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2 }) : "")

function Asiento({ detalle }) {
  return (
    <Stack gap={4}>
      <Text fz="sm">{detalle.fecha} · {detalle.concepto}</Text>
      <Table withTableBorder fz="sm">
        <Table.Thead>
          <Table.Tr><Table.Th>Cuenta</Table.Th><Table.Th>Concepto</Table.Th><Table.Th ta="right">Debe</Table.Th><Table.Th ta="right">Haber</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detalle.apuntes.map((a, i) => (
            <Table.Tr key={i}>
              <Table.Td><CuentaMayor cuenta={a.cuenta} ejercicio={String(detalle.fecha || "").slice(0, 4)} /></Table.Td><Table.Td>{a.concepto}</Table.Td>
              <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>{importe(a.debe)}</Table.Td>
              <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>{importe(a.haber)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

function Propuesta({ proyecto, propuesta, onResuelta, onError }) {
  const [texto, setTexto] = useState(propuesta.detalle?.texto || "")
  const [motivo, setMotivo] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const pendiente = propuesta.estado === "pendiente"

  const deshacer = () => {
    setTrabajando(true)
    api
      .deshacerPropuestaContable(proyecto.id, propuesta.id)
      .then(onResuelta)
      .catch((err) => onError(err.message))
      .finally(() => setTrabajando(false))
  }
  const enDiario = propuesta.estado === "aceptada" && propuesta.tipo === "asiento" && propuesta.detalle?.borrador

  const resolver = (aceptar) => {
    setTrabajando(true)
    api
      .resolverPropuestaContable(proyecto.id, propuesta.id, { aceptar, motivo: motivo || null, texto: propuesta.tipo === "memoria" ? texto : null })
      .then(onResuelta)
      .catch((err) => onError(err.message))
      .finally(() => setTrabajando(false))
  }

  return (
    <Card withBorder>
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Badge variant="light">{TIPOS[propuesta.tipo] || propuesta.tipo}</Badge>
            <Text fw={600}>{propuesta.titulo}</Text>
          </Group>
          <Text fz="xs" c="dimmed">
            {propuesta.creado_por} · {new Date(propuesta.fecha_alta).toLocaleString("es-ES")}
          </Text>
        </Group>
        {propuesta.justificacion && <Text fz="sm">{propuesta.justificacion}</Text>}
        {["asiento", "reclasificacion"].includes(propuesta.tipo) && propuesta.detalle && <Asiento detalle={propuesta.detalle} />}
        {propuesta.tipo === "aviso" && propuesta.detalle?.cuentas && (
          <Text fz="sm">
            {propuesta.detalle.cuentas.map((c) => `${c.cuenta}${c.descripcion ? ` ${c.descripcion}` : ""}: ${importe(c.saldo)}`).join(" · ")}
          </Text>
        )}
        {propuesta.tipo === "memoria" && (
          pendiente ? (
            <Textarea id={`memoria-texto-${propuesta.id}`} aria-label="Texto del apartado" autosize minRows={6} value={texto} onChange={(e) => setTexto(e.currentTarget.value)} />
          ) : (
            <Markdown>{propuesta.detalle?.texto}</Markdown>
          )
        )}
        {propuesta.tipo === "memoria" && propuesta.detalle?.pendientes?.length > 0 && (
          <Alert color="yellow" p="xs">
            Faltan datos que solo podéis dar vosotros: {propuesta.detalle.pendientes.map((p) => p.descripcion).join("; ")}. Pídeselo a la IA en el chat o complétalos en el texto.
          </Alert>
        )}
        {pendiente ? (
          <Group align="flex-end" wrap="wrap">
            <Button onClick={() => resolver(true)} loading={trabajando}>
              {propuesta.tipo === "memoria" ? "Aceptar y guardar en el SIF" : propuesta.tipo === "aviso" ? "Revisado" : propuesta.tipo === "asiento" ? "Aceptar y dejar en Diario" : "Aceptar (la paso yo al SIF)"}
            </Button>
            <Textarea id={`motivo-${propuesta.id}`} aria-label="Motivo de descartarla" placeholder="Motivo (opcional)" autosize minRows={1} value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} style={{ flex: 1, minWidth: 200 }} />
            <Button variant="default" onClick={() => resolver(false)} loading={trabajando}>Descartar</Button>
          </Group>
        ) : (
          <Group justify="space-between" wrap="wrap">
            <Text fz="sm" c="dimmed">
              {propuesta.estado === "aceptada"
                ? (propuesta.tipo === "asiento"
                  ? (propuesta.detalle?.borrador?.final === "confirmado" ? "Aceptada: ya está confirmado en el Diario" : "Aceptada: queda en el Diario, pendiente de que lo confirmes allí")
                  : "Aceptada")
                : `Descartada${propuesta.motivo_descarte ? `: ${propuesta.motivo_descarte}` : ""}`}
            </Text>
            {enDiario && propuesta.detalle.borrador.final !== "confirmado" && (
              <Button size="compact-xs" variant="default" onClick={deshacer} loading={trabajando}>Deshacer (quitar del Diario)</Button>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  )
}

export default function PropuestasContables({ proyecto, empresa }) {
  const [estado, setEstado] = useState("pendiente")
  const [propuestas, setPropuestas] = useState(null)
  const [error, setError] = useState(null)

  const cargar = () => {
    setPropuestas(null)
    api.listarPropuestasContables(proyecto.id, empresa.id_empresa, estado).then((r) => setPropuestas(r.propuestas)).catch((err) => setError(err.message))
  }
  useEffect(cargar, [proyecto.id, empresa.id_empresa, estado])

  return (
    <Stack gap="md">
      <SegmentedControl
        value={estado} onChange={setEstado} w="fit-content"
        data={[{ value: "pendiente", label: "Pendientes" }, { value: "aceptada", label: "Aceptadas" }, { value: "descartada", label: "Descartadas" }]}
      />
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {!propuestas ? (
        <Text>Cargando...</Text>
      ) : propuestas.length === 0 ? (
        <Text c="dimmed">No hay propuestas. Pídele a la IA en el chat que revise la contabilidad o que prepare un asiento.</Text>
      ) : (
        propuestas.map((p) => <Propuesta key={p.id} proyecto={proyecto} propuesta={p} onResuelta={cargar} onError={setError} />)
      )}
    </Stack>
  )
}
