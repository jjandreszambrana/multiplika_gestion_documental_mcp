import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Group, Paper, Select, Switch, Table, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconRefresh, IconSearch } from "@tabler/icons-react"
import { api } from "../api"

export default function Scripts({ proyecto, onVolver, onVerScript }) {
  const [scripts, setScripts] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState("")
  const [lenguaje, setLenguaje] = useState("")
  const [incluirArchivados, setIncluirArchivados] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  function cargar(consultaQ = q, consultaLenguaje = lenguaje, consultaArchivados = incluirArchivados) {
    setRefrescando(true)
    return api
      .listarScripts(proyecto.id, consultaQ, consultaLenguaje, consultaArchivados)
      .then(setScripts)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    cargar("", "", false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  function buscar(evento) {
    evento.preventDefault()
    cargar()
  }

  const lenguajesConocidos = [...new Set((scripts || []).map((s) => s.lenguaje))]

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
            Scripts
          </Title>
          <Text c="dimmed" maw={560} fz="13.5px">
            Scripts que tu IA ha escrito y guardado para reaprovecharlos en otras tareas, en vez de
            volver a escribirlos de cero.
          </Text>
        </div>
      </Group>

      <Group component="form" onSubmit={buscar} mb="md">
        <TextInput
          placeholder="Buscar por título, descripción o etiqueta" leftSection={<IconSearch size={15} stroke={2} />}
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
        />
        <Select
          placeholder="Lenguaje: todos" data={lenguajesConocidos.map((l) => ({ value: l, label: l }))}
          value={lenguaje} onChange={(v) => { setLenguaje(v || ""); cargar(q, v || "") }}
          searchable clearable w={170}
        />
        <Switch
          label="Incluir archivados" checked={incluirArchivados}
          onChange={(e) => { setIncluirArchivados(e.currentTarget.checked); cargar(q, lenguaje, e.currentTarget.checked) }}
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
      {!scripts ? (
        <Text>Cargando...</Text>
      ) : scripts.length === 0 ? (
        <Text c="dimmed">No hay ningún script guardado todavía — tu IA los va guardando conforme los escribe.</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Título</Table.Th>
                <Table.Th>Lenguaje</Table.Th>
                <Table.Th>Veces usado</Table.Th>
                <Table.Th>Creado por</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {scripts.map((s) => (
                <Table.Tr
                  key={s.id} onClick={() => onVerScript(s)}
                  style={{ cursor: "pointer", opacity: s.archivado ? 0.55 : 1 }}
                >
                  <Table.Td fw={500}>{s.titulo}</Table.Td>
                  <Table.Td>
                    <Badge color="gray" variant="light" radius="sm" tt="none" fw={500}>
                      {s.lenguaje}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="13px" c="dimmed">
                      {s.veces_usado}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="13px" c="dimmed">
                      {s.creado_por}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </>
  )
}
