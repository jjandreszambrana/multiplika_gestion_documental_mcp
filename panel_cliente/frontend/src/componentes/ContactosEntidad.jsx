import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Checkbox, Group, Modal, Paper, SimpleGrid, Stack, Table, Text, TextInput, Textarea } from "@mantine/core"
import { IconPlus } from "@tabler/icons-react"
import { api } from "../api"

const VACIO = { nombre: "", cargo: "", email: "", telefono: "", observaciones: "", principal: false }

// Personas de contacto de una entidad (ficha de la entidad).
export default function ContactosEntidad({ proyecto, idEntidad }) {
  const [contactos, setContactos] = useState(null)
  const [editando, setEditando] = useState(null) // null = cerrado; {} = nuevo; contacto = ese
  const [valores, setValores] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  function cargar() {
    return api.listarContactos(proyecto.id, idEntidad).then(setContactos).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idEntidad])

  function abrir(contacto) {
    setValores(contacto ? Object.fromEntries(Object.keys(VACIO).map((k) => [k, contacto[k] ?? VACIO[k]])) : VACIO)
    setEditando(contacto || {})
    setError(null)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      if (editando.id) await api.actualizarContacto(proyecto.id, editando.id, valores)
      else await api.crearContacto(proyecto.id, idEntidad, valores)
      setEditando(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!confirm(`¿Borrar el contacto «${editando.nombre}»?`)) return
    try {
      await api.eliminarContacto(proyecto.id, editando.id)
      setEditando(null)
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  // El valor se lee antes de setValores: dentro del actualizador, currentTarget ya es null
  const poner = (k, valor) => setValores((v) => ({ ...v, [k]: valor }))
  const campo = (k) => ({ value: valores[k], onChange: (e) => poner(k, e.currentTarget.value) })

  return (
    <>
      {proyecto.puede_editar && (
        <Button variant="default" size="xs" mb="sm" leftSection={<IconPlus size={14} />} onClick={() => abrir(null)}>
          Nuevo contacto
        </Button>
      )}
      {!contactos ? (
        <Text>Cargando...</Text>
      ) : contactos.length === 0 ? (
        <Text c="dimmed">Sin personas de contacto todavía.</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Tbody>
              {contactos.map((c) => (
                <Table.Tr key={c.id} style={{ cursor: proyecto.puede_editar ? "pointer" : undefined }} onClick={() => proyecto.puede_editar && abrir(c)}>
                  <Table.Td fw={500}>
                    {c.nombre} {c.principal && <Badge size="xs" variant="light" ml={4}>principal</Badge>}
                  </Table.Td>
                  <Table.Td c="dimmed">{c.cargo}</Table.Td>
                  <Table.Td>{c.email && <Anchor href={`mailto:${c.email}`} size="sm" onClick={(e) => e.stopPropagation()}>{c.email}</Anchor>}</Table.Td>
                  <Table.Td>{c.telefono}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal opened={editando !== null} onClose={() => setEditando(null)} title={editando?.id ? "Contacto" : "Nuevo contacto"}>
        <Stack gap="sm">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput label="Nombre" required {...campo("nombre")} />
          <SimpleGrid cols={2}>
            <TextInput label="Cargo" placeholder="Compras, gerencia..." {...campo("cargo")} />
            <TextInput label="Teléfono" {...campo("telefono")} />
          </SimpleGrid>
          <TextInput label="Email" {...campo("email")} />
          <Textarea label="Observaciones" autosize minRows={2} {...campo("observaciones")} />
          <Checkbox
            label="Persona de referencia de la entidad" checked={valores.principal}
            onChange={(e) => poner("principal", e.currentTarget.checked)}
          />
          <Group justify="space-between">
            {editando?.id ? <Button variant="subtle" color="red" onClick={eliminar}>Borrar</Button> : <span />}
            <Button onClick={guardar} loading={guardando} disabled={!valores.nombre.trim()}>Guardar</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
