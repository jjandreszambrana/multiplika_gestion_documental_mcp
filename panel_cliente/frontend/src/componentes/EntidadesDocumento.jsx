import { useEffect, useState } from "react"
import { Alert, Badge, CloseButton, Group, Select, Text } from "@mantine/core"
import { IconUsers } from "@tabler/icons-react"
import { api } from "../api"

export default function EntidadesDocumento({ proyecto, idDocumento }) {
  const [entidades, setEntidades] = useState(null)
  const [todas, setTodas] = useState([])
  const [idEntidadNueva, setIdEntidadNueva] = useState(null)
  const [error, setError] = useState(null)

  function recargar() {
    return api
      .listarEntidadesDocumento(proyecto.id, idDocumento)
      .then(setEntidades)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    recargar()
    api.listarEntidades(proyecto.id).then(setTodas).catch(() => setTodas([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento])

  async function anadir(idEntidad) {
    if (!idEntidad) return
    setError(null)
    try {
      await api.relacionarDocumentoEntidad(proyecto.id, Number(idEntidad), idDocumento)
      setIdEntidadNueva(null)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function quitar(idEntidad) {
    setError(null)
    try {
      await api.quitarRelacionDocumentoEntidad(proyecto.id, idEntidad, idDocumento)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!proyecto.puede_editar && entidades?.length === 0) return null

  const idsRelacionados = new Set((entidades || []).map((e) => e.id))
  const opciones = todas
    .filter((e) => !idsRelacionados.has(e.id))
    .map((e) => ({ value: String(e.id), label: `${e.nombre} (${e.tipo})` }))

  return (
    <Group gap="8" mb="lg" wrap="wrap" align="center">
      <Group gap="4" wrap="nowrap">
        <IconUsers size={15} stroke={1.8} color="var(--mantine-color-dimmed)" />
        <Text size="12.5px" c="dimmed">
          Entidades:
        </Text>
      </Group>
      {entidades?.map((e) => (
        <Badge
          key={e.id} color="grape" variant="light" title={e.tipo}
          rightSection={
            proyecto.puede_editar ? (
              <CloseButton size="xs" variant="transparent" onClick={() => quitar(e.id)} />
            ) : null
          }
        >
          {e.nombre}
        </Badge>
      ))}
      {entidades?.length === 0 && (
        <Text size="12.5px" c="dimmed">
          Sin entidad relacionada
        </Text>
      )}
      {proyecto.puede_editar && opciones.length > 0 && (
        <Select
          placeholder="Relacionar con..." data={opciones} value={idEntidadNueva}
          onChange={anadir} searchable size="xs" w={220}
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
