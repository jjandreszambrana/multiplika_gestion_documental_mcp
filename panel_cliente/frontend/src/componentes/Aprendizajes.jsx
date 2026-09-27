import { useEffect, useState } from "react"
import { Alert, Badge, Button, Group, List, Paper, Select, Stack, Table, Text, Textarea, useComputedColorScheme } from "@mantine/core"
import MDEditor from "@uiw/react-md-editor"
import { api } from "../api"
import { formatearFecha } from "../formato"
import Markdown from "./Markdown"

const ETIQUETA_ESTADO = {
  candidato: ["Candidato", "gray"],
  pendiente_revision: ["Pendiente de revisión", "yellow"],
  aprobado: ["Aprobado", "green"],
  rechazado: ["Rechazado", "red"],
}

function BadgeEstado({ estado }) {
  const [texto, color] = ETIQUETA_ESTADO[estado] || [estado, "gray"]
  return <Badge color={color} variant="light" tt="none" fw={500}>{texto}</Badge>
}

function ElegirDocumentos({ proyecto, enlaces, alAspirar }) {
  const [idEnlace, setIdEnlace] = useState(null)
  const [documentos, setDocumentos] = useState(null)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(null)

  useEffect(() => {
    if (!idEnlace) return
    setDocumentos(null)
    setError(null)
    api.listarDocumentosDeEnlazada(proyecto.id, Number(idEnlace)).then(setDocumentos).catch((err) => setError(err.message))
  }, [proyecto.id, idEnlace])

  async function aspirar(doc) {
    setOcupado(doc.id_documento)
    setError(null)
    try {
      const creado = await api.aspirarAprendizaje(proyecto.id, Number(idEnlace), doc.id_documento)
      setDocumentos(documentos.map((d) => (d.id_documento === doc.id_documento ? { ...d, estado_aprendizaje: creado.estado, id_aprendizaje: creado.id } : d)))
      alAspirar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Stack gap="sm">
      <Select
        label="GD enlazada de la que aspirar" placeholder="Elige una" w={320}
        data={enlaces.map((e) => ({ value: String(e.id), label: e.nombre }))}
        value={idEnlace} onChange={setIdEnlace}
      />
      {error && <Alert color="red">{error}</Alert>}
      {idEnlace && documentos === null && !error && <Text>Consultando a la otra GD...</Text>}
      {documentos && documentos.length === 0 && <Text c="dimmed">Esa GD no tiene documentos compartibles.</Text>}
      {documentos && documentos.length > 0 && (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Documento</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Alta</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {documentos.map((d) => (
              <Table.Tr key={d.id_documento}>
                <Table.Td fw={500}>{d.nombre}</Table.Td>
                <Table.Td>{d.tipo_documento}</Table.Td>
                <Table.Td>{formatearFecha(d.fecha_alta)}</Table.Td>
                <Table.Td>
                  {d.estado_aprendizaje ? (
                    <BadgeEstado estado={d.estado_aprendizaje} />
                  ) : (
                    <Button size="compact-sm" variant="default" onClick={() => aspirar(d)} loading={ocupado === d.id_documento}>
                      Aspirar resumen
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

function DetalleAprendizaje({ proyecto, id, alCambiar, alCerrar }) {
  const [aprendizaje, setAprendizaje] = useState(null)
  const [markdown, setMarkdown] = useState("")
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const esquema = useComputedColorScheme("light")

  function cargar() {
    return api.obtenerAprendizaje(proyecto.id, id).then((a) => { setAprendizaje(a); setMarkdown(a.markdown_anonimizado || "") }).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, id])

  async function accion(fn) {
    setOcupado(true)
    setError(null)
    try {
      await fn()
      await cargar()
      alCambiar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  if (!aprendizaje) return error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>

  const pendiente = aprendizaje.estado === "pendiente_revision"
  return (
    <Paper withBorder p="md">
      <Group justify="space-between" align="flex-start" mb="sm">
        <div>
          <Group gap="xs">
            <Text fw={600}>{aprendizaje.nombre}</Text>
            <BadgeEstado estado={aprendizaje.estado} />
          </Group>
          <Text c="dimmed" fz="12.5px">
            {aprendizaje.tipo_documento} · de {aprendizaje.origen} · {formatearFecha(aprendizaje.fecha_actualizacion)}
          </Text>
        </div>
        <Button variant="subtle" size="compact-sm" onClick={alCerrar}>Cerrar</Button>
      </Group>

      <Text fz="13.5px" mb="md">{aprendizaje.resumen}</Text>
      {error && <Alert color="red" mb="sm">{error}</Alert>}

      {aprendizaje.estado === "candidato" && (
        <Stack gap="xs">
          <Text c="dimmed" fz="13px">
            Dar vía libre trae el documento completo y la IA hace una copia sin nombres ni datos que identifiquen a nadie.
            Después la revisas aquí antes de aprobarla.
          </Text>
          <Group>
            <Button onClick={() => accion(() => api.darViaLibreAprendizaje(proyecto.id, id))} loading={ocupado}>Dar vía libre</Button>
            <Textarea placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} autosize minRows={1} w={300} />
            <Button variant="default" color="red" onClick={() => accion(() => api.rechazarAprendizaje(proyecto.id, id, motivo))} disabled={ocupado}>Rechazar</Button>
          </Group>
        </Stack>
      )}

      {pendiente && (
        <Stack gap="sm">
          {aprendizaje.sustituciones?.length > 0 && (
            <div>
              <Text fw={500} fz="13px" mb="4">Qué se sustituyó</Text>
              <List fz="13px">{aprendizaje.sustituciones.map((s, i) => <List.Item key={i}>{s}</List.Item>)}</List>
            </div>
          )}
          <Text c="dimmed" fz="13px">
            Lee la copia con atención: la IA puede haber dejado algún nombre. Corrígela aquí si hace falta y aprueba solo cuando no quede nada identificable.
          </Text>
          <div data-color-mode={esquema}>
            <MDEditor value={markdown} onChange={(v) => setMarkdown(v || "")} height={480} preview="live" />
          </div>
          <Group>
            <Button variant="default" onClick={() => accion(() => api.editarAprendizaje(proyecto.id, id, markdown))} loading={ocupado} disabled={markdown === aprendizaje.markdown_anonimizado}>
              Guardar cambios
            </Button>
            <Button
              color="green"
              onClick={() => accion(async () => { if (markdown !== aprendizaje.markdown_anonimizado) await api.editarAprendizaje(proyecto.id, id, markdown); await api.aprobarAprendizaje(proyecto.id, id) })}
              loading={ocupado}
            >
              Aprobar e incorporar
            </Button>
            <Textarea placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} autosize minRows={1} w={260} />
            <Button variant="default" color="red" onClick={() => accion(() => api.rechazarAprendizaje(proyecto.id, id, motivo))} disabled={ocupado}>Rechazar</Button>
          </Group>
        </Stack>
      )}

      {aprendizaje.estado === "aprobado" && (
        <Stack gap="xs">
          <Text fz="13px">Incorporado como documento nº {aprendizaje.id_documento_creado} de esta central.</Text>
          <div className="contenido-documento"><Markdown>{aprendizaje.markdown_anonimizado || ""}</Markdown></div>
        </Stack>
      )}

      {aprendizaje.estado === "rechazado" && (
        <Group>
          <Text fz="13px" c="dimmed">{aprendizaje.motivo_rechazo ? `Motivo: ${aprendizaje.motivo_rechazo}` : "Sin motivo indicado."}</Text>
          <Button size="compact-sm" variant="default" onClick={() => accion(() => api.reabrirAprendizaje(proyecto.id, id))} loading={ocupado}>Volver a candidato</Button>
        </Group>
      )}
    </Paper>
  )
}

export default function Aprendizajes({ proyecto }) {
  const [enlazadas, setEnlazadas] = useState([])
  const [estado, setEstado] = useState("")
  const [lista, setLista] = useState(null)
  const [idActivo, setIdActivo] = useState(null)
  const [error, setError] = useState(null)

  function cargarLista(estadoConsulta = estado) {
    return api.listarAprendizajes(proyecto.id, estadoConsulta || null).then(setLista).catch((err) => setError(err.message))
  }

  useEffect(() => {
    api.listarEnlaces(proyecto.id).then((e) => setEnlazadas(e.filter((x) => x.sentido === "enlazada" && x.activo))).catch((err) => setError(err.message))
    cargarLista("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  return (
    <Stack gap="lg">
      <Text c="dimmed" fz="13px" maw={640}>
        Lo que esta central aprende de las GDs que la consultan: eliges un documento, ves su resumen, le das vía
        libre para que la IA haga una copia sin datos identificativos, la revisas y la apruebas. El documento
        original de la otra GD no se toca nunca.
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {enlazadas.length === 0 ? (
        <Text c="dimmed">Ninguna GD te tiene como central todavía, así que no hay de dónde aprender.</Text>
      ) : (
        <ElegirDocumentos proyecto={proyecto} enlaces={enlazadas} alAspirar={() => cargarLista()} />
      )}

      {idActivo && <DetalleAprendizaje proyecto={proyecto} id={idActivo} alCambiar={() => cargarLista()} alCerrar={() => setIdActivo(null)} />}

      <Group>
        <Text fw={600}>Aprendizajes</Text>
        <Select
          w={220} value={estado} onChange={(v) => { setEstado(v || ""); cargarLista(v || "") }} allowDeselect={false}
          data={[{ value: "", label: "Todos" }, ...Object.entries(ETIQUETA_ESTADO).map(([v, [l]]) => ({ value: v, label: l }))]}
        />
      </Group>
      {lista === null ? (
        <Text>Cargando...</Text>
      ) : lista.length === 0 ? (
        <Text c="dimmed">Nada por aquí.</Text>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Documento</Table.Th>
              <Table.Th>De</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Actualizado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lista.map((a) => (
              <Table.Tr key={a.id} onClick={() => setIdActivo(a.id)} style={{ cursor: "pointer" }}>
                <Table.Td fw={500}>{a.nombre}</Table.Td>
                <Table.Td>{a.origen}</Table.Td>
                <Table.Td><BadgeEstado estado={a.estado} /></Table.Td>
                <Table.Td>{formatearFecha(a.fecha_actualizacion)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
