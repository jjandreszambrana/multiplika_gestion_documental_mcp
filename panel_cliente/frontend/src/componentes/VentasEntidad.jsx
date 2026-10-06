import { useEffect, useState } from "react"
import { Badge, Button, Paper, Table, Text, Timeline } from "@mantine/core"
import { IconPlus } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha, formatearImporte } from "../formato"
import OportunidadModal from "./OportunidadModal"

const COLOR_TIPO = { abierta: "blue", ganada: "green", perdida: "red" }
const NOMBRE_HISTORIAL = {
  documento: "Documento", nota_bloc: "Nota del bloc", envio: "Envío", oportunidad: "Nueva oportunidad",
  cambio_etapa: "Cambio de etapa", contacto: "Nuevo contacto",
}

// Oportunidades de una entidad (todas, también las cerradas), para su ficha.
export function OportunidadesEntidad({ proyecto, idEntidad, onVerDocumento, onCambiadas }) {
  const [datos, setDatos] = useState(null)
  const [etapas, setEtapas] = useState([])
  const [abierta, setAbierta] = useState(undefined)

  function cargar() {
    api.listarOportunidades(proyecto.id, { estado: "todas", id_entidad: idEntidad }).then(setDatos).catch(() => setDatos({ oportunidades: [] }))
  }

  useEffect(() => {
    cargar()
    api.listarEtapas(proyecto.id).then(setEtapas).catch(() => setEtapas([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idEntidad])

  return (
    <>
      {proyecto.puede_editar && (
        <Button variant="default" size="xs" mb="sm" leftSection={<IconPlus size={14} />} onClick={() => setAbierta(null)}>
          Nueva oportunidad
        </Button>
      )}
      {!datos ? (
        <Text>Cargando...</Text>
      ) : datos.oportunidades.length === 0 ? (
        <Text c="dimmed">Sin oportunidades de venta.</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Tbody>
              {datos.oportunidades.map((o) => (
                <Table.Tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setAbierta(o.id)}>
                  <Table.Td fw={500}>{o.titulo}</Table.Td>
                  <Table.Td><Badge variant="light" color={COLOR_TIPO[o.tipo_etapa]} tt="none">{o.etapa}</Badge></Table.Td>
                  <Table.Td ta="right">{formatearImporte(o.importe)}</Table.Td>
                  <Table.Td c="dimmed" fz="13px">
                    {o.fecha_cierre ? `Cerrada ${formatearFecha(o.fecha_cierre)}` : o.fecha_prevista_cierre ? `Cierre ${formatearFecha(o.fecha_prevista_cierre)}` : ""}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      <OportunidadModal
        opened={abierta !== undefined} onClose={() => setAbierta(undefined)} proyecto={proyecto}
        idOportunidad={abierta ?? null} idEntidadInicial={idEntidad} etapas={etapas}
        onGuardada={() => { cargar(); onCambiadas?.() }} onVerDocumento={onVerDocumento}
      />
    </>
  )
}

// Todo lo que ha pasado con la entidad, lo último arriba.
export function HistorialEntidad({ proyecto, idEntidad, version }) {
  const [filas, setFilas] = useState(null)

  useEffect(() => {
    api.historialEntidad(proyecto.id, idEntidad).then(setFilas).catch(() => setFilas([]))
  }, [proyecto.id, idEntidad, version])

  if (!filas) return <Text>Cargando...</Text>
  if (filas.length === 0) return <Text c="dimmed">Todavía no hay nada.</Text>
  return (
    <Timeline bulletSize={12} lineWidth={2}>
      {filas.map((f, i) => (
        <Timeline.Item key={`${f.tipo}-${f.id}-${i}`} title={<Text size="sm" fw={500}>{f.titulo}</Text>}>
          <Text size="12px" c="dimmed">
            {NOMBRE_HISTORIAL[f.tipo] || f.tipo}{f.detalle ? ` · ${f.detalle}` : ""} · {formatearFecha(f.fecha).slice(0, 16)}
          </Text>
        </Timeline.Item>
      ))}
    </Timeline>
  )
}

// Lo que dice el ERP (SIF o Excel importado) de la entidad.
export function FacturacionEntidad({ proyecto, idEntidad }) {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    api.datosErpEntidad(proyecto.id, idEntidad).then(setDatos).catch(() => setDatos({ resumen: null, facturas: [] }))
  }, [proyecto.id, idEntidad])

  if (!datos) return <Text>Cargando...</Text>
  const r = datos.resumen
  if (!r) return <Text c="dimmed">Sin facturas del ERP. Llegan de Multiplika SIF o importando un Excel desde Ventas.</Text>
  const origen = r.origenes.includes("sif") ? "Multiplika SIF" : "el Excel importado"
  return (
    <>
      <Text size="sm" mb={4}>
        Facturado en {r.anio}: <b>{formatearImporte(r.facturado_anio)}</b> · en {r.anio - 1}: <b>{formatearImporte(r.facturado_anio_anterior)}</b>
        {r.pendiente_cobro != null && <> · pendiente de cobro: <b style={{ color: r.pendiente_cobro > 0 ? "var(--mantine-color-red-7)" : undefined }}>{formatearImporte(r.pendiente_cobro)}</b></>}
      </Text>
      <Text size="12px" c="dimmed" mb="sm">
        Según {origen}, datos del {formatearFecha(r.fecha_datos).slice(0, 16)}.{r.incluye_impuestos ? " Lo facturado va con impuestos donde no se sabe la base." : ""}
      </Text>
      <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
        <Table striped verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr><Table.Th>Factura</Table.Th><Table.Th>Fecha</Table.Th><Table.Th ta="right">Total</Table.Th><Table.Th ta="right">Pendiente</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {datos.facturas.slice(0, 15).map((f) => (
              <Table.Tr key={f.id} style={{ opacity: f.anulada ? 0.5 : 1 }}>
                <Table.Td>{f.numero}{f.anulada ? " (anulada)" : ""}</Table.Td>
                <Table.Td>{formatearFecha(f.fecha)}</Table.Td>
                <Table.Td ta="right">{formatearImporte(f.total)}</Table.Td>
                <Table.Td ta="right">{formatearImporte(f.pendiente_cobro)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </>
  )
}
