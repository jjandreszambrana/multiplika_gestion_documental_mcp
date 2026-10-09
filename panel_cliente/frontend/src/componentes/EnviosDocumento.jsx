import { useEffect, useMemo, useState } from "react"
import {
  Alert, Badge, Button, Group, MultiSelect, Paper, Select, Stack, Table, Text, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconSend, IconUsers } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import Markdown from "./Markdown"

const PATRON_VARIABLE = /\{\{\s*(\w+)\s*\}\}/g

function resolverVariables(texto, valores) {
  return texto.replace(PATRON_VARIABLE, (coincidencia, nombre) => {
    const valor = valores[nombre]
    return valor === undefined || valor === null || valor === "" ? coincidencia : String(valor)
  })
}

const ESTADO_COLOR = { programado: "blue", enviado: "green", fallido: "red", cancelado: "gray" }
const ESTADO_LABEL = { programado: "Programado", enviado: "Enviado", fallido: "Fallido", cancelado: "Cancelado" }

function FilaEnvio({ proyecto, envio, onCambiado }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  async function cancelar() {
    setCargando(true)
    setError(null)
    try {
      await api.cancelarEnvio(proyecto.id, envio.id)
      await onCambiado()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function reintentar() {
    setCargando(true)
    setError(null)
    try {
      await api.reintentarEnvio(proyecto.id, envio.id)
      await onCambiado()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Table.Tr>
      <Table.Td fw={500}>{envio.entidad_nombre}</Table.Td>
      <Table.Td>
        <Text size="13px" c="dimmed" lineClamp={1} maw={220}>
          {envio.asunto}
        </Text>
      </Table.Td>
      <Table.Td>
        <Tooltip label={envio.error} disabled={!envio.error}>
          <Badge color={ESTADO_COLOR[envio.estado]} variant="light">
            {ESTADO_LABEL[envio.estado]}
          </Badge>
        </Tooltip>
      </Table.Td>
      <Table.Td>
        <Text size="13px" c="dimmed">
          {envio.estado === "programado"
            ? `Para el ${formatearFecha(envio.fecha_programada)}`
            : envio.fecha_envio
              ? formatearFecha(envio.fecha_envio)
              : formatearFecha(envio.fecha_creacion)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap="8" wrap="nowrap">
          {proyecto.puede_editar && envio.estado === "programado" && (
            <Button size="compact-xs" variant="subtle" color="red" onClick={cancelar} loading={cargando}>
              Cancelar
            </Button>
          )}
          {proyecto.puede_editar && envio.estado === "fallido" && (
            <Button size="compact-xs" variant="subtle" onClick={reintentar} loading={cargando}>
              Reintentar
            </Button>
          )}
        </Group>
        {error && (
          <Text size="11px" c="red">
            {error}
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  )
}

export default function EnviosDocumento({ proyecto, idDocumento, documento, refresco }) {
  const [variables, setVariables] = useState(null)
  const [entidades, setEntidades] = useState([])
  const [entidadesVinculadas, setEntidadesVinculadas] = useState([])
  const [envios, setEnvios] = useState(null)
  const [error, setError] = useState(null)

  const [idsSeleccionadas, setIdsSeleccionadas] = useState([])
  const [valoresPersonalizados, setValoresPersonalizados] = useState({})
  const [fechaProgramada, setFechaProgramada] = useState("")
  const [idEntidadPreview, setIdEntidadPreview] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function recargarEnvios() {
    return api.listarEnviosDocumento(proyecto.id, idDocumento).then(setEnvios).catch((err) => setError(err.message))
  }

  useEffect(() => {
    api.detectarVariablesDocumento(proyecto.id, idDocumento).then(setVariables).catch((err) => setError(err.message))
    api.listarEntidades(proyecto.id).then(setEntidades).catch(() => setEntidades([]))
    api.listarEntidadesDocumento(proyecto.id, idDocumento).then(setEntidadesVinculadas).catch(() => setEntidadesVinculadas([]))
    recargarEnvios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento, refresco])

  const entidadesPorId = useMemo(() => Object.fromEntries(entidades.map((e) => [String(e.id), e])), [entidades])

  const opcionesEntidad = entidades.map((e) => ({
    value: String(e.id),
    label: e.email ? `${e.nombre} (${e.tipo})` : `${e.nombre} (${e.tipo}) — sin email`,
  }))

  const idEntidadPreviewEfectiva = idEntidadPreview || idsSeleccionadas[0] || null
  const entidadPreview = idEntidadPreviewEfectiva ? entidadesPorId[idEntidadPreviewEfectiva] : null

  const valoresPreview = { ...(entidadPreview || {}), ...valoresPersonalizados }
  const asuntoPreview = documento ? resolverVariables(documento.nombre, valoresPreview) : ""
  const cuerpoPreview = documento ? resolverVariables(documento.markdown || "", valoresPreview) : ""

  function anadirVinculadas() {
    const idsVinculadas = entidadesVinculadas.map((e) => String(e.id))
    setIdsSeleccionadas([...new Set([...idsSeleccionadas, ...idsVinculadas])])
  }

  const faltanVinculadasPorAnadir = entidadesVinculadas.some((e) => !idsSeleccionadas.includes(String(e.id)))

  async function enviar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await api.crearEnvios(proyecto.id, idDocumento, {
        ids_entidad: idsSeleccionadas.map(Number),
        variables_personalizadas: valoresPersonalizados,
        fecha_programada: fechaProgramada ? new Date(fechaProgramada).toISOString() : null,
        enviar_ya: !fechaProgramada,
      })
      setIdsSeleccionadas([])
      setValoresPersonalizados({})
      setFechaProgramada("")
      await recargarEnvios()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!variables) {
    return <Text c="dimmed">Cargando...</Text>
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={4} fz="16px" mb="6">
          Enviar como comunicación
        </Title>
        <Text size="12.5px" c="dimmed" maw={620}>
          Este documento se usa como plantilla: cualquier <code>{"{{variable}}"}</code> en su nombre o contenido se
          sustituye antes de mandarlo. Las que coincidan con un campo de la entidad (nombre, email, dirección...) se
          rellenan solas; el resto las escribes aquí, con el mismo valor para todas las entidades que elijas.
        </Text>
      </div>

      {variables.auto.length === 0 && variables.personalizadas.length === 0 && (
        <Text size="12.5px" c="dimmed">
          No se ha detectado ninguna variable — se mandará el contenido tal cual a quien elijas.
        </Text>
      )}
      {variables.auto.length > 0 && (
        <Text size="12.5px" c="dimmed">
          Se rellenan solas: {variables.auto.join(", ")}
        </Text>
      )}

      <form onSubmit={enviar}>
        <Stack gap="10">
          <MultiSelect
            label="Enviar a" placeholder="Busca entidades..." data={opcionesEntidad}
            value={idsSeleccionadas} onChange={setIdsSeleccionadas}
            searchable required
          />

          {entidadesVinculadas.length > 0 && faltanVinculadasPorAnadir && (
            <Button
              variant="light" size="xs" leftSection={<IconUsers size={13} />}
              onClick={anadirVinculadas} style={{ alignSelf: "flex-start" }}
            >
              Añadir {entidadesVinculadas.length === 1 ? "la entidad vinculada" : `las ${entidadesVinculadas.length} entidades vinculadas`} a este documento
            </Button>
          )}

          {variables.personalizadas.map((v) => (
            <TextInput
              key={v} label={v} required
              value={valoresPersonalizados[v] || ""}
              onChange={(e) => setValoresPersonalizados({ ...valoresPersonalizados, [v]: e.currentTarget.value })}
            />
          ))}

          <TextInput
            label="Programar para (déjalo vacío para mandar ya)"
            type="datetime-local"
            value={fechaProgramada}
            onChange={(e) => setFechaProgramada(e.currentTarget.value)}
            maw={260}
          />

          {idsSeleccionadas.length > 0 && (
            <Paper withBorder radius="lg" p="16">
              <Group justify="space-between" mb="8">
                <Text size="12.5px" fw={600} c="dimmed" tt="uppercase">
                  Vista previa
                </Text>
                {idsSeleccionadas.length > 1 && (
                  <Select
                    size="xs" data={idsSeleccionadas.map((id) => ({ value: id, label: entidadesPorId[id]?.nombre || id }))}
                    value={idEntidadPreviewEfectiva} onChange={setIdEntidadPreview}
                    w={200}
                  />
                )}
              </Group>
              <Text fw={600} mb="8">
                {asuntoPreview}
              </Text>
              <Markdown>{cuerpoPreview}</Markdown>
            </Paper>
          )}

          {error && <Alert color="red">{error}</Alert>}

          {proyecto.puede_editar && (
            <Button
              type="submit" loading={enviando} disabled={idsSeleccionadas.length === 0}
              leftSection={<IconSend size={15} stroke={1.8} />}
              style={{ alignSelf: "flex-start" }}
            >
              {fechaProgramada ? `Programar para ${idsSeleccionadas.length} entidad(es)` : `Enviar ya a ${idsSeleccionadas.length} entidad(es)`}
            </Button>
          )}
        </Stack>
      </form>

      <div>
        <Title order={4} fz="16px" mb="10">
          Envíos
        </Title>
        {!envios ? (
          <Text c="dimmed">Cargando...</Text>
        ) : envios.length === 0 ? (
          <Text c="dimmed">Todavía no se ha mandado ni programado ningún envío de este documento.</Text>
        ) : (
          <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Entidad</Table.Th>
                  <Table.Th>Asunto</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {envios.map((envio) => (
                  <FilaEnvio key={envio.id} proyecto={proyecto} envio={envio} onCambiado={recargarEnvios} />
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </div>
    </Stack>
  )
}
