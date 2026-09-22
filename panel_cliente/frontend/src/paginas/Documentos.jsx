import { useEffect, useState } from "react"
import { ActionIcon, Alert, Badge, Button, Group, Modal, Paper, Select, Table, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArchive, IconAlertTriangle, IconCircleCheck, IconClock, IconMessageCircle, IconRefresh, IconSearch, IconUpload } from "@tabler/icons-react"
import { api } from "../api"
import RegistrosDocumento from "../componentes/RegistrosDocumento"
import SubirDocumentosModal from "../componentes/SubirDocumentosModal"
import { formatearFecha } from "../formato"

function BadgesEstado({ doc }) {
  if (doc.borrador) {
    return (
      <Badge color="yellow" variant="light" leftSection={<IconClock size={12} />}>
        Borrador
      </Badge>
    )
  }
  if (doc.incumplimientos) {
    return (
      <Tooltip label={doc.incumplimientos} multiline w={280}>
        <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={12} />}>
          No cumple
        </Badge>
      </Tooltip>
    )
  }
  if (doc.revisado_manualmente) {
    return (
      <Badge color="green" variant="light" leftSection={<IconCircleCheck size={12} />}>
        Revisado a mano
      </Badge>
    )
  }
  return null
}

export default function Documentos({ proyecto, onCambiarProyecto, onVerDocumento, onPendientesCambiaron }) {
  const [q, setQ] = useState("")
  const [tipoDocumento, setTipoDocumento] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [tiposDocumento, setTiposDocumento] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [errorPendientes, setErrorPendientes] = useState(null)
  const [modalSubidaAbierto, setModalSubidaAbierto] = useState(false)
  const [docRegistros, setDocRegistros] = useState(null)

  useEffect(() => {
    api.listarTiposDocumento(proyecto.id)
      .then((tipos) => setTiposDocumento(tipos.map((t) => ({ value: t.nombre, label: t.nombre }))))
      .catch(() => setTiposDocumento([]))
  }, [proyecto.id])

  async function cargarPendientes() {
    try {
      const filas = await api.listarDocumentosPendientes(proyecto.id)
      setPendientes(filas)
      onPendientesCambiaron?.(filas.length)
    } catch (err) {
      setErrorPendientes(err.message)
    }
  }

  useEffect(() => {
    cargarPendientes()
  }, [proyecto.id])

  async function subirPendientes(archivos) {
    if (!archivos || archivos.length === 0) return
    setSubiendo(true)
    setErrorPendientes(null)
    try {
      await api.subirDocumentosPendientes(proyecto.id, archivos)
      await cargarPendientes()
    } catch (err) {
      setErrorPendientes(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function descartarPendiente(idPendiente) {
    try {
      await api.eliminarDocumentoPendiente(proyecto.id, idPendiente)
      await cargarPendientes()
    } catch (err) {
      setErrorPendientes(err.message)
    }
  }

  async function cargar(consulta, filtros = {}) {
    setCargando(true)
    setError(null)
    try {
      setResultados(await api.listarOBuscarDocumentos(proyecto.id, consulta, filtros))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar("")
  }, [proyecto.id])

  // Los filtros solo aplican al listado simple, no a la búsqueda por
  // contenido — son dos modos que no se combinan (ver panel_cliente/servidor.py).
  function buscar(evento) {
    evento.preventDefault()
    setTipoDocumento("")
    setFechaDesde("")
    setFechaHasta("")
    cargar(q)
  }

  function aplicarFiltros(tipo, desde, hasta) {
    setQ("")
    cargar("", { tipoDocumento: tipo, fechaDesde: desde, fechaHasta: hasta })
  }

  function limpiarFiltros() {
    setTipoDocumento("")
    setFechaDesde("")
    setFechaHasta("")
    cargar("")
  }

  function recargar() {
    cargar(q, { tipoDocumento, fechaDesde, fechaHasta })
  }

  const hayFiltros = tipoDocumento || fechaDesde || fechaHasta

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={2} mb={4}>
            {proyecto.nombre}
          </Title>
          <Text size="13.5px" c="dimmed">
            {resultados.length} documento{resultados.length === 1 ? "" : "s"}
            {onCambiarProyecto && (
              <>
                {" · "}
                <Text
                  component="button"
                  type="button"
                  onClick={onCambiarProyecto}
                  c="acento"
                  style={{ cursor: "pointer", background: "none", border: 0, padding: 0, font: "inherit" }}
                >
                  cambiar de proyecto
                </Text>
              </>
            )}
          </Text>
        </div>
        <Button leftSection={<IconUpload size={16} stroke={1.8} />} onClick={() => setModalSubidaAbierto(true)}>
          Subir documentos
          {pendientes.length > 0 && (
            <Badge ml="8" size="sm" circle color="red">
              {pendientes.length}
            </Badge>
          )}
        </Button>
      </Group>

      <SubirDocumentosModal
        opened={modalSubidaAbierto}
        onClose={() => setModalSubidaAbierto(false)}
        pendientes={pendientes}
        subiendo={subiendo}
        error={errorPendientes}
        onCerrarError={() => setErrorPendientes(null)}
        onSubir={subirPendientes}
        onDescartar={descartarPendiente}
      />

      <Group component="form" onSubmit={buscar} mb="md">
        <TextInput
          placeholder="Buscar por contenido (déjalo vacío para ver todos)"
          leftSection={<IconSearch size={15} stroke={2} />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 240, maxWidth: 420 }}
        />
        <Select
          placeholder="Tipo: todos"
          data={tiposDocumento}
          value={tipoDocumento}
          onChange={(valor) => {
            setTipoDocumento(valor || "")
            aplicarFiltros(valor || "", fechaDesde, fechaHasta)
          }}
          searchable
          clearable
          w={170}
        />
        <TextInput
          placeholder="Desde"
          type="date"
          value={fechaDesde}
          onChange={(e) => {
            setFechaDesde(e.target.value)
            aplicarFiltros(tipoDocumento, e.target.value, fechaHasta)
          }}
          w={150}
        />
        <TextInput
          placeholder="Hasta"
          type="date"
          value={fechaHasta}
          onChange={(e) => {
            setFechaHasta(e.target.value)
            aplicarFiltros(tipoDocumento, fechaDesde, e.target.value)
          }}
          w={150}
        />
        <div style={{ flex: 1 }} />
        {hayFiltros && (
          <Button variant="subtle" onClick={limpiarFiltros}>
            Quitar filtros
          </Button>
        )}
        <Button type="submit" variant="light">
          Buscar
        </Button>
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={cargando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {cargando ? (
        <Text>Cargando...</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Documento</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>{q ? "Fragmento" : "Fecha de alta"}</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resultados.map((r) => {
                const idDocumento = r.id ?? r.id_documento
                return (
                  <Table.Tr
                    key={`${idDocumento}-${r.id_version ?? ""}`}
                    onClick={() => onVerDocumento(idDocumento)}
                    style={{ cursor: "pointer", opacity: r.archivado ? 0.55 : 1 }}
                  >
                    <Table.Td fw={500}>{r.nombre}</Table.Td>
                    <Table.Td>
                      <Badge color="gray" variant="light" radius="sm" tt="none" fw={500}>
                        {r.tipo_documento}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {q ? (
                        <Text c="dimmed" size="sm">
                          {r.fragmento}
                        </Text>
                      ) : (
                        <Text size="13px" c="dimmed">
                          {formatearFecha(r.fecha_alta)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="6" wrap="nowrap">
                        <BadgesEstado doc={r} />
                        {r.archivado && (
                          <Badge color="gray" variant="light" leftSection={<IconArchive size={12} />}>
                            Archivado
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Tooltip
                        label={
                          r.incidencias_abiertas > 0
                            ? `${r.incidencias_abiertas} incidencia${r.incidencias_abiertas === 1 ? "" : "s"} abierta${r.incidencias_abiertas === 1 ? "" : "s"}`
                            : r.total_registros > 0
                              ? `${r.total_registros} comentario${r.total_registros === 1 ? "" : "s"}/incidencia${r.total_registros === 1 ? "" : "s"}`
                              : "Comentarios e incidencias"
                        }
                      >
                        <Group
                          gap="4" wrap="nowrap" style={{ cursor: "pointer", display: "inline-flex" }}
                          onClick={() => setDocRegistros({ id: idDocumento, idVersion: r.id_version, nombre: r.nombre })}
                        >
                          <ActionIcon variant="light" color={r.incidencias_abiertas > 0 ? "red" : "gray"}>
                            <IconMessageCircle size={15} stroke={1.8} />
                          </ActionIcon>
                          {r.total_registros > 0 && (
                            <Badge size="sm" circle variant="light" color={r.incidencias_abiertas > 0 ? "red" : "gray"}>
                              {r.incidencias_abiertas > 0 ? r.incidencias_abiertas : r.total_registros}
                            </Badge>
                          )}
                        </Group>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
              {resultados.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" py="md">
                      {q ? "Sin resultados." : "No hay ningún documento todavía."}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal
        opened={!!docRegistros}
        onClose={() => setDocRegistros(null)}
        title={docRegistros?.nombre}
        size="lg"
      >
        {docRegistros && (
          <RegistrosDocumento
            proyecto={proyecto}
            idDocumento={docRegistros.id}
            idVersion={docRegistros.idVersion}
            mostrarTitulo={false}
          />
        )}
      </Modal>
    </>
  )
}
