import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Table, Text, TextInput, Title } from "@mantine/core"
import { api } from "../api"

export default function Documentos({
  proyecto,
  onCambiarProyecto,
  onVerDocumento,
  onVerApiKeys,
  onVerCredenciales,
  onVerEstilos,
}) {
  const [q, setQ] = useState("")
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  async function cargar(consulta) {
    setCargando(true)
    setError(null)
    try {
      setResultados(await api.listarOBuscarDocumentos(proyecto.id, consulta))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar("")
  }, [proyecto.id])

  function buscar(evento) {
    evento.preventDefault()
    cargar(q)
  }

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
      </Group>

      <Group component="form" onSubmit={buscar} mb="lg">
        <TextInput
          placeholder="Buscar por contenido (déjalo vacío para ver todos)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button type="submit">Buscar</Button>
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
