import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Select, Table, Text, Textarea, TextInput, Title } from "@mantine/core"
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react"
import { api } from "../api"

export default function GrupoDetalle({ proyecto, grupo, onVolver, onEliminado }) {
  const [documentos, setDocumentos] = useState(null)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(grupo.nombre)
  const [proposito, setProposito] = useState(grupo.proposito)
  const [datosGrupo, setDatosGrupo] = useState(grupo)
  const [guardando, setGuardando] = useState(false)
  const [candidatos, setCandidatos] = useState([])
  const [idDocumentoNuevo, setIdDocumentoNuevo] = useState(null)
  const [anadiendo, setAnadiendo] = useState(false)

  function recargar() {
    return api
      .listarDocumentosGrupo(proyecto.id, grupo.id)
      .then(setDocumentos)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    recargar()
    api.listarOBuscarDocumentos(proyecto.id, "").then(setCandidatos).catch(() => setCandidatos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, grupo.id])

  async function guardarDatos() {
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await api.actualizarGrupo(proyecto.id, grupo.id, { nombre, proposito })
      setDatosGrupo(actualizado)
      setEditando(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function anadirDocumento() {
    if (!idDocumentoNuevo) return
    setAnadiendo(true)
    setError(null)
    try {
      await api.asignarDocumentoGrupo(proyecto.id, grupo.id, Number(idDocumentoNuevo))
      setIdDocumentoNuevo(null)
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setAnadiendo(false)
    }
  }

  async function quitarDocumento(idDocumento) {
    setError(null)
    try {
      await api.quitarDocumentoGrupo(proyecto.id, grupo.id, idDocumento)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminarGrupo() {
    if (!confirm(`¿Borrar el grupo "${datosGrupo.nombre}"? Los documentos no se tocan, solo dejan de estar agrupados.`)) return
    setError(null)
    try {
      await api.eliminarGrupo(proyecto.id, grupo.id)
      onEliminado()
    } catch (err) {
      setError(err.message)
    }
  }

  const idsEnGrupo = new Set((documentos || []).map((d) => d.id))
  const opcionesDocumentos = candidatos
    .filter((d) => !idsEnGrupo.has(d.id))
    .map((d) => ({ value: String(d.id), label: `${d.nombre} (${d.tipo_documento})` }))

  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Grupos
      </Anchor>

      {!editando ? (
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Title order={2} mb="6">
              {datosGrupo.nombre}
            </Title>
            <Text c="dimmed" fz="13.5px" maw={620}>
              {datosGrupo.proposito}
            </Text>
          </div>
          {proyecto.puede_editar && (
            <Group gap="8" wrap="nowrap">
              <Button variant="default" onClick={() => setEditando(true)}>
                Editar
              </Button>
              <Button variant="subtle" color="red" leftSection={<IconTrash size={15} stroke={1.8} />} onClick={eliminarGrupo}>
                Borrar grupo
              </Button>
            </Group>
          )}
        </Group>
      ) : (
        <Paper withBorder radius="lg" p="16" mb="lg">
          <TextInput label="Nombre" value={nombre} onChange={(e) => setNombre(e.currentTarget.value)} mb="8" required />
          <Textarea
            label="Para qué sirve" value={proposito} onChange={(e) => setProposito(e.currentTarget.value)}
            autosize minRows={2} mb="10" required
          />
          <Group gap="8">
            <Button onClick={guardarDatos} loading={guardando}>
              Guardar
            </Button>
            <Button variant="subtle" color="gray" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </Group>
        </Paper>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {proyecto.puede_editar && (
        <Group mb="lg" align="flex-end" gap="8">
          <Select
            label="Añadir documento a este grupo" placeholder="Buscar documento..."
            data={opcionesDocumentos} value={idDocumentoNuevo} onChange={setIdDocumentoNuevo}
            searchable style={{ flex: 1, maxWidth: 420 }}
          />
          <Button onClick={anadirDocumento} loading={anadiendo} disabled={!idDocumentoNuevo} leftSection={<IconPlus size={15} stroke={2.2} />}>
            Añadir
          </Button>
        </Group>
      )}

      {!documentos ? (
        <Text>Cargando...</Text>
      ) : documentos.length === 0 ? (
        <Text c="dimmed">Este grupo todavía no tiene ningún documento.</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Documento</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {documentos.map((d) => (
                <Table.Tr key={d.id} style={{ opacity: d.archivado ? 0.55 : 1 }}>
                  <Table.Td fw={500}>{d.nombre}</Table.Td>
                  <Table.Td>
                    <Badge color="gray" variant="light" radius="sm" tt="none" fw={500}>
                      {d.tipo_documento}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {proyecto.puede_editar && (
                      <Anchor component="button" type="button" c="red" size="sm" onClick={() => quitarDocumento(d.id)}>
                        Quitar
                      </Anchor>
                    )}
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
