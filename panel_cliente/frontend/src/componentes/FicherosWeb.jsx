import { useEffect, useState } from "react"
import { Alert, Anchor, Breadcrumbs, Button, Group, Paper, Stack, Table, Text, Textarea } from "@mantine/core"
import { IconFile, IconFolder } from "@tabler/icons-react"
import { api } from "../api"

// Archivos de una web hecha a medida (SFTP o Git). Editar crea una propuesta
// con el antes y el después; deshacer deja el archivo como estaba.
export default function FicherosWeb({ proyecto, activo, refresco, onPropuesta }) {
  const [ruta, setRuta] = useState(".")
  const [entradas, setEntradas] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [texto, setTexto] = useState("")
  const [error, setError] = useState(null)
  const puede = activo.nivel_permiso !== "lectura" && activo.estado !== "pausado"

  useEffect(() => {
    setEntradas(null)
    api.listarFicherosWeb(proyecto.id, activo.id, ruta).then(setEntradas).catch((err) => setError(err.message))
  }, [proyecto.id, activo.id, ruta, refresco])

  const unir = (n) => (ruta === "." ? n : `${ruta}/${n}`)

  async function abrir(nombre) {
    setError(null)
    try {
      const r = await api.leerFicheroWeb(proyecto.id, activo.id, unir(nombre))
      setAbierto(r)
      setTexto(r.contenido || "")
    } catch (err) {
      setError(err.message)
    }
  }

  async function proponer() {
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, activo.id, { operacion: "fichero_editar", datos: { ruta: abierto.ruta, contenido: texto } }))
    } catch (err) {
      setError(err.message)
    }
  }

  const partes = ruta === "." ? [] : ruta.split("/")
  return (
    <Stack gap="sm">
      <Text fz="13.5px" c="dimmed">
        {activo.modo_conexion === "git" ? "Archivos del repositorio de la web: cada cambio aprobado es un commit." : "Archivos de la web en su servidor (SFTP)."}
      </Text>
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      <Breadcrumbs>
        <Anchor fz="13px" onClick={() => { setRuta("."); setAbierto(null) }}>web</Anchor>
        {partes.map((p, i) => <Anchor key={i} fz="13px" onClick={() => { setRuta(partes.slice(0, i + 1).join("/")); setAbierto(null) }}>{p}</Anchor>)}
      </Breadcrumbs>
      {abierto ? (
        <Stack gap="xs">
          <Text fw={600} fz="13.5px">{abierto.ruta}</Text>
          <Textarea autosize minRows={10} maxRows={30} value={texto} onChange={(e) => setTexto(e.target.value)} readOnly={!puede}
            styles={{ input: { fontFamily: "monospace", fontSize: 12.5 } }} />
          <Group>
            <Button size="xs" variant="default" onClick={() => setAbierto(null)}>Volver</Button>
            {puede && <Button size="xs" onClick={proponer} disabled={texto === (abierto.contenido || "")}>Ver cómo quedaría</Button>}
          </Group>
        </Stack>
      ) : !entradas ? <Text fz="13px">Cargando...</Text> : (
        <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
          <Table fz="13px" verticalSpacing={4} highlightOnHover>
            <Table.Tbody>
              {entradas.map((e) => (
                <Table.Tr key={e.nombre} style={{ cursor: "pointer" }} onClick={() => (e.carpeta ? setRuta(unir(e.nombre)) : abrir(e.nombre))}>
                  <Table.Td w={30}>{e.carpeta ? <IconFolder size={15} /> : <IconFile size={15} />}</Table.Td>
                  <Table.Td>{e.nombre}</Table.Td>
                  <Table.Td w={100} align="right" c="dimmed">{e.carpeta ? "" : `${Math.ceil(e.tamano / 1024)} KB`}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  )
}
