import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Text, Title } from "@mantine/core"
import { api } from "../api"

export default function DocumentoDetalle({ proyecto, idDocumento, onVolver }) {
  const [documento, setDocumento] = useState(null)
  const [error, setError] = useState(null)
  const [cambiandoArchivo, setCambiandoArchivo] = useState(false)

  useEffect(() => {
    api
      .obtenerDocumento(proyecto.id, idDocumento)
      .then(setDocumento)
      .catch((err) => setError(err.message))
  }, [proyecto.id, idDocumento])

  async function alternarArchivado() {
    setCambiandoArchivo(true)
    setError(null)
    try {
      const actualizado = documento.archivado
        ? await api.desarchivarDocumento(proyecto.id, idDocumento)
        : await api.archivarDocumento(proyecto.id, idDocumento)
      setDocumento({ ...documento, ...actualizado })
    } catch (err) {
      setError(err.message)
    } finally {
      setCambiandoArchivo(false)
    }
  }

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="md" display="block">
        ← Documentos
      </Anchor>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!documento && !error && <Text>Cargando...</Text>}

      {documento && (
        <>
          <Group gap="sm" mb="xs">
            <Title order={2}>{documento.nombre}</Title>
            {documento.archivado && (
              <Badge color="gray" variant="light">
                🗄 Archivado
              </Badge>
            )}
          </Group>
          <Text c="dimmed" mb="md">
            {documento.tipo_documento} — {documento.fecha_documento}
            {documento.fecha_caducidad && ` — caduca el ${documento.fecha_caducidad}`}
            {documento.revisado_manualmente && " — corregido a mano"}
          </Text>
          {documento.url_origen && (
            <Text mb="md">
              Fuente:{" "}
              <Anchor href={documento.url_origen} target="_blank" rel="noopener noreferrer">
                {documento.url_origen}
              </Anchor>
            </Text>
          )}
          <Button onClick={alternarArchivado} loading={cambiandoArchivo} mb="md" variant="light">
            {documento.archivado ? "Desarchivar" : "Archivar"}
          </Button>
          <Paper withBorder p="lg">
            <Text ff="monospace" size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {documento.markdown}
            </Text>
          </Paper>
        </>
      )}
    </>
  )
}
