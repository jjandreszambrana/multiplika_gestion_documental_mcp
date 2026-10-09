import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Group, Paper, Select, Table, Text, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import FormularioEntidad from "../componentes/FormularioEntidad"
import NotasBlocVinculadas from "../componentes/NotasBlocVinculadas"
import ContactosEntidad from "../componentes/ContactosEntidad"
import { FacturacionEntidad, HistorialEntidad, OportunidadesEntidad } from "../componentes/VentasEntidad"

const ETIQUETAS = {
  direccion: "Dirección", localidad: "Localidad", provincia: "Provincia",
  codigo_postal: "Código postal", pais: "País", telefono: "Teléfono",
  email: "Email", nif: "NIF", codigo: "Código (ERP)", observaciones: "Observaciones",
}

export default function EntidadDetalle({ proyecto, entidad, onVolver, onEliminada, onVerNota, onNuevaNota, onVerDocumento }) {
  const [datos, setDatos] = useState(entidad)
  const [editando, setEditando] = useState(false)
  const [valoresEdicion, setValoresEdicion] = useState(entidad)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [documentos, setDocumentos] = useState(null)
  const [candidatos, setCandidatos] = useState([])
  const [idDocumentoNuevo, setIdDocumentoNuevo] = useState(null)
  const [anadiendo, setAnadiendo] = useState(false)
  // Sube al cambiar una oportunidad, para que el historial se recargue
  const [versionHistorial, setVersionHistorial] = useState(0)
  const [refrescando, setRefrescando] = useState(false)
  const [refresco, setRefresco] = useState(0)

  function recargarDocumentos() {
    return api
      .listarDocumentosEntidad(proyecto.id, entidad.id)
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
  }, [proyecto.id, entidad.id])

  function recargar() {
    setRefrescando(true)
    setRefresco((r) => r + 1)
    Promise.all([
      api.obtenerEntidad(proyecto.id, entidad.id).then(setDatos).catch((err) => setError(err.message)),
      recargarDocumentos(),
      cargarCandidatos(),
    ]).finally(() => setRefrescando(false))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const actualizada = await api.actualizarEntidad(proyecto.id, entidad.id, valoresEdicion)
      setDatos(actualizada)
      setEditando(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!confirm(`¿Borrar "${datos.nombre}"? Los documentos relacionados no se tocan.`)) return
    setError(null)
    try {
      await api.eliminarEntidad(proyecto.id, entidad.id)
      onEliminada()
    } catch (err) {
      setError(err.message)
    }
  }

  async function anadirDocumento() {
    if (!idDocumentoNuevo) return
    setAnadiendo(true)
    setError(null)
    try {
      await api.relacionarDocumentoEntidad(proyecto.id, entidad.id, Number(idDocumentoNuevo))
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
      await api.quitarRelacionDocumentoEntidad(proyecto.id, entidad.id, idDocumento)
      await recargarDocumentos()
    } catch (err) {
      setError(err.message)
    }
  }

  const idsRelacionados = new Set((documentos || []).map((d) => d.id))
  const opcionesDocumentos = candidatos
    .filter((d) => !idsRelacionados.has(d.id))
    .map((d) => ({ value: String(d.id), label: `${d.nombre} (${d.tipo_documento})` }))

  const camposConValor = Object.keys(ETIQUETAS).filter((k) => datos[k])

  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Entidades
      </Anchor>

      {!editando ? (
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Group gap="8" mb="6">
              <Title order={2}>{datos.nombre}</Title>
              <Badge color="gray" variant="light" tt="none" fw={500}>
                {datos.tipo}
              </Badge>
            </Group>
            {camposConValor.length > 0 && (
              <Text c="dimmed" fz="13.5px">
                {camposConValor.map((k) => `${ETIQUETAS[k]}: ${datos[k]}`).join(" · ")}
              </Text>
            )}
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
                <Button variant="subtle" color="red" leftSection={<IconTrash size={15} stroke={1.8} />} onClick={eliminar}>
                  Borrar
                </Button>
              </>
            )}
          </Group>
        </Group>
      ) : (
        <Paper withBorder radius="lg" p="16" mb="lg">
          <FormularioEntidad valores={valoresEdicion} onChange={setValoresEdicion} />
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

      <Title order={4} fz="16px" mb="10">
        Personas de contacto
      </Title>
      <ContactosEntidad proyecto={proyecto} idEntidad={entidad.id} refresco={refresco} />

      <Title order={4} fz="16px" mt="xl" mb="10">
        Oportunidades de venta
      </Title>
      <OportunidadesEntidad
        proyecto={proyecto} idEntidad={entidad.id} onVerDocumento={onVerDocumento}
        onCambiadas={() => setVersionHistorial((v) => v + 1)} refresco={refresco}
      />

      <Title order={4} fz="16px" mt="xl" mb="10">
        Facturación
      </Title>
      <FacturacionEntidad proyecto={proyecto} idEntidad={entidad.id} refresco={refresco} />

      <Title order={4} fz="16px" mt="xl" mb="10">
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

      <Title order={4} fz="16px" mt="xl" mb="10">
        Bloc de notas
      </Title>
      <NotasBlocVinculadas
        proyecto={proyecto} enlace={{ tipo: "entidad", id: entidad.id }}
        onVerNota={onVerNota} onNuevaNota={onNuevaNota} refresco={refresco}
      />

      <Title order={4} fz="16px" mt="xl" mb="10">
        Historial
      </Title>
      <HistorialEntidad proyecto={proyecto} idEntidad={entidad.id} version={versionHistorial} refresco={refresco} />
    </>
  )
}
