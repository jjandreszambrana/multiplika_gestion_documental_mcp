import { useEffect, useState } from "react"
import { Alert, Badge, CloseButton, Group, Select, Text } from "@mantine/core"
import { IconFolders } from "@tabler/icons-react"
import { api } from "../api"

export default function GruposDocumento({ proyecto, idDocumento }) {
  const [grupos, setGrupos] = useState(null)
  const [todos, setTodos] = useState([])
  const [idGrupoNuevo, setIdGrupoNuevo] = useState(null)
  const [error, setError] = useState(null)

  function recargar() {
    return api
      .listarGruposDocumento(proyecto.id, idDocumento)
      .then(setGrupos)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    recargar()
    api.listarGrupos(proyecto.id).then(setTodos).catch(() => setTodos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento])

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

  if (!proyecto.puede_editar && grupos?.length === 0) return null

  const idsAsignados = new Set((grupos || []).map((g) => g.id))
  const opciones = todos
    .filter((g) => !idsAsignados.has(g.id))
    .map((g) => ({ value: String(g.id), label: g.nombre }))

  return (
    <Group gap="8" mb="lg" wrap="wrap" align="center">
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
      {proyecto.puede_editar && opciones.length > 0 && (
        <Select
          placeholder="Añadir a un grupo..." data={opciones} value={idGrupoNuevo}
          onChange={anadir} searchable size="xs" w={200}
        />
      )}
      {error && (
        <Alert color="red" py="2" px="8">
          {error}
        </Alert>
      )}
    </Group>
  )
}
