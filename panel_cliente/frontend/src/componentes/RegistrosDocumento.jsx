import { useEffect, useState } from "react"
import { Alert, Badge, CloseButton, Group, Text } from "@mantine/core"
import { IconClipboardData } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

// Registros de datos vinculados a este documento. Se vinculan desde el
// registro (pantalla "Registros de datos" o la IA); aquí se ven y se quitan.
export default function RegistrosDocumento({ proyecto, idDocumento }) {
  const [registros, setRegistros] = useState(null)
  const [error, setError] = useState(null)

  function recargar() {
    return api
      .listarRegistrosDocumento(proyecto.id, idDocumento)
      .then(setRegistros)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento])

  async function quitar(idRegistro) {
    setError(null)
    try {
      await api.desvincularDocumentoRegistro(proyecto.id, idRegistro, idDocumento)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!registros?.length && !error) return null

  return (
    <Group gap="8" mb="lg" wrap="wrap" align="center">
      <Group gap="4" wrap="nowrap">
        <IconClipboardData size={15} stroke={1.8} color="var(--mantine-color-dimmed)" />
        <Text size="12.5px" c="dimmed">
          Registros:
        </Text>
      </Group>
      {registros?.map((r) => (
        <Badge
          key={r.id} variant="light" tt="none" fw={500}
          color={r.conforme === false ? "red" : r.conforme ? "green" : "gray"}
          title={r.observaciones || undefined}
          rightSection={
            proyecto.puede_editar ? (
              <CloseButton size="xs" variant="transparent" onClick={() => quitar(r.id)} />
            ) : null
          }
        >
          {r.modelo} · {formatearFecha(r.fecha)}
        </Badge>
      ))}
      {error && (
        <Alert color="red" py="2" px="8">
          {error}
        </Alert>
      )}
    </Group>
  )
}
