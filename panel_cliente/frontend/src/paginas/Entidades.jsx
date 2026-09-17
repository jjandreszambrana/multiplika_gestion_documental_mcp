import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Modal, Paper, Select, Table, Text, TextInput, Title } from "@mantine/core"
import { IconArrowLeft, IconPlus, IconSearch } from "@tabler/icons-react"
import { api } from "../api"
import FormularioEntidad from "../componentes/FormularioEntidad"

export default function Entidades({ proyecto, onVolver, onVerEntidad }) {
  const [entidades, setEntidades] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState("")
  const [tipo, setTipo] = useState("")
  const [modalAbierto, setModalAbierto] = useState(false)
  const [nueva, setNueva] = useState({})
  const [creando, setCreando] = useState(false)
  const [errorModal, setErrorModal] = useState(null)

  function cargar(consultaQ = q, consultaTipo = tipo) {
    return api
      .listarEntidades(proyecto.id, consultaQ, consultaTipo)
      .then(setEntidades)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar("", "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  function buscar(evento) {
    evento.preventDefault()
    cargar()
  }

  const tiposConocidos = [...new Set((entidades || []).map((e) => e.tipo))]

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setErrorModal(null)
    try {
      await api.crearEntidad(proyecto.id, nueva)
      setNueva({})
      setModalAbierto(false)
      await cargar()
    } catch (err) {
      setErrorModal(err.message)
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
            Entidades
          </Title>
          <Text c="dimmed" maw={560} fz="13.5px">
            Clientes, proveedores, empleados... con una ficha mínima de contacto, relacionables con documentos.
          </Text>
        </div>
        {proyecto.puede_editar && (
          <Button leftSection={<IconPlus size={15} stroke={2.2} />} onClick={() => setModalAbierto(true)}>
            Nueva entidad
          </Button>
        )}
      </Group>

      <Group component="form" onSubmit={buscar} mb="md">
        <TextInput
          placeholder="Buscar por nombre" leftSection={<IconSearch size={15} stroke={2} />}
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
        />
        <Select
          placeholder="Tipo: todos" data={tiposConocidos.map((t) => ({ value: t, label: t }))}
          value={tipo} onChange={(v) => { setTipo(v || ""); cargar(q, v || "") }}
          searchable clearable w={170}
        />
        <Button type="submit" variant="light">
          Buscar
        </Button>
      </Group>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!entidades ? (
        <Text>Cargando...</Text>
      ) : entidades.length === 0 ? (
        <Text c="dimmed">No hay ninguna entidad todavía.</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Localidad</Table.Th>
                <Table.Th>Contacto</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entidades.map((e) => (
                <Table.Tr key={e.id} onClick={() => onVerEntidad(e)} style={{ cursor: "pointer" }}>
                  <Table.Td fw={500}>{e.nombre}</Table.Td>
                  <Table.Td>
                    <Badge color="gray" variant="light" radius="sm" tt="none" fw={500}>
                      {e.tipo}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="13px" c="dimmed">
                      {[e.localidad, e.provincia].filter(Boolean).join(", ") || "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="13px" c="dimmed">
                      {[e.telefono, e.email].filter(Boolean).join(" · ") || "—"}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal opened={modalAbierto} onClose={() => setModalAbierto(false)} title="Nueva entidad" size="lg">
        <form onSubmit={crear}>
          {errorModal && (
            <Alert color="red" mb="md">
              {errorModal}
            </Alert>
          )}
          <FormularioEntidad valores={nueva} onChange={setNueva} tiposConocidos={tiposConocidos} />
          <Button type="submit" mt="10" loading={creando}>
            Crear
          </Button>
        </form>
      </Modal>
    </>
  )
}
