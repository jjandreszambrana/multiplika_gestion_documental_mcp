import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Group, Paper, Select, Table, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core"
import { CodeHighlight } from "@mantine/code-highlight"
import { IconArchive, IconArchiveOff, IconArrowLeft, IconPlus, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

export default function ScriptDetalle({ proyecto, script, onVolver, onCambiado }) {
  const [datos, setDatos] = useState(script)
  const [editando, setEditando] = useState(false)
  const [valoresEdicion, setValoresEdicion] = useState(script)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [documentos, setDocumentos] = useState(null)
  const [candidatos, setCandidatos] = useState([])
  const [idDocumentoNuevo, setIdDocumentoNuevo] = useState(null)
  const [anadiendo, setAnadiendo] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  function recargarDocumentos() {
    return api
      .listarDocumentosScript(proyecto.id, script.id)
      .then(setDocumentos)
      .catch((err) => setError(err.message))
  }

  function cargarCandidatos() {
    return api.listarOBuscarDocumentos(proyecto.id, "").then(setCandidatos).catch(() => setCandidatos([]))
  }

  useEffect(() => {
    recargarDocumentos()
    cargarCandidatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, script.id])

  function recargar() {
    setRefrescando(true)
    Promise.all([
      api.obtenerScript(proyecto.id, script.id).then(setDatos).catch((err) => setError(err.message)),
      recargarDocumentos(),
      cargarCandidatos(),
    ]).finally(() => setRefrescando(false))
  }

  async function anadirDocumento() {
    if (!idDocumentoNuevo) return
    setAnadiendo(true)
    setError(null)
    try {
      await api.relacionarDocumentoScript(proyecto.id, script.id, Number(idDocumentoNuevo))
      setIdDocumentoNuevo(null)
      await recargarDocumentos()
    } catch (err) {
      setError(err.message)
    } finally {
      setAnadiendo(false)
    }
  }

  async function quitarDocumento(idDocumento) {
    setError(null)
    try {
      await api.quitarRelacionDocumentoScript(proyecto.id, script.id, idDocumento)
      await recargarDocumentos()
    } catch (err) {
      setError(err.message)
    }
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await api.actualizarScript(proyecto.id, script.id, {
        titulo: valoresEdicion.titulo,
        descripcion: valoresEdicion.descripcion,
        lenguaje: valoresEdicion.lenguaje,
        etiquetas: valoresEdicion.etiquetas,
      })
      setDatos(actualizado)
      setEditando(false)
      onCambiado?.(actualizado)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function alternarArchivado() {
    setError(null)
    try {
      const actualizado = datos.archivado
        ? await api.desarchivarScript(proyecto.id, script.id)
        : await api.archivarScript(proyecto.id, script.id)
      setDatos(actualizado)
      onCambiado?.(actualizado)
    } catch (err) {
      setError(err.message)
    }
  }

  const idsRelacionados = new Set((documentos || []).map((d) => d.id))
  const opcionesDocumentos = candidatos
    .filter((d) => !idsRelacionados.has(d.id))
    .map((d) => ({ value: String(d.id), label: `${d.nombre} (${d.tipo_documento})` }))

  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Scripts
      </Anchor>

      {!editando ? (
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Group gap="8" mb="6">
              <Title order={2}>{datos.titulo}</Title>
              <Badge color="gray" variant="light" tt="none" fw={500}>
                {datos.lenguaje}
              </Badge>
              {datos.archivado && (
                <Badge color="orange" variant="light" tt="none" fw={500}>
                  Archivado
                </Badge>
              )}
            </Group>
            <Text c="dimmed" fz="13.5px">
              Creado por {datos.creado_por} el {formatearFecha(datos.fecha_alta)} · usado {datos.veces_usado} veces
              {datos.fecha_ultimo_uso ? ` · último uso ${formatearFecha(datos.fecha_ultimo_uso)}` : ""}
            </Text>
          </div>
          <Group gap="8" wrap="nowrap">
            <Tooltip label="Refrescar">
              <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={refrescando}>
                <IconRefresh size={17} stroke={1.8} />
              </ActionIcon>
            </Tooltip>
            {proyecto.puede_editar && (
              <>
                <Button variant="default" onClick={() => { setValoresEdicion(datos); setEditando(true) }}>
                  Editar
                </Button>
                <Button
                  variant="subtle" color={datos.archivado ? "green" : "orange"}
                  leftSection={datos.archivado ? <IconArchiveOff size={15} stroke={1.8} /> : <IconArchive size={15} stroke={1.8} />}
                  onClick={alternarArchivado}
                >
                  {datos.archivado ? "Desarchivar" : "Archivar"}
                </Button>
              </>
            )}
          </Group>
        </Group>
      ) : (
        <Paper withBorder radius="lg" p="16" mb="lg">
          <TextInput
            label="Título" mb="10" value={valoresEdicion.titulo || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, titulo: e.target.value })}
          />
          <Textarea
            label="Descripción" mb="10" minRows={3} autosize
            value={valoresEdicion.descripcion || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, descripcion: e.target.value })}
          />
          <TextInput
            label="Lenguaje" mb="10" value={valoresEdicion.lenguaje || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, lenguaje: e.target.value })}
          />
          <TextInput
            label="Etiquetas" mb="10" placeholder="separadas por comas"
            value={valoresEdicion.etiquetas || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, etiquetas: e.target.value })}
          />
          <Group gap="8" mt="10">
            <Button onClick={guardar} loading={guardando}>
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

      {datos.etiquetas && (
        <Text c="dimmed" fz="13.5px" mb="md">
          Etiquetas: {datos.etiquetas}
        </Text>
      )}

      <Title order={4} fz="16px" mb="10">
        Código
      </Title>
      <Text c="dimmed" fz="13.5px" mb="10">
        Solo lectura — el código lo escribe y corrige tu IA, no se puede editar desde aquí.
      </Text>
      <CodeHighlight code={datos.codigo} language={datos.lenguaje} withCopyButton radius="lg" />

      <Title order={4} fz="16px" mb="10" mt="xl">
        Documentos relacionados
      </Title>

      {proyecto.puede_editar && (
        <Group mb="lg" align="flex-end" gap="8">
          <Select
            label="Relacionar con un documento" placeholder="Buscar documento..."
            data={opcionesDocumentos} value={idDocumentoNuevo} onChange={setIdDocumentoNuevo}
            searchable style={{ flex: 1, maxWidth: 420 }}
          />
          <Button onClick={anadirDocumento} loading={anadiendo} disabled={!idDocumentoNuevo} leftSection={<IconPlus size={15} stroke={2.2} />}>
            Relacionar
          </Button>
        </Group>
      )}

      {!documentos ? (
        <Text>Cargando...</Text>
      ) : documentos.length === 0 ? (
        <Text c="dimmed">Sin documentos relacionados todavía.</Text>
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
