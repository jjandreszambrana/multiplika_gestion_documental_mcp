import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, FileButton, Group, Select, Table, Text, TextInput, Title } from "@mantine/core"
import { api } from "../api"

export default function Documentos({
  proyecto,
  onCambiarProyecto,
  onVerDocumento,
  onVerApiKeys,
  onVerCredenciales,
  onVerEstilos,
  onVerUsuarios,
  onVerAvisos,
  onVerCuentaEmail,
}) {
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

  useEffect(() => {
    api.listarTiposDocumento(proyecto.id)
      .then((tipos) => setTiposDocumento(tipos.map((t) => ({ value: t.nombre, label: t.nombre }))))
      .catch(() => setTiposDocumento([]))
  }, [proyecto.id])

  async function cargarPendientes() {
    try {
      setPendientes(await api.listarDocumentosPendientes(proyecto.id))
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

  function aplicarFiltros(evento) {
    evento.preventDefault()
    setQ("")
    cargar("", { tipoDocumento, fechaDesde, fechaHasta })
  }

  function limpiarFiltros() {
    setTipoDocumento("")
    setFechaDesde("")
    setFechaHasta("")
    cargar("")
  }

  const hayFiltros = tipoDocumento || fechaDesde || fechaHasta

  return (
    <>
      <Title order={2} mb="md">
        {proyecto.nombre}
      </Title>
      {onCambiarProyecto && (
        <Anchor component="button" type="button" onClick={onCambiarProyecto} mb="md" display="block">
          ← Cambiar de proyecto
        </Anchor>
      )}

      <Group mb="lg">
        {onVerApiKeys && <Button variant="light" onClick={onVerApiKeys}>API keys</Button>}
        {onVerCredenciales && <Button variant="light" onClick={onVerCredenciales}>Credenciales</Button>}
        {onVerEstilos && <Button variant="light" onClick={onVerEstilos}>Estilos de informe</Button>}
        {onVerUsuarios && <Button variant="light" onClick={onVerUsuarios}>Usuarios</Button>}
        {onVerAvisos && <Button variant="light" onClick={onVerAvisos}>Avisos de caducidad</Button>}
        {onVerCuentaEmail && <Button variant="light" onClick={onVerCuentaEmail}>Cuenta de correo</Button>}
      </Group>

      <Group mb="lg" align="center">
        <FileButton onChange={subirPendientes} multiple>
          {(props) => (
            <Button {...props} variant="light" loading={subiendo}>
              Subir documentos
            </Button>
          )}
        </FileButton>
        <Text c="dimmed" size="sm">
          Se suben a la cola de pendientes: tu IA los procesará la próxima vez que hables con ella
          (te preguntará el tipo, el nombre...), no aparecen todavía en el listado de abajo.
        </Text>
      </Group>

      {errorPendientes && (
        <Alert color="red" mb="md" onClose={() => setErrorPendientes(null)} withCloseButton>
          {errorPendientes}
        </Alert>
      )}

      {pendientes.length > 0 && (
        <Table striped withTableBorder mb="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Documento pendiente</Table.Th>
              <Table.Th>Origen</Table.Th>
              <Table.Th>Fecha de alta</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pendientes.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>{p.nombre_original}</Table.Td>
                <Table.Td>{p.origen === "email" ? "Email" : "Panel"}</Table.Td>
                <Table.Td>{p.fecha_alta}</Table.Td>
                <Table.Td>
                  <Button variant="subtle" color="red" size="xs" onClick={() => descartarPendiente(p.id)}>
                    Descartar
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Group component="form" onSubmit={buscar} mb="sm">
        <TextInput
          placeholder="Buscar por contenido (déjalo vacío para ver todos)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button type="submit">Buscar</Button>
      </Group>

      <Group component="form" onSubmit={aplicarFiltros} mb="lg" align="flex-end">
        <Select
          placeholder="Tipo de documento"
          data={tiposDocumento}
          value={tipoDocumento}
          onChange={(valor) => setTipoDocumento(valor || "")}
          searchable
          clearable
          w={180}
        />
        <TextInput
          label="Desde"
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
        />
        <TextInput
          label="Hasta"
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
        />
        <Button type="submit" variant="light">
          Filtrar
        </Button>
        {hayFiltros && (
          <Button variant="subtle" onClick={limpiarFiltros}>
            Quitar filtros
          </Button>
        )}
      </Group>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {cargando ? (
        <Text>Cargando...</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>{q ? "Fragmento" : "Fecha de alta"}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resultados.map((r) => {
              const idDocumento = r.id ?? r.id_documento
              return (
                <Table.Tr
                  key={`${idDocumento}-${r.id_version ?? ""}`}
                  onClick={() => onVerDocumento(idDocumento)}
                  style={{ cursor: "pointer", opacity: r.archivado ? 0.6 : 1 }}
                >
                  <Table.Td>
                    {r.nombre}
                    {r.archivado && (
                      <Badge ml="sm" color="gray" variant="light">
                        🗄 Archivado
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{r.tipo_documento}</Table.Td>
                  <Table.Td>
                    {q ? (
                      <Text c="dimmed" size="sm">
                        {r.fragmento}
                      </Text>
                    ) : (
                      r.fecha_alta
                    )}
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {resultados.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>{q ? "Sin resultados." : "No hay ningún documento todavía."}</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}
