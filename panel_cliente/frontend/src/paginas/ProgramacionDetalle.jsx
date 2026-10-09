import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Group, Modal, Paper, Stack, Table, Text, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconCheck, IconEdit, IconPlayerPause, IconPlayerPlay, IconRefresh, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { COLOR_ESTADO, formatearFecha } from "../formato"
import FormularioProgramacion from "../componentes/FormularioProgramacion"

function Dato({ etiqueta, children }) {
  return (
    <Group gap="xs" align="flex-start" wrap="nowrap">
      <Text size="13px" c="dimmed" w={150} style={{ flexShrink: 0 }}>{etiqueta}</Text>
      <div style={{ fontSize: 14 }}>{children}</div>
    </Group>
  )
}

export default function ProgramacionDetalle({ proyecto, idProgramacion, onVolver, onVerDocumento, onVerNota }) {
  const [programacion, setProgramacion] = useState(null)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  function cargar() {
    return api.obtenerProgramacion(proyecto.id, idProgramacion).then(setProgramacion).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idProgramacion])

  function recargar() {
    setRefrescando(true)
    cargar().finally(() => setRefrescando(false))
  }

  async function accion(llamada) {
    setTrabajando(true)
    setError(null)
    try {
      const resultado = await llamada()
      if (resultado) setProgramacion(resultado)
      else await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(false)
    }
  }

  async function eliminar() {
    setTrabajando(true)
    try {
      await api.eliminarProgramacion(proyecto.id, idProgramacion)
      onVolver()
    } catch (err) {
      setError(err.message)
      setTrabajando(false)
    }
  }

  const volver = (
    <Anchor
      component="button" type="button" onClick={onVolver} mb="lg"
      display="flex" style={{ alignItems: "center", gap: 6 }}
      underline="hover" c="dimmed" fz="13.5px" fw={500}
    >
      <IconArrowLeft size={15} stroke={2} />
      Avisos programados
    </Anchor>
  )

  if (!programacion) {
    return (
      <>
        {volver}
        {error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>}
      </>
    )
  }

  const p = programacion
  const recordatorios = p.max_recordatorios === null ? "hasta que alguien pulse Hecho" : `como mucho ${p.max_recordatorios} veces`

  return (
    <>
      {volver}
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Group gap="xs">
            <Title order={2}>{p.titulo}</Title>
            <Badge variant="light" color={COLOR_ESTADO[p.estado]}>{p.estado}</Badge>
          </Group>
          {p.descripcion && <Text c="dimmed" mt={6} style={{ whiteSpace: "pre-wrap" }}>{p.descripcion}</Text>}
        </div>
        <Group gap="xs">
          <Tooltip label="Refrescar">
            <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={refrescando}>
              <IconRefresh size={17} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
          {proyecto.puede_editar && (
            <>
              <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => setEditando(true)}>
                Cambiar
              </Button>
              {p.estado === "activa" && (
                <Button variant="default" leftSection={<IconPlayerPause size={16} />} loading={trabajando}
                  onClick={() => accion(() => api.pausarProgramacion(proyecto.id, p.id))}>
                  Pausar
                </Button>
              )}
              {p.estado === "pausada" && (
                <Button variant="default" leftSection={<IconPlayerPlay size={16} />} loading={trabajando}
                  onClick={() => accion(() => api.reanudarProgramacion(proyecto.id, p.id))}>
                  Reanudar
                </Button>
              )}
              <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={() => setConfirmarBorrado(true)}>
                Eliminar
              </Button>
            </>
          )}
        </Group>
      </Group>

      {error && <Alert color="red" mb="md">{error}</Alert>}

      <Paper withBorder radius="lg" p="lg" mb="lg">
        <Stack gap="sm">
          <Dato etiqueta="Cuándo">{p.descripcion_repeticion}</Dato>
          <Dato etiqueta="Próximo aviso">{p.estado === "activa" ? formatearFecha(p.proxima_ejecucion) : "—"}</Dato>
          <Dato etiqueta="Para">{p.destinatarios.map((d) => d.nombre).join(", ")}</Dato>
          <Dato etiqueta="Por email">{p.avisar_por_email ? "Sí" : "No, solo en el panel"}</Dato>
          <Dato etiqueta='Requiere "Hecho"'>
            {p.requiere_hecho ? `Sí: se recuerda cada ${p.cada_dias_recordatorio} día(s), ${recordatorios}` : "No"}
          </Dato>
          <Dato etiqueta="Documentos">
            {p.documentos.length === 0 ? (
              "—"
            ) : (
              <Group gap={6}>
                {p.documentos.map((d) => (
                  <Anchor key={d.id} component="button" type="button" fz="14px" onClick={() => onVerDocumento(d.id)}>
                    {d.nombre}
                  </Anchor>
                ))}
              </Group>
            )}
          </Dato>
          {p.id_nota_bloc && (
            <Dato etiqueta="Nota del bloc">
              <Anchor component="button" type="button" fz="14px" onClick={() => onVerNota(p.id_nota_bloc)}>
                Ver la nota
              </Anchor>
            </Dato>
          )}
          <Dato etiqueta="Creado por">{p.creado_por} · {formatearFecha(p.fecha_alta)}</Dato>
        </Stack>
      </Paper>

      <Title order={4} mb="sm">Historial</Title>
      {p.ejecuciones.length === 0 ? (
        <Text c="dimmed" size="sm">Todavía no ha avisado nunca.</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={170}>Fecha</Table.Th>
                <Table.Th>Qué pasó</Table.Th>
                {p.requiere_hecho && <Table.Th w={220}>Hecho</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {p.ejecuciones.map((e) => (
                <Table.Tr key={e.id}>
                  <Table.Td><Text size="13px">{formatearFecha(e.fecha)}</Text></Table.Td>
                  <Table.Td><Text size="13px" style={{ whiteSpace: "pre-wrap" }}>{e.resumen}</Text></Table.Td>
                  {p.requiere_hecho && (
                    <Table.Td>
                      {e.hecho_por ? (
                        <Text size="13px" c="green">{e.hecho_por} · {formatearFecha(e.fecha_hecho)}</Text>
                      ) : e.pendiente_hecho ? (
                        <Button size="compact-xs" variant="light" leftSection={<IconCheck size={13} />} loading={trabajando}
                          onClick={() => accion(async () => { await api.marcarAvisoHecho(proyecto.id, e.id) })}>
                          Marcar hecho
                        </Button>
                      ) : (
                        <Text size="13px" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <FormularioProgramacion
        opened={editando}
        onClose={() => setEditando(false)}
        proyecto={proyecto}
        programacion={p}
        onGuardado={(guardada) => { setEditando(false); setProgramacion(guardada) }}
      />

      <Modal opened={confirmarBorrado} onClose={() => setConfirmarBorrado(false)} title="Eliminar aviso" size="sm">
        <Text size="sm" mb="md">
          Se borra el aviso con su historial y las notificaciones que ya mandó. Si solo quieres que deje de avisar
          un tiempo, mejor páusalo.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmarBorrado(false)}>Cancelar</Button>
          <Button color="red" loading={trabajando} onClick={eliminar}>Eliminar</Button>
        </Group>
      </Modal>
    </>
  )
}
