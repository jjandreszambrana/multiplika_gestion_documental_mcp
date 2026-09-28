import { useEffect, useRef, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Button, Card, Code, Group,
  Loader, Modal, NavLink, Paper, ScrollArea, Stack, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconPencil, IconPlus, IconSend, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import Markdown from "../componentes/Markdown"

// El historial llega en el formato bruto de la Messages API de
// Anthropic: cada turno trae `content` como texto plano (mensajes del
// usuario) o como una lista de bloques con `type` "text"/"tool_use"/
// "tool_result"/"thinking" (turnos del asistente, y los tool_result que
// van de vuelta tras una confirmación). Para pintar el historial solo
// hace falta el texto — no hace falta reconstruir confirmaciones ya
// resueltas.
function textoDeMensaje(mensaje) {
  if (typeof mensaje.content === "string") return mensaje.content
  if (Array.isArray(mensaje.content)) {
    return mensaje.content
      .filter((bloque) => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("\n")
  }
  return ""
}

function Burbuja({ rol, texto }) {
  const esUsuario = rol === "user"
  return (
    <Group justify={esUsuario ? "flex-end" : "flex-start"} wrap="nowrap">
      <Paper withBorder p="sm" radius="md" maw="80%" bg={esUsuario ? "acento.6" : undefined}>
        {esUsuario ? (
          <Text c="white" style={{ whiteSpace: "pre-wrap" }}>
            {texto}
          </Text>
        ) : (
          <Markdown>{texto}</Markdown>
        )}
      </Paper>
    </Group>
  )
}

function AccionesPendientes({ acciones, confirmando, onResolver }) {
  return (
    <Card withBorder p="md" radius="md">
      <Text fw={600} mb="xs">
        El asistente quiere hacer lo siguiente:
      </Text>
      <Stack gap="sm" mb="md">
        {acciones.map((accion, i) => (
          <div key={i}>
            <Badge variant="light" mb="4">
              {accion.herramienta}
            </Badge>
            <Text size="sm" mb="4">
              {accion.descripcion}
            </Text>
            <Code block>{JSON.stringify(accion.argumentos, null, 2)}</Code>
          </div>
        ))}
      </Stack>
      <Group gap="sm">
        <Button color="green" loading={confirmando} onClick={() => onResolver(true)}>
          Confirmar
        </Button>
        <Button variant="default" disabled={confirmando} onClick={() => onResolver(false)}>
          Cancelar
        </Button>
      </Group>
    </Card>
  )
}

function ListaConversaciones({ conversaciones, idActual, cargando, onSeleccionar, onNueva, onRenombrar, onEliminar }) {
  return (
    <Paper withBorder p="xs" radius="md" w={260} style={{ flexShrink: 0 }}>
      <Group justify="space-between" mb="xs" px="xs">
        <Text fw={600} size="sm">
          Conversaciones
        </Text>
        <Tooltip label="Nueva conversación">
          <ActionIcon variant="light" onClick={onNueva}>
            <IconPlus size={16} stroke={1.9} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <ScrollArea h="calc(100vh - 300px)">
        <Stack gap={2}>
          {conversaciones.map((c) => (
            <NavLink
              key={c.id}
              label={c.titulo || "Sin título"}
              description={formatearFecha(c.fecha_actualizacion)}
              active={c.id === idActual}
              onClick={() => onSeleccionar(c.id)}
              styles={{ root: { borderRadius: "var(--mantine-radius-md)" } }}
              rightSection={
                <Group gap={2} wrap="nowrap">
                  <ActionIcon
                    size="sm" variant="subtle" color="gray"
                    onClick={(evento) => { evento.stopPropagation(); onRenombrar(c) }}
                  >
                    <IconPencil size={14} stroke={1.8} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm" variant="subtle" color="red"
                    onClick={(evento) => { evento.stopPropagation(); onEliminar(c) }}
                  >
                    <IconTrash size={14} stroke={1.8} />
                  </ActionIcon>
                </Group>
              }
            />
          ))}
          {conversaciones.length === 0 && !cargando && (
            <Text c="dimmed" size="sm" px="xs">
              No tienes conversaciones todavía.
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  )
}

export default function Chat({ proyecto, onVolver }) {
  const [conversaciones, setConversaciones] = useState([])
  const [idConversacionActual, setIdConversacionActual] = useState(null)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [pendiente, setPendiente] = useState(null)
  const [entrada, setEntrada] = useState("")
  const [error, setError] = useState(null)
  const [aRenombrar, setARenombrar] = useState(null)
  const [tituloRenombrar, setTituloRenombrar] = useState("")
  const finalRef = useRef(null)

  async function seleccionar(id) {
    setIdConversacionActual(id)
    setCargando(true)
    setError(null)
    setPendiente(null)
    try {
      const r = await api.obtenerConversacionChat(proyecto.id, id)
      const vistos = r.mensajes
        .map((m) => ({ rol: m.role, texto: textoDeMensaje(m) }))
        .filter((m) => m.texto.trim())
      setMensajes(vistos)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function cargarConversaciones() {
    setCargandoLista(true)
    setError(null)
    try {
      let lista = await api.listarConversacionesChat(proyecto.id)
      if (lista.length === 0) {
        lista = [await api.crearConversacionChat(proyecto.id, null)]
      }
      setConversaciones(lista)
      await seleccionar(lista[0].id)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => {
    cargarConversaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, pendiente])

  async function refrescarListaSilenciosa() {
    try {
      setConversaciones(await api.listarConversacionesChat(proyecto.id))
    } catch {
      // no es crítico — la lista solo queda un poco desactualizada (orden/título)
    }
  }

  function procesarRespuesta(respuesta) {
    if (respuesta.tipo === "respuesta") {
      setMensajes((m) => [...m, { rol: "assistant", texto: respuesta.texto }])
      setPendiente(null)
      refrescarListaSilenciosa()
    } else if (respuesta.tipo === "confirmar") {
      setPendiente(respuesta)
    } else {
      setError(respuesta.texto || "No se ha podido continuar la conversación.")
      setPendiente(null)
    }
  }

  async function enviar(evento) {
    evento.preventDefault()
    const texto = entrada.trim()
    if (!texto || enviando || !idConversacionActual) return
    setEntrada("")
    setError(null)
    setMensajes((m) => [...m, { rol: "user", texto }])
    setEnviando(true)
    try {
      procesarRespuesta(await api.enviarMensajeChat(proyecto.id, idConversacionActual, texto))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function resolverConfirmacion(aceptar) {
    setConfirmando(true)
    setError(null)
    try {
      procesarRespuesta(await api.confirmarAccionChat(proyecto.id, pendiente.confirmacion_id, aceptar))
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirmando(false)
    }
  }

  function alPulsarTecla(evento) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault()
      enviar(evento)
    }
  }

  async function nuevaConversacion() {
    setError(null)
    try {
      const nueva = await api.crearConversacionChat(proyecto.id, null)
      setConversaciones((c) => [nueva, ...c])
      await seleccionar(nueva.id)
    } catch (err) {
      setError(err.message)
    }
  }

  function abrirRenombrar(conversacion) {
    setARenombrar(conversacion)
    setTituloRenombrar(conversacion.titulo || "")
  }

  async function guardarRenombrar(evento) {
    evento.preventDefault()
    const titulo = tituloRenombrar.trim()
    if (!titulo) return
    setError(null)
    try {
      await api.renombrarConversacionChat(proyecto.id, aRenombrar.id, titulo)
      setConversaciones((cs) => cs.map((c) => (c.id === aRenombrar.id ? { ...c, titulo } : c)))
      setARenombrar(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminarConversacion(conversacion) {
    if (!window.confirm(`¿Eliminar la conversación "${conversacion.titulo || "Sin título"}"? No se puede deshacer.`)) return
    setError(null)
    try {
      await api.eliminarConversacionChat(proyecto.id, conversacion.id)
      const restantes = conversaciones.filter((c) => c.id !== conversacion.id)
      setConversaciones(restantes)
      if (conversacion.id === idConversacionActual) {
        if (restantes.length > 0) await seleccionar(restantes[0].id)
        else await nuevaConversacion()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Documentos
      </Anchor>
      <Title order={2} mb="lg">
        GD-IA Chat
      </Title>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group align="flex-start" wrap="nowrap" gap="md">
        <ListaConversaciones
          conversaciones={conversaciones}
          idActual={idConversacionActual}
          cargando={cargandoLista}
          onSeleccionar={seleccionar}
          onNueva={nuevaConversacion}
          onRenombrar={abrirRenombrar}
          onEliminar={eliminarConversacion}
        />

        <Paper withBorder p="md" radius="md" style={{ flex: 1, minWidth: 0 }}>
          <ScrollArea h="calc(100vh - 300px)" mb="md">
            {cargandoLista || cargando ? (
              <Loader size="sm" />
            ) : (
              <Stack gap="sm">
                {mensajes.length === 0 && (
                  <Text c="dimmed" size="sm">
                    Pregúntale algo sobre los documentos, entidades o notas de este proyecto.
                  </Text>
                )}
                {mensajes.map((m, i) => (
                  <Burbuja key={i} rol={m.rol} texto={m.texto} />
                ))}
                {pendiente && (
                  <AccionesPendientes
                    acciones={pendiente.acciones}
                    confirmando={confirmando}
                    onResolver={resolverConfirmacion}
                  />
                )}
                {enviando && <Loader size="sm" />}
                <div ref={finalRef} />
              </Stack>
            )}
          </ScrollArea>

          <Group component="form" onSubmit={enviar} align="flex-end" wrap="nowrap" gap="sm">
            <Textarea
              placeholder="Escribe tu pregunta..."
              value={entrada}
              onChange={(evento) => setEntrada(evento.currentTarget.value)}
              onKeyDown={alPulsarTecla}
              autosize minRows={1} maxRows={6}
              disabled={enviando || !!pendiente || cargando || cargandoLista}
              style={{ flex: 1 }}
            />
            <ActionIcon
              type="submit" size={36} radius="md"
              disabled={enviando || !!pendiente || !entrada.trim() || cargando || cargandoLista}
            >
              <IconSend size={17} stroke={1.9} />
            </ActionIcon>
          </Group>
        </Paper>
      </Group>

      <Modal opened={!!aRenombrar} onClose={() => setARenombrar(null)} title="Renombrar conversación">
        <Stack component="form" onSubmit={guardarRenombrar} gap="md">
          <TextInput
            placeholder="Título de la conversación"
            value={tituloRenombrar}
            onChange={(evento) => setTituloRenombrar(evento.target.value)}
            autoFocus
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setARenombrar(null)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
