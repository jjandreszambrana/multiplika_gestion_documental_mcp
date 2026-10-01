import { useEffect, useState } from "react"
import { Alert, Badge, Button, Group, Paper, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core"
import { IconCheck, IconLink, IconPlus } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import ControlSeguimiento from "./Seguimiento"

const TIPOS = [
  { value: "comentario", label: "Comentario", color: "gray" },
  { value: "anotacion", label: "Anotación", color: "blue" },
  { value: "observacion", label: "Observación", color: "grape" },
  { value: "incidencia", label: "Incidencia", color: "red" },
  { value: "resolucion", label: "Resolución", color: "green" },
]

function infoTipo(tipo) {
  return TIPOS.find((t) => t.value === tipo) || { label: tipo, color: "gray" }
}

function resumen(texto, limite = 40) {
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto
}

function Nota({ proyecto, idDocumento, notas, nota, onCambiado }) {
  const [resolviendo, setResolviendo] = useState(false)
  const [textoResolucion, setTextoResolucion] = useState("")
  const [relacionando, setRelacionando] = useState(false)
  const [idDestino, setIdDestino] = useState(null)
  const [tipoRelacion, setTipoRelacion] = useState("")
  const [editandoResponsable, setEditandoResponsable] = useState(false)
  const [nuevoResponsable, setNuevoResponsable] = useState(nota.responsable || "")
  const [nuevoResponsableEmail, setNuevoResponsableEmail] = useState(nota.responsable_email || "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const esIncidenciaAbierta = nota.tipo === "incidencia" && nota.estado === "abierta"

  async function resolver() {
    setGuardando(true)
    setError(null)
    try {
      await api.resolverIncidencia(proyecto.id, idDocumento, nota.id, textoResolucion)
      setResolviendo(false)
      setTextoResolucion("")
      await onCambiado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function relacionar() {
    if (!idDestino) return
    setGuardando(true)
    setError(null)
    try {
      await api.relacionarNotas(proyecto.id, idDocumento, nota.id, Number(idDestino), tipoRelacion || null)
      setRelacionando(false)
      setIdDestino(null)
      setTipoRelacion("")
      await onCambiado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarResponsable() {
    setGuardando(true)
    setError(null)
    try {
      await api.asignarResponsableNota(proyecto.id, idDocumento, nota.id, nuevoResponsable, nuevoResponsableEmail)
      setEditandoResponsable(false)
      await onCambiado()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const opcionesRelacion = notas
    .filter((n) => n.id !== nota.id)
    .map((r) => ({ value: String(r.id), label: `#${r.id} · ${infoTipo(r.tipo).label} — ${resumen(r.texto)}` }))

  return (
    <Paper withBorder radius="lg" p="14">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="8" wrap="nowrap">
          <Badge color={infoTipo(nota.tipo).color} variant="light">
            {infoTipo(nota.tipo).label}
          </Badge>
          {nota.tipo === "incidencia" && (
            <Badge color={nota.estado === "abierta" ? "orange" : "green"} variant="light">
              {nota.estado === "abierta" ? "Abierta" : "Resuelta"}
            </Badge>
          )}
          <ControlSeguimiento proyecto={proyecto} tipo="nota_documento" idObjeto={nota.id} seguimiento={nota.seguimiento} size="xs" />
        </Group>
        <Text size="11.5px" c="dimmed">
          {nota.creado_por} · {formatearFecha(nota.fecha_creacion)}
        </Text>
      </Group>

      <Text size="13.5px" mt="8" style={{ whiteSpace: "pre-wrap" }}>
        {nota.texto}
      </Text>

      {!editandoResponsable ? (
        <Group gap="6" mt="8">
          <Text size="12px" c="dimmed">
            {nota.responsable
              ? `Responsable: ${nota.responsable}${nota.responsable_email ? ` (${nota.responsable_email})` : ""}`
              : "Sin responsable asignado"}
          </Text>
          <Text
            component="button" type="button" size="12px" c="acento"
            onClick={() => setEditandoResponsable(true)}
            style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
          >
            {nota.responsable ? "Cambiar" : "Asignar"}
          </Text>
        </Group>
      ) : (
        <Group gap="6" mt="8">
          <TextInput
            size="xs" value={nuevoResponsable} placeholder="Nombre del responsable"
            onChange={(e) => setNuevoResponsable(e.currentTarget.value)}
            style={{ width: 180 }}
          />
          <TextInput
            size="xs" type="email" value={nuevoResponsableEmail} placeholder="Email (opcional)"
            onChange={(e) => setNuevoResponsableEmail(e.currentTarget.value)}
            style={{ width: 200 }}
          />
          <Button size="xs" onClick={guardarResponsable} loading={guardando}>
            Guardar
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setEditandoResponsable(false)}>
            Cancelar
          </Button>
        </Group>
      )}

      {nota.relaciones?.length > 0 && (
        <Stack gap="2" mt="8">
          {nota.relaciones.map((rel, i) => (
            <Text key={i} size="11.5px" c="dimmed">
              {rel.direccion === "hacia" ? "→" : "←"} {rel.tipo_relacion || "relacionado"} con #{rel.id_relacionado}
            </Text>
          ))}
        </Stack>
      )}

      {error && (
        <Alert color="red" mt="8">
          {error}
        </Alert>
      )}

      <Group gap="10" mt="10">
        {esIncidenciaAbierta && !resolviendo && (
          <Button size="xs" variant="light" color="green" leftSection={<IconCheck size={13} />} onClick={() => setResolviendo(true)}>
            Resolver
          </Button>
        )}
        {!relacionando && (
          <Button size="xs" variant="subtle" color="gray" leftSection={<IconLink size={13} />} onClick={() => setRelacionando(true)}>
            Relacionar
          </Button>
        )}
      </Group>

      {resolviendo && (
        <Stack gap="8" mt="10">
          <Textarea
            placeholder="Cómo se ha resuelto..."
            value={textoResolucion}
            onChange={(e) => setTextoResolucion(e.currentTarget.value)}
            autosize minRows={2}
          />
          <Group gap="8">
            <Button size="xs" onClick={resolver} loading={guardando} disabled={!textoResolucion.trim()}>
              Guardar resolución
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={() => setResolviendo(false)}>
              Cancelar
            </Button>
          </Group>
        </Stack>
      )}

      {relacionando && (
        <Group gap="8" mt="10" align="flex-end">
          <Select
            placeholder="Nota relacionada" data={opcionesRelacion}
            value={idDestino} onChange={setIdDestino} searchable
            style={{ flex: 1, minWidth: 200 }}
          />
          <TextInput
            placeholder="Etiqueta (opcional)" value={tipoRelacion}
            onChange={(e) => setTipoRelacion(e.currentTarget.value)}
            style={{ width: 160 }}
          />
          <Button size="xs" onClick={relacionar} loading={guardando} disabled={!idDestino}>
            Enlazar
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setRelacionando(false)}>
            Cancelar
          </Button>
        </Group>
      )}
    </Paper>
  )
}

export default function NotasDocumento({ proyecto, idDocumento, idVersion, onCargado, mostrarTitulo = true }) {
  const [notas, setNotas] = useState(null)
  const [error, setError] = useState(null)
  const [tipo, setTipo] = useState("comentario")
  const [texto, setTexto] = useState("")
  const [responsable, setResponsable] = useState("")
  const [responsableEmail, setResponsableEmail] = useState("")
  const [creando, setCreando] = useState(false)

  function cargar() {
    return api
      .listarNotasDocumento(proyecto.id, idDocumento)
      .then((lista) => {
        setNotas(lista)
        onCargado?.(lista)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      await api.crearNotaDocumento(proyecto.id, idDocumento, {
        tipo, texto, responsable: responsable || null, responsable_email: responsableEmail || null,
        id_version_origen: idVersion,
      })
      setTexto("")
      setResponsable("")
      setResponsableEmail("")
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <Stack gap="10">
      {mostrarTitulo && (
        <div>
          <Title order={4} fz="16px">
            Comentarios e incidencias
          </Title>
          <Text size="12px" c="dimmed">
            Se guardan sobre el documento, no sobre esta versión — siguen aquí aunque se suba una versión nueva.
          </Text>
        </div>
      )}

      {proyecto.puede_editar && (
        <Paper withBorder radius="lg" p="14" component="form" onSubmit={crear}>
          <Group align="flex-end" gap="8">
            <Select
              label="Tipo" data={TIPOS.slice(0, 4)} value={tipo} onChange={setTipo}
              style={{ width: 170 }} allowDeselect={false}
            />
            <TextInput
              label="Responsable (opcional)" value={responsable}
              onChange={(e) => setResponsable(e.currentTarget.value)}
              style={{ width: 180 }}
            />
            <TextInput
              label="Email (opcional)" type="email" value={responsableEmail}
              onChange={(e) => setResponsableEmail(e.currentTarget.value)}
              style={{ width: 200 }}
            />
          </Group>
          <Textarea
            mt="8" placeholder="Escribe aquí..." value={texto}
            onChange={(e) => setTexto(e.currentTarget.value)}
            autosize minRows={2} required
          />
          <Button type="submit" mt="8" size="xs" loading={creando} leftSection={<IconPlus size={13} />}>
            Añadir
          </Button>
        </Paper>
      )}

      {error && <Alert color="red">{error}</Alert>}
      {!error && !notas && (
        <Text size="sm" c="dimmed">
          Cargando...
        </Text>
      )}
      {notas && notas.length === 0 && (
        <Text size="sm" c="dimmed">
          Este documento no tiene comentarios ni incidencias todavía.
        </Text>
      )}
      {notas?.map((nota) => (
        <Nota
          key={nota.id}
          proyecto={proyecto}
          idDocumento={idDocumento}
          notas={notas}
          nota={nota}
          onCambiado={cargar}
        />
      ))}
    </Stack>
  )
}
