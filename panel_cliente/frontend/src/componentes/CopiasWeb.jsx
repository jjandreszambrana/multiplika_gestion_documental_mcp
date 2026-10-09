import { useEffect, useState } from "react"
import { Alert, Button, Group, Paper, Stack, Table, Text, Title } from "@mantine/core"
import { IconDatabaseExport } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

function tamano(bytes) {
  if (bytes == null) return "?"
  const mb = bytes / 1024 / 1024
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

// Copias de seguridad de una web con el conector instalado: las del propio
// servidor y las del remoto. Restaurar es una propuesta más (vista previa y
// aprobación), y se puede deshacer volviendo a la copia que se hace antes.
export default function CopiasWeb({ proyecto, activo, refresco, onPropuesta }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [haciendo, setHaciendo] = useState(false)
  const puedeProponer = activo.nivel_permiso !== "lectura" && activo.estado !== "pausado"

  function cargar() {
    api.listarCopiasWeb(proyecto.id, activo.id).then(setDatos).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, activo.id, refresco])

  async function hacer() {
    setHaciendo(true)
    setError(null)
    try {
      await api.hacerCopiaWeb(proyecto.id, activo.id)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setHaciendo(false)
    }
  }

  async function restaurar(nombre) {
    setError(null)
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, activo.id, { operacion: "wp_restaurar_copia", datos: { nombre } }))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!datos) return error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>
  const ajustes = activo.ajustes || {}

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Text fz="13.5px" c="dimmed" maw={640}>
          {ajustes.copias_hacer
            ? `Se hace una copia cada ${ajustes.copias_cada_horas} h${ajustes.copias_credencial_remota ? " y se sube al servidor remoto" : ""}. `
            : "Las copias automáticas están desactivadas (se activan en «Datos y ajustes»). "}
          Se guardan en el espacio del cliente, nunca en servidores de Multiplika. Libre en el servidor de la web: {tamano(datos.espacio_libre)}.
        </Text>
        <Button leftSection={<IconDatabaseExport size={16} />} onClick={hacer} loading={haciendo}>Hacer copia ahora</Button>
      </Group>
      {haciendo && <Text fz="13px" c="dimmed">Haciendo la copia: puede tardar unos minutos en webs grandes.</Text>}
      {error && <Alert color="red">{error}</Alert>}
      {!ajustes.copias_credencial_remota && datos.copias.length > 0 && (
        <Alert color="yellow">
          Solo hay copias en el propio servidor de la web: si el servidor se estropea o lo hackean, se pierden la web y las copias
          a la vez. Conviene configurar también un servidor remoto en los ajustes.
        </Alert>
      )}
      <div>
        <Title order={5} mb="xs">En el servidor de la web</Title>
        {datos.copias.length === 0 ? (
          <Text c="dimmed" fz="13.5px">Ninguna.</Text>
        ) : (
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <Table striped verticalSpacing="xs" fz="13.5px">
              <Table.Tbody>
                {datos.copias.map((c) => (
                  <Table.Tr key={c.nombre}>
                    <Table.Td>{formatearFecha(c.fecha)}</Table.Td>
                    <Table.Td>{tamano(c.tamano)}</Table.Td>
                    <Table.Td align="right">
                      {puedeProponer && (
                        <Button size="compact-xs" variant="light" color="orange" onClick={() => restaurar(c.nombre)}>Restaurar…</Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </div>
      {(datos.remotas || datos.error_remoto) && (
        <div>
          <Title order={5} mb="xs">En el servidor remoto</Title>
          {datos.error_remoto ? (
            <Alert color="red">No se puede entrar en el servidor remoto: {datos.error_remoto}</Alert>
          ) : datos.remotas.length === 0 ? (
            <Text c="dimmed" fz="13.5px">Ninguna todavía.</Text>
          ) : (
            <Table striped verticalSpacing="xs" fz="13.5px">
              <Table.Tbody>
                {datos.remotas.map((c) => (
                  <Table.Tr key={c.nombre}>
                    <Table.Td>{formatearFecha(new Date(c.fecha * 1000).toISOString())}</Table.Td>
                    <Table.Td>{tamano(c.tamano)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          <Text fz="12px" c="dimmed" mt={4}>
            Para restaurar una copia del servidor remoto, súbela antes a la carpeta wp-content/multiplika-copias de la web.
          </Text>
        </div>
      )}
    </Stack>
  )
}
