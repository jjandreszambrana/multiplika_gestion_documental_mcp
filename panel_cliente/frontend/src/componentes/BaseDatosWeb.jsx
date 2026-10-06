import { useEffect, useState } from "react"
import { Accordion, Alert, Button, Group, Modal, Paper, ScrollArea, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core"
import { IconPlayerPlay, IconPlus, IconTrash } from "@tabler/icons-react"
import { api } from "../api"

function Resultado({ datos }) {
  if (!datos) return null
  if (!datos.filas.length) return <Text c="dimmed" fz="13.5px">Sin resultados.</Text>
  const columnas = Object.keys(datos.filas[0])
  return (
    <Stack gap={4}>
      <ScrollArea type="auto">
        <Table striped withTableBorder fz="12.5px" verticalSpacing={4}>
          <Table.Thead><Table.Tr>{columnas.map((c) => <Table.Th key={c}>{c}</Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody>
            {datos.filas.map((f, i) => (
              <Table.Tr key={i}>{columnas.map((c) => <Table.Td key={c}>{f[c] === null ? <Text span c="dimmed" fz="12px">vacío</Text> : String(f[c])}</Table.Td>)}</Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Text fz="12px" c="dimmed">{datos.filas.length} fila(s){datos.cortado ? " (hay más: se muestran las primeras)" : ""}</Text>
    </Stack>
  )
}

// Base de datos de la empresa: consultas guardadas (un botón, sin saber SQL),
// consulta rápida para quien sepa SQL y las tablas. Solo lectura: los cambios
// los propone la IA y se aprueban en la pestaña Cambios.
export default function BaseDatosWeb({ proyecto, activo }) {
  const [consultas, setConsultas] = useState(null)
  const [esquema, setEsquema] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [titulo, setTitulo] = useState(null)
  const [ejecutando, setEjecutando] = useState(null)
  const [sql, setSql] = useState("")
  const [nueva, setNueva] = useState(null)
  const [error, setError] = useState(null)

  function cargar() {
    api.listarConsultasBd(proyecto.id, activo.id).then(setConsultas).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, activo.id])

  async function ejecutar(c) {
    setEjecutando(c ? c.id : "rapida")
    setError(null)
    try {
      const r = c ? await api.ejecutarConsultaBd(proyecto.id, c.id) : await api.consultarBd(proyecto.id, activo.id, sql)
      setResultado(r)
      setTitulo(c ? c.nombre : "Consulta rápida")
      if (c) cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEjecutando(null)
    }
  }

  async function guardar() {
    setError(null)
    try {
      await api.guardarConsultaBd(proyecto.id, activo.id, nueva)
      setNueva(null)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function borrar(c) {
    await api.borrarConsultaBd(proyecto.id, c.id)
    cargar()
  }

  return (
    <Stack gap="lg">
      <Text fz="13.5px" c="dimmed" maw={680}>
        Aquí solo se consulta (la base de datos no deja cambiar nada desde estas consultas). Para cambiar datos, pídeselo a tu IA:
        te enseñará qué filas cambian y cómo quedan, y se aprueba en la pestaña «Cambios».
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      <div>
        <Group justify="space-between" mb="xs">
          <Title order={5}>Consultas guardadas</Title>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setNueva({ nombre: "", descripcion: "", sql: "" })}>Nueva</Button>
        </Group>
        {!consultas ? <Text>Cargando...</Text> : consultas.length === 0 ? (
          <Text c="dimmed" fz="13.5px">Todavía no hay ninguna. Pídele a tu IA una pregunta («¿cuántos pedidos hubo este mes?») y que la guarde.</Text>
        ) : (
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <Table verticalSpacing="xs" fz="13.5px">
              <Table.Tbody>
                {consultas.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td><Text fz="13.5px" fw={500}>{c.nombre}</Text>{c.descripcion && <Text fz="12px" c="dimmed">{c.descripcion}</Text>}</Table.Td>
                    <Table.Td w={170} align="right">
                      <Group gap={4} justify="flex-end">
                        <Button size="compact-xs" leftSection={<IconPlayerPlay size={12} />} onClick={() => ejecutar(c)} loading={ejecutando === c.id}>Ejecutar</Button>
                        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => borrar(c)}><IconTrash size={13} /></Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </div>
      {resultado && (
        <div>
          <Title order={5} mb="xs">{titulo}</Title>
          <Resultado datos={resultado} />
        </div>
      )}
      <Accordion variant="separated">
        <Accordion.Item value="rapida">
          <Accordion.Control>Consulta rápida (SQL)</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Textarea autosize minRows={3} value={sql} onChange={(e) => setSql(e.target.value)} placeholder="SELECT ..." styles={{ input: { fontFamily: "monospace", fontSize: 12.5 } }} />
              <Group><Button size="xs" onClick={() => ejecutar(null)} loading={ejecutando === "rapida"} disabled={!sql.trim()}>Ejecutar</Button></Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="tablas">
          <Accordion.Control onClick={() => !esquema && api.esquemaBd(proyecto.id, activo.id).then(setEsquema).catch((err) => setError(err.message))}>
            Tablas
          </Accordion.Control>
          <Accordion.Panel>
            {!esquema ? <Text fz="13px">Cargando...</Text> : (
              <Stack gap={6}>
                {esquema.map((t) => (
                  <Text key={t.tabla} fz="12.5px">
                    <b>{t.tabla}</b>{t.filas_aprox != null && <Text span c="dimmed" fz="12px"> (~{t.filas_aprox} filas)</Text>}:{" "}
                    {t.columnas.map((c) => c.pk ? `${c.nombre} (clave)` : c.nombre).join(", ")}
                  </Text>
                ))}
              </Stack>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Modal opened={!!nueva} onClose={() => setNueva(null)} title={<Text fw={600}>Nueva consulta guardada</Text>} size="lg">
        {nueva && (
          <Stack gap="sm">
            <TextInput label="Nombre" placeholder="Pedidos del mes por provincia" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
            <TextInput label="Qué responde" value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} />
            <Textarea label="SQL (solo lectura)" autosize minRows={4} value={nueva.sql} onChange={(e) => setNueva({ ...nueva, sql: e.target.value })}
              styles={{ input: { fontFamily: "monospace", fontSize: 12.5 } }} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setNueva(null)}>Cancelar</Button>
              <Button onClick={guardar} disabled={!nueva.nombre.trim() || !nueva.sql.trim()}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
