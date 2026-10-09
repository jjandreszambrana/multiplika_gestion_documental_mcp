import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Checkbox, Group, Paper, SegmentedControl, Stack, Text, Title, Tooltip } from "@mantine/core"
import { IconArchive, IconArchiveOff, IconArrowLeft, IconCheck, IconChecks, IconRefresh, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { useEstadoPersistente } from "../estadoPersistente"
import { formatearFecha } from "../formato"

export default function Notificaciones({ proyecto, onVolver, onVerProgramacion, onVerSeguimiento, onVerWebs, onCambiadas }) {
  const [notificaciones, setNotificaciones] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(null)
  const [archivadas, setArchivadas] = useEstadoPersistente(`filtros:${proyecto.id}:notificaciones:archivadas`, false)
  const [seleccion, setSeleccion] = useState([])
  const [refrescando, setRefrescando] = useState(false)

  function recargar() {
    setRefrescando(true)
    cargar().finally(() => setRefrescando(false))
  }

  function cargar() {
    return api.listarNotificaciones(proyecto.id, archivadas).then(setNotificaciones).catch((err) => setError(err.message))
  }

  useEffect(() => {
    setNotificaciones(null)
    setSeleccion([])
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, archivadas])

  function marcar(id, marcada) {
    setSeleccion((s) => (marcada ? [...s, id] : s.filter((x) => x !== id)))
  }

  function archivarSeleccion() {
    hacer("archivar", async () => {
      await api.archivarNotificaciones(proyecto.id, seleccion, !archivadas)
      setSeleccion([])
    })
  }

  function purgarSeleccion() {
    const n = seleccion.length
    if (!window.confirm(`¿Borrar para siempre ${n === 1 ? "esta notificación" : `estas ${n} notificaciones`}? No se puede deshacer.`)) return
    hacer("purgar", async () => {
      await api.purgarNotificaciones(proyecto.id, seleccion)
      setSeleccion([])
    })
  }

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
    else if (n.origen === "seguimiento") onVerSeguimiento()
    else if (n.origen === "vigilancia") onVerWebs()
  }

  const noLeidas = (notificaciones || []).filter((n) => !n.leida).length
  const todas = notificaciones || []
  const todasMarcadas = todas.length > 0 && seleccion.length === todas.length

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
        <Group gap="xs">
          {noLeidas > 0 && !archivadas && (
            <Button variant="default" leftSection={<IconChecks size={16} />} loading={trabajando === "todas"}
              onClick={() => hacer("todas", () => api.leerTodasNotificaciones(proyecto.id))}>
              Marcar todas como leídas
            </Button>
          )}
          <Tooltip label="Refrescar">
            <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={refrescando}>
              <IconRefresh size={17} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group justify="space-between" mb="md">
        <SegmentedControl
          value={archivadas ? "archivadas" : "activas"}
          onChange={(v) => setArchivadas(v === "archivadas")}
          data={[{ value: "activas", label: "Activas" }, { value: "archivadas", label: "Archivadas" }]}
        />
        {todas.length > 0 && (
          <Group gap="xs">
            <Checkbox
              label="Seleccionar todas" checked={todasMarcadas}
              indeterminate={seleccion.length > 0 && !todasMarcadas}
              onChange={() => setSeleccion(todasMarcadas ? [] : todas.map((n) => n.id))}
            />
            <Button variant="default" size="xs" disabled={!seleccion.length} loading={trabajando === "archivar"}
              leftSection={archivadas ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
              onClick={archivarSeleccion}>
              {archivadas ? "Sacar del archivo" : "Archivar"}
            </Button>
            {archivadas && (
              <Button color="red" variant="light" size="xs" disabled={!seleccion.length} loading={trabajando === "purgar"}
                leftSection={<IconTrash size={14} />} onClick={purgarSeleccion}>
                Purgar
              </Button>
            )}
          </Group>
        )}
      </Group>

      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!notificaciones ? (
        <Text>Cargando...</Text>
      ) : notificaciones.length === 0 ? (
        <Text c="dimmed">{archivadas ? "No tienes ninguna notificación archivada." : "No tienes ninguna notificación."}</Text>
      ) : (
        <Stack gap="xs">
          {notificaciones.map((n) => (
            <Paper
              key={n.id} withBorder radius="md" p="md"
              style={{ cursor: n.id_programacion || n.origen === "seguimiento" || n.origen === "vigilancia" ? "pointer" : undefined, borderLeft: n.leida ? undefined : "3px solid var(--mantine-color-acento-6)" }}
              onClick={() => abrir(n)}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group align="flex-start" gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Checkbox
                    mt={2} aria-label="Seleccionar" checked={seleccion.includes(n.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => marcar(n.id, e.currentTarget.checked)}
                  />
                  <div style={{ minWidth: 0 }}>
                    <Text fw={n.leida ? 400 : 600} size="sm">{n.titulo}</Text>
                    {n.texto && <Text size="13px" c="dimmed" lineClamp={n.origen === "seguimiento" || n.origen === "vigilancia" ? 12 : 2} style={{ whiteSpace: "pre-wrap" }}>{n.texto}</Text>}
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
                </Group>
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
