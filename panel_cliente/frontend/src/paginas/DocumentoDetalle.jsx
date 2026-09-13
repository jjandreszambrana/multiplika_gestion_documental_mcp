import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Stack, Table, Text, Textarea, Title } from "@mantine/core"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import { formatearFecha } from "../formato"
import HistorialEdicion from "../componentes/HistorialEdicion"

export default function DocumentoDetalle({ proyecto, idDocumento, onVolver }) {
  const [documento, setDocumento] = useState(null)
  const [error, setError] = useState(null)
  const [cambiandoArchivo, setCambiandoArchivo] = useState(false)
  const [editando, setEditando] = useState(false)
  const [textoEditado, setTextoEditado] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [historialVersion, setHistorialVersion] = useState(0)

  useEffect(() => {
    cargarDocumento()
  }, [proyecto.id, idDocumento])

  function cargarDocumento() {
    return api
      .obtenerDocumento(proyecto.id, idDocumento)
      .then((d) => {
        setDocumento(d)
        setHistorialVersion((v) => v + 1)
      })
      .catch((err) => setError(err.message))
  }

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

  function empezarEdicion() {
    // Si hay un borrador sin confirmar (de esta sesión o de otra
    // anterior, propia o de otro usuario), se retoma ese texto en vez
    // del confirmado — el aviso ya se muestra en la propia pantalla.
    setTextoEditado(documento.tmp ?? documento.markdown)
    setEditando(true)
  }

  async function guardarBorrador() {
    setGuardando(true)
    setError(null)
    try {
      await api.guardarBorradorDocumento(proyecto.id, idDocumento, documento.id_version, textoEditado)
      setDocumento({ ...documento, tmp: textoEditado })
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarEdicion() {
    setGuardando(true)
    setError(null)
    try {
      await api.guardarBorradorDocumento(proyecto.id, idDocumento, documento.id_version, textoEditado)
      await api.confirmarEdicionDocumento(proyecto.id, idDocumento, documento.id_version)
      setEditando(false)
      await cargarDocumento()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
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
          {documento.incumplimientos && (
            <Alert color="red" mb="md" title="No cumple el formato/normativa de su tipo">
              {documento.incumplimientos}
            </Alert>
          )}
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
          <Group mb="md">
            <Button onClick={alternarArchivado} loading={cambiandoArchivo} variant="light">
              {documento.archivado ? "Desarchivar" : "Archivar"}
            </Button>
            {proyecto.puede_editar && !editando && (
              <Button onClick={empezarEdicion} variant="light">
                Editar
              </Button>
            )}
            <Button onClick={() => setMostrarHistorial(!mostrarHistorial)} variant="subtle">
              {mostrarHistorial ? "Ocultar historial" : "Ver historial de cambios"}
            </Button>
          </Group>

          {editando ? (
            <Stack>
              {documento.tmp && (
                <Alert color="yellow">
                  Hay un borrador sin confirmar
                  {documento.tmp_usuario && ` de ${documento.tmp_usuario}`}
                  {documento.tmp_fecha && ` (${formatearFecha(documento.tmp_fecha)})`} — se ha
                  cargado aquí en vez del texto confirmado. Confirma o descarta antes de seguir.
                </Alert>
              )}
              <Textarea
                value={textoEditado}
                onChange={(e) => setTextoEditado(e.currentTarget.value)}
                autosize minRows={15} styles={{ input: { fontFamily: "monospace" } }}
              />
              <Group>
                <Button onClick={confirmarEdicion} loading={guardando}>
                  Confirmar cambios
                </Button>
                <Button onClick={guardarBorrador} loading={guardando} variant="light">
                  Guardar borrador
                </Button>
                <Button onClick={() => setEditando(false)} variant="subtle">
                  Cerrar sin confirmar
                </Button>
              </Group>
            </Stack>
          ) : (
            <Paper withBorder p="lg">
              <Markdown>{documento.markdown}</Markdown>
            </Paper>
          )}

          {mostrarHistorial && (
            <HistorialEdicion
              key={historialVersion}
              proyecto={proyecto}
              idDocumento={idDocumento}
              idVersion={documento.id_version}
              onRevertido={cargarDocumento}
            />
          )}
        </>
      )}
    </>
  )
}
