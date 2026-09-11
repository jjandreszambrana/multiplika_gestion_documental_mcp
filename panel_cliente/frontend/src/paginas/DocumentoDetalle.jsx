import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Table, Text, Title } from "@mantine/core"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import { formatearFecha } from "../formato"

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
          <Table withTableBorder mb="lg" w="fit-content">
            <Table.Tbody>
              <Table.Tr>
                <Table.Th>Tipo de documento</Table.Th>
                <Table.Td>{documento.tipo_documento}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Ámbito</Table.Th>
                <Table.Td>{documento.ambito || "—"}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Fecha del documento</Table.Th>
                <Table.Td>{formatearFecha(documento.fecha_documento)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Dado de alta el</Table.Th>
                <Table.Td>{formatearFecha(documento.fecha_alta)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Última versión subida el</Table.Th>
                <Table.Td>{formatearFecha(documento.fecha_subida)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Fecha de caducidad</Table.Th>
                <Table.Td>{formatearFecha(documento.fecha_caducidad)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Corregido a mano</Table.Th>
                <Table.Td>{documento.revisado_manualmente ? "Sí" : "No"}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Histórico completo buscable</Table.Th>
                <Table.Td>{documento.todas_versiones_buscables ? "Sí" : "No, solo la última versión"}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Fuente</Table.Th>
                <Table.Td>
                  {documento.url_origen ? (
                    <Anchor href={documento.url_origen} target="_blank" rel="noopener noreferrer">
                      {documento.url_origen}
                    </Anchor>
                  ) : (
                    "—"
                  )}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Button onClick={alternarArchivado} loading={cambiandoArchivo} mb="md" variant="light">
            {documento.archivado ? "Desarchivar" : "Archivar"}
          </Button>
          <Paper withBorder p="lg">
            <Markdown>{documento.markdown}</Markdown>
          </Paper>
        </>
      )}
    </>
  )
}
