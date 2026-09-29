import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core"
import { IconArrowLeft, IconCheck, IconChecks } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

export default function Notificaciones({ proyecto, onVolver, onVerProgramacion, onCambiadas }) {
  const [notificaciones, setNotificaciones] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(null)

  function cargar() {
    return api.listarNotificaciones(proyecto.id).then(setNotificaciones).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  async function hacer(clave, llamada) {
    setTrabajando(clave)
    setError(null)
    try {
      await llamada()
      await cargar()
      onCambiadas()
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(null)
    }
  }

  function abrir(n) {
    if (!n.leida) api.leerNotificacion(proyecto.id, n.id).then(onCambiadas).catch(() => {})
    if (n.id_programacion) onVerProgramacion(n.id_programacion)
  }

  const noLeidas = (notificaciones || []).filter((n) => !n.leida).length

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

      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="6">Notificaciones</Title>
          <Text c="dimmed" fz="13.5px">Los avisos que te han llegado. Pulsa uno para ver de qué va.</Text>
        </div>
        {noLeidas > 0 && (
          <Button variant="default" leftSection={<IconChecks size={16} />} loading={trabajando === "todas"}
            onClick={() => hacer("todas", () => api.leerTodasNotificaciones(proyecto.id))}>
            Marcar todas como leídas
          </Button>
        )}
      </Group>

      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!notificaciones ? (
        <Text>Cargando...</Text>
      ) : notificaciones.length === 0 ? (
        <Text c="dimmed">No tienes ninguna notificación.</Text>
      ) : (
        <Stack gap="xs">
          {notificaciones.map((n) => (
            <Paper
              key={n.id} withBorder radius="md" p="md"
              style={{ cursor: n.id_programacion ? "pointer" : undefined, borderLeft: n.leida ? undefined : "3px solid var(--mantine-color-acento-6)" }}
              onClick={() => abrir(n)}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={n.leida ? 400 : 600} size="sm">{n.titulo}</Text>
                  {n.texto && <Text size="13px" c="dimmed" lineClamp={2} style={{ whiteSpace: "pre-wrap" }}>{n.texto}</Text>}
                  <Group gap={8} mt={4}>
                    <Text size="12px" c="dimmed">{formatearFecha(n.fecha)}</Text>
                    {n.estado_email === "fallido" && (
                      <Badge size="xs" variant="light" color="orange" title={n.error_email || ""}>el email no llegó</Badge>
                    )}
                    {n.hecho_por && (
                      <Badge size="xs" variant="light" color="green">Hecho por {n.hecho_por}</Badge>
                    )}
                  </Group>
                </div>
                {n.pendiente_hecho && (
                  <Button size="xs" leftSection={<IconCheck size={14} />} loading={trabajando === n.id}
                    onClick={(e) => { e.stopPropagation(); hacer(n.id, () => api.marcarAvisoHecho(proyecto.id, n.id_ejecucion)) }}>
                    Hecho
                  </Button>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </>
  )
}
