import { useEffect, useState } from "react"
import { Alert, Badge, Button, CloseButton, Group, Modal, Select, Text } from "@mantine/core"
import { IconPlus, IconUsers } from "@tabler/icons-react"
import { api } from "../api"
import FormularioEntidad from "./FormularioEntidad"

export default function EntidadesDocumento({ proyecto, idDocumento, refresco }) {
  const [entidades, setEntidades] = useState(null)
  const [todas, setTodas] = useState([])
  const [idEntidadNueva, setIdEntidadNueva] = useState(null)
  const [error, setError] = useState(null)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [nueva, setNueva] = useState({})
  const [creando, setCreando] = useState(false)
  const [errorModal, setErrorModal] = useState(null)

  function recargar() {
    return api
      .listarEntidadesDocumento(proyecto.id, idDocumento)
      .then(setEntidades)
      .catch((err) => setError(err.message))
  }

  function recargarTodas() {
    return api.listarEntidades(proyecto.id).then(setTodas).catch(() => setTodas([]))
  }

  useEffect(() => {
    recargar()
    recargarTodas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento, refresco])

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

  const tiposConocidos = [...new Set(todas.map((e) => e.tipo))]

  async function crearYRelacionar(evento) {
    evento.preventDefault()
    setCreando(true)
    setErrorModal(null)
    try {
      const entidad = await api.crearEntidad(proyecto.id, nueva)
      await api.relacionarDocumentoEntidad(proyecto.id, entidad.id, idDocumento)
      setNueva({})
      setModalAbierto(false)
      await Promise.all([recargar(), recargarTodas()])
    } catch (err) {
      setErrorModal(err.message)
    } finally {
      setCreando(false)
    }
  }

  if (!proyecto.puede_editar && entidades?.length === 0) return null

  const idsRelacionados = new Set((entidades || []).map((e) => e.id))
  const opciones = todas
    .filter((e) => !idsRelacionados.has(e.id))
    .map((e) => ({ value: String(e.id), label: `${e.nombre} (${e.tipo})` }))

  return (
    <>
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
        {proyecto.puede_editar && (
          <>
            {opciones.length > 0 && (
              <Select
                placeholder="Relacionar con..." data={opciones} value={idEntidadNueva}
                onChange={anadir} searchable size="sm" w={340}
              />
            )}
            <Button
              variant="subtle" size="compact-xs" leftSection={<IconPlus size={13} />}
              onClick={() => setModalAbierto(true)}
            >
              Nueva entidad
            </Button>
          </>
        )}
        {error && (
          <Alert color="red" py="2" px="8">
            {error}
          </Alert>
        )}
      </Group>

      <Modal opened={modalAbierto} onClose={() => setModalAbierto(false)} title="Nueva entidad" size="lg">
        <form onSubmit={crearYRelacionar}>
          {errorModal && (
            <Alert color="red" mb="md">
              {errorModal}
            </Alert>
          )}
          <FormularioEntidad valores={nueva} onChange={setNueva} tiposConocidos={tiposConocidos} />
          <Button type="submit" mt="10" loading={creando}>
            Crear y relacionar
          </Button>
        </form>
      </Modal>
    </>
  )
}
