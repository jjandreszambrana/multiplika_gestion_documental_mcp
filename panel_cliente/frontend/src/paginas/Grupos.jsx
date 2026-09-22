import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Group, Paper, Table, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconPlus, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"

export default function Grupos({ proyecto, onVolver, onVerGrupo }) {
  const [grupos, setGrupos] = useState(null)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState("")
  const [proposito, setProposito] = useState("")
  const [creando, setCreando] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  function recargar() {
    setRefrescando(true)
    return api
      .listarGrupos(proyecto.id)
      .then(setGrupos)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    recargar()
  }, [proyecto.id])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      await api.crearGrupo(proyecto.id, nombre, proposito)
      setNombre("")
      setProposito("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
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
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="6">
            Grupos de documentos
          </Title>
          <Text c="dimmed" maw={620} fz="13.5px">
            Un grupo agrupa documentos para un fin concreto (una auditoría, un expediente...). No hace
            falta que todos los documentos estén en uno, y uno mismo puede estar en varios grupos a la vez.
          </Text>
        </div>
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={refrescando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {proyecto.puede_editar && (
        <Paper withBorder radius="lg" p="16" mb="lg" component="form" onSubmit={crear} maw={560}>
          <TextInput
            label="Nombre" placeholder='p.ej. "Auditoría 2026"'
            value={nombre} onChange={(e) => setNombre(e.currentTarget.value)}
            required mb="8"
          />
          <Textarea
            label="Para qué sirve" placeholder='p.ej. "Documentación reunida para la auditoría anual"'
            value={proposito} onChange={(e) => setProposito(e.currentTarget.value)}
            autosize minRows={2} required mb="10"
          />
          <Button type="submit" loading={creando} leftSection={<IconPlus size={15} stroke={2.2} />}>
            Crear grupo
          </Button>
        </Paper>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!grupos ? (
        <Text>Cargando...</Text>
      ) : grupos.length === 0 ? (
        <Text c="dimmed">Todavía no hay ningún grupo.</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Para qué sirve</Table.Th>
                <Table.Th>Documentos</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {grupos.map((g) => (
                <Table.Tr key={g.id} onClick={() => onVerGrupo(g)} style={{ cursor: "pointer" }}>
                  <Table.Td fw={500}>{g.nombre}</Table.Td>
                  <Table.Td>
                    <Text c="dimmed" size="sm" lineClamp={1}>
                      {g.proposito}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="gray" variant="light" circle>
                      {g.total_documentos}
                    </Badge>
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
