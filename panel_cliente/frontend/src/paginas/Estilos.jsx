import { useEffect, useState } from "react"
import { Alert, Anchor, Button, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core"
import { api } from "../api"

export default function Estilos({ proyecto, onVolver, onVerEstilo }) {
  const [estilos, setEstilos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombreTipo, setNombreTipo] = useState("")
  const [instrucciones, setInstrucciones] = useState("")
  const [creando, setCreando] = useState(false)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      setEstilos(await api.listarEstilos(proyecto.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [proyecto.id])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      await api.crearEstilo(proyecto.id, nombreTipo, instrucciones)
      setNombreTipo("")
      setInstrucciones("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="md" display="block">
        ← Volver
      </Anchor>
      <Title order={2} mb="xs">
        Estilos de informe de {proyecto.nombre}
      </Title>
      <Text c="dimmed" mb="lg">
        Cómo debe construir la IA cada tipo de informe, y qué imágenes fijas debe usar.
      </Text>

      {proyecto.es_admin && (
        <Stack component="form" onSubmit={crear} maw={480} mb="xl">
          <TextInput
            placeholder='Tipo de informe (ej. "informe_mensual")'
            value={nombreTipo}
            onChange={(e) => setNombreTipo(e.target.value)}
            required
          />
          <Textarea
            placeholder="Instrucciones: estructura, tono, qué apartados lleva..."
            rows={4}
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            required
          />
          <Button type="submit" loading={creando}>
            Crear estilo
          </Button>
        </Stack>
      )}

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
              <Table.Th>Tipo de informe</Table.Th>
              <Table.Th>Actualizado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {estilos.map((e) => (
              <Table.Tr key={e.id} onClick={() => onVerEstilo(e)} style={{ cursor: "pointer" }}>
                <Table.Td>{e.nombre_tipo}</Table.Td>
                <Table.Td>{e.fecha_actualizacion}</Table.Td>
              </Table.Tr>
            ))}
            {estilos.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={2}>Este proyecto no tiene ningún estilo de informe todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}
