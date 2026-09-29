import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Group, Paper, SegmentedControl, Table, Text, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconPlus, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { COLOR_ESTADO, formatearFecha } from "../formato"
import FormularioProgramacion from "../componentes/FormularioProgramacion"

export default function Programaciones({ proyecto, onVolver, onVerProgramacion }) {
  const [programaciones, setProgramaciones] = useState(null)
  const [estado, setEstado] = useState("")
  const [error, setError] = useState(null)
  const [refrescando, setRefrescando] = useState(false)
  const [formularioAbierto, setFormularioAbierto] = useState(false)

  function cargar(filtroEstado = estado) {
    setRefrescando(true)
    return api
      .listarProgramaciones(proyecto.id, { estado: filtroEstado })
      .then(setProgramaciones)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    cargar("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

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
          <Title order={2} mb="6">
            Avisos programados
          </Title>
          <Text c="dimmed" maw={560} fz="13.5px">
            Recordatorios para una fecha concreta o que se repiten. Llegan a las personas que elijas en
            sus notificaciones y, si quieres, por email.
          </Text>
        </div>
        {proyecto.puede_editar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setFormularioAbierto(true)}>
            Nuevo aviso
          </Button>
        )}
      </Group>

      <Group mb="md">
        <SegmentedControl
          value={estado}
          onChange={(v) => { setEstado(v); cargar(v) }}
          data={[
            { value: "", label: "Todos" },
            { value: "activa", label: "Activos" },
            { value: "pausada", label: "Pausados" },
            { value: "terminada", label: "Terminados" },
          ]}
        />
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={() => cargar()} loading={refrescando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!programaciones ? (
        <Text>Cargando...</Text>
      ) : programaciones.length === 0 ? (
        <Text c="dimmed">No hay ningún aviso programado. También puedes pedírselo a tu IA: "recuérdale a Ana el día 15 que renueve el seguro".</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Aviso</Table.Th>
                <Table.Th>Cuándo</Table.Th>
                <Table.Th>Próximo</Table.Th>
                <Table.Th>Para</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {programaciones.map((p) => (
                <Table.Tr key={p.id} onClick={() => onVerProgramacion(p.id)} style={{ cursor: "pointer" }}>
                  <Table.Td>
                    <Text fw={500} size="sm">{p.titulo}</Text>
                    <Group gap={6} mt={2}>
                      {p.estado !== "activa" && (
                        <Badge size="xs" variant="light" color={COLOR_ESTADO[p.estado]}>{p.estado}</Badge>
                      )}
                      {p.pendientes_hecho > 0 && (
                        <Badge size="xs" variant="light" color="red">{p.pendientes_hecho} sin hacer</Badge>
                      )}
                      {p.num_documentos > 0 && (
                        <Text size="12px" c="dimmed">{p.num_documentos} documento{p.num_documentos > 1 ? "s" : ""}</Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td><Text size="13px">{p.descripcion_repeticion}</Text></Table.Td>
                  <Table.Td>
                    <Text size="13px" c="dimmed">{p.estado === "activa" ? formatearFecha(p.proxima_ejecucion) : "—"}</Text>
                  </Table.Td>
                  <Table.Td><Text size="13px" c="dimmed">{p.destinatarios.join(", ")}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <FormularioProgramacion
        opened={formularioAbierto}
        onClose={() => setFormularioAbierto(false)}
        proyecto={proyecto}
        programacion={null}
        onGuardado={(nueva) => { setFormularioAbierto(false); onVerProgramacion(nueva.id) }}
      />
    </>
  )
}
