import { useEffect, useState } from "react"
import { Alert, Badge, CloseButton, Group, Select, Text } from "@mantine/core"
import { IconCode } from "@tabler/icons-react"
import { api } from "../api"

export default function ScriptsDocumento({ proyecto, idDocumento, refresco }) {
  const [scripts, setScripts] = useState(null)
  const [todos, setTodos] = useState([])
  const [idScriptNuevo, setIdScriptNuevo] = useState(null)
  const [error, setError] = useState(null)

  function recargar() {
    return api
      .listarScriptsDocumento(proyecto.id, idDocumento)
      .then(setScripts)
      .catch((err) => setError(err.message))
  }

  function recargarTodos() {
    return api.listarScripts(proyecto.id).then(setTodos).catch(() => setTodos([]))
  }

  useEffect(() => {
    recargar()
    recargarTodos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento, refresco])

  async function anadir(idScript) {
    if (!idScript) return
    setError(null)
    try {
      await api.relacionarDocumentoScript(proyecto.id, Number(idScript), idDocumento)
      setIdScriptNuevo(null)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function quitar(idScript) {
    setError(null)
    try {
      await api.quitarRelacionDocumentoScript(proyecto.id, idScript, idDocumento)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!proyecto.puede_editar && scripts?.length === 0) return null

  const idsRelacionados = new Set((scripts || []).map((s) => s.id))
  const opciones = todos
    .filter((s) => !idsRelacionados.has(s.id))
    .map((s) => ({ value: String(s.id), label: `${s.titulo} (${s.lenguaje})` }))

  return (
    <Group gap="8" mb="lg" wrap="wrap" align="center">
      <Group gap="4" wrap="nowrap">
        <IconCode size={15} stroke={1.8} color="var(--mantine-color-dimmed)" />
        <Text size="12.5px" c="dimmed">
          Scripts:
        </Text>
      </Group>
      {scripts?.map((s) => (
        <Badge
          key={s.id} color="blue" variant="light" title={s.lenguaje}
          rightSection={
            proyecto.puede_editar ? (
              <CloseButton size="xs" variant="transparent" onClick={() => quitar(s.id)} />
            ) : null
          }
        >
          {s.titulo}
        </Badge>
      ))}
      {scripts?.length === 0 && (
        <Text size="12.5px" c="dimmed">
          Sin script relacionado
        </Text>
      )}
      {proyecto.puede_editar && opciones.length > 0 && (
        <Select
          placeholder="Relacionar con..." data={opciones} value={idScriptNuevo}
          onChange={anadir} searchable size="sm" w={340}
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
