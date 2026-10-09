import { useEffect, useState } from "react"
import { Alert, Badge, Button, CloseButton, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core"
import { IconFolders, IconPlus } from "@tabler/icons-react"
import { api } from "../api"

export default function GruposDocumento({ proyecto, idDocumento, refresco }) {
  const [grupos, setGrupos] = useState(null)
  const [todos, setTodos] = useState([])
  const [idGrupoNuevo, setIdGrupoNuevo] = useState(null)
  const [error, setError] = useState(null)
  const [creando, setCreando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState("")
  const [propositoNuevo, setPropositoNuevo] = useState("")
  const [guardando, setGuardando] = useState(false)

  function recargar() {
    return api
      .listarGruposDocumento(proyecto.id, idDocumento)
      .then(setGrupos)
      .catch((err) => setError(err.message))
  }

  function recargarTodos() {
    return api.listarGrupos(proyecto.id).then(setTodos).catch(() => setTodos([]))
  }

  useEffect(() => {
    recargar()
    recargarTodos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento, refresco])

  async function anadir(idGrupo) {
    if (!idGrupo) return
    setError(null)
    try {
      await api.asignarDocumentoGrupo(proyecto.id, Number(idGrupo), idDocumento)
      setIdGrupoNuevo(null)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function quitar(idGrupo) {
    setError(null)
    try {
      await api.quitarDocumentoGrupo(proyecto.id, idGrupo, idDocumento)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function crearYAsignar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const grupo = await api.crearGrupo(proyecto.id, nombreNuevo, propositoNuevo)
      await api.asignarDocumentoGrupo(proyecto.id, grupo.id, idDocumento)
      setNombreNuevo("")
      setPropositoNuevo("")
      setCreando(false)
      await Promise.all([recargar(), recargarTodos()])
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!proyecto.puede_editar && grupos?.length === 0) return null

  const idsAsignados = new Set((grupos || []).map((g) => g.id))
  const opciones = todos
    .filter((g) => !idsAsignados.has(g.id))
    .map((g) => ({ value: String(g.id), label: g.nombre }))

  return (
    <Stack gap="8" mb="lg">
      <Group gap="8" wrap="wrap" align="center">
        <Group gap="4" wrap="nowrap">
          <IconFolders size={15} stroke={1.8} color="var(--mantine-color-dimmed)" />
          <Text size="12.5px" c="dimmed">
            Grupos:
          </Text>
        </Group>
        {grupos?.map((g) => (
          <Badge
            key={g.id} color="acento" variant="light" title={g.proposito}
            rightSection={
              proyecto.puede_editar ? (
                <CloseButton size="xs" variant="transparent" onClick={() => quitar(g.id)} />
              ) : null
            }
          >
            {g.nombre}
          </Badge>
        ))}
        {grupos?.length === 0 && (
          <Text size="12.5px" c="dimmed">
            Sin grupo asignado
          </Text>
        )}
        {proyecto.puede_editar && !creando && (
          <>
            {opciones.length > 0 && (
              <Select
                placeholder="Añadir a un grupo..." data={opciones} value={idGrupoNuevo}
                onChange={anadir} searchable size="sm" w={340}
              />
            )}
            <Button
              variant="subtle" size="compact-xs" leftSection={<IconPlus size={13} />}
              onClick={() => setCreando(true)}
            >
              Nuevo grupo
            </Button>
          </>
        )}
        {error && (
          <Alert color="red" py="2" px="8">
            {error}
          </Alert>
        )}
      </Group>

      {creando && (
        <Group
          component="form" onSubmit={crearYAsignar} align="flex-end" gap="8"
          p="10" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-lg)" }}
        >
          <TextInput
            label="Nombre del grupo nuevo" size="xs" value={nombreNuevo} required
            onChange={(e) => setNombreNuevo(e.currentTarget.value)}
            style={{ width: 200 }}
          />
          <Textarea
            label="Para qué sirve" size="xs" value={propositoNuevo} required
            onChange={(e) => setPropositoNuevo(e.currentTarget.value)}
            autosize minRows={1} style={{ flex: 1, minWidth: 220 }}
          />
          <Button type="submit" size="xs" loading={guardando}>
            Crear y asignar
          </Button>
          <Button variant="subtle" color="gray" size="xs" onClick={() => setCreando(false)}>
            Cancelar
          </Button>
        </Group>
      )}
    </Stack>
  )
}
