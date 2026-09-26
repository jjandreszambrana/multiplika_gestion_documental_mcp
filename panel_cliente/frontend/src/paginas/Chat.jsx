import { useEffect, useRef, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Button, Card, Code, Group,
  Loader, Paper, ScrollArea, Stack, Text, Textarea, Title,
} from "@mantine/core"
import { IconArrowLeft, IconSend } from "@tabler/icons-react"
import { api } from "../api"
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

export default function Chat({ proyecto, onVolver }) {
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [pendiente, setPendiente] = useState(null)
  const [entrada, setEntrada] = useState("")
  const [error, setError] = useState(null)
  const finalRef = useRef(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    api
      .obtenerHistorialChat(proyecto.id)
      .then((r) => {
        const vistos = r.mensajes
          .map((m) => ({ rol: m.role, texto: textoDeMensaje(m) }))
          .filter((m) => m.texto.trim())
        setMensajes(vistos)
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [proyecto.id])

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, pendiente])

  function procesarRespuesta(respuesta) {
    if (respuesta.tipo === "respuesta") {
      setMensajes((m) => [...m, { rol: "assistant", texto: respuesta.texto }])
      setPendiente(null)
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
    if (!texto || enviando) return
    setEntrada("")
    setError(null)
    setMensajes((m) => [...m, { rol: "user", texto }])
    setEnviando(true)
    try {
      procesarRespuesta(await api.enviarMensajeChat(proyecto.id, texto))
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

      <Paper withBorder p="md" radius="md" mb="md">
        <ScrollArea h={420} mb="md">
          {cargando ? (
            <Loader size="sm" />
          ) : (
            <Stack gap="sm">
              {mensajes.length === 0 && (
                <Text c="dimmed" size="sm">
                  Pregúntale algo sobre los documentos, entidades o registros de este proyecto.
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

        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <Group component="form" onSubmit={enviar} align="flex-end" wrap="nowrap" gap="sm">
          <Textarea
            placeholder="Escribe tu pregunta..."
            value={entrada}
            onChange={(evento) => setEntrada(evento.currentTarget.value)}
            onKeyDown={alPulsarTecla}
            autosize minRows={1} maxRows={6}
            disabled={enviando || !!pendiente}
            style={{ flex: 1 }}
          />
          <ActionIcon
            type="submit" size={36} radius="md"
            disabled={enviando || !!pendiente || !entrada.trim()}
          >
            <IconSend size={17} stroke={1.9} />
          </ActionIcon>
        </Group>
      </Paper>
    </>
  )
}
