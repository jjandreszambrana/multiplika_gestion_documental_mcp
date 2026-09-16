import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Code, CopyButton, Group, List, Table, Tabs, Text, TextInput, Title } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

export default function ApiKeys({ proyecto, onVolver }) {
  const [keys, setKeys] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombreNueva, setNombreNueva] = useState("")
  const [emitiendo, setEmitiendo] = useState(false)
  const [keyRecienEmitida, setKeyRecienEmitida] = useState(null)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      setKeys(await api.listarApiKeys(proyecto.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [proyecto.id])

  async function emitir(evento) {
    evento.preventDefault()
    setEmitiendo(true)
    setError(null)
    try {
      const nueva = await api.emitirApiKey(proyecto.id, nombreNueva)
      setKeyRecienEmitida(nueva.api_key)
      setNombreNueva("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEmitiendo(false)
    }
  }

  async function revocar(idApiKey) {
    setError(null)
    try {
      await api.revocarApiKey(idApiKey)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar(idApiKey) {
    if (!window.confirm("¿Eliminar esta key para siempre? No se puede deshacer.")) return
    setError(null)
    try {
      await api.eliminarApiKey(idApiKey)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Documentos
      </Anchor>
      <Title order={2} mb="xs">
        API keys de {proyecto.nombre}
      </Title>
      <Text c="dimmed" mb="lg">
        Cada key conecta un cliente MCP (por ejemplo, Claude Desktop) a este proyecto.
      </Text>

      <Group component="form" onSubmit={emitir} align="flex-end" mb="xl">
        <TextInput
          placeholder="Nombre para identificarla (opcional, ej. Claude Desktop de Juan)"
          value={nombreNueva}
          onChange={(e) => setNombreNueva(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button type="submit" loading={emitiendo}>
          Emitir API key nueva
        </Button>
      </Group>

      {keyRecienEmitida && (
        <Alert color="yellow" mb="md" title="Copia esta key ahora — no se puede volver a ver">
          <Group justify="space-between">
            <Text ff="monospace">{keyRecienEmitida}</Text>
            <CopyButton value={keyRecienEmitida}>
              {({ copied, copy }) => (
                <Button size="xs" variant="light" onClick={copy}>
                  {copied ? "Copiada" : "Copiar"}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Button size="xs" variant="subtle" mt="sm" onClick={() => setKeyRecienEmitida(null)}>
            Ya la copié
          </Button>
        </Alert>
      )}

      <Alert color="blue" mb="xl" title="Cómo conectar una API key en tu cliente de IA">
        <Tabs defaultValue="claude-desktop" mb="xs">
          <Tabs.List>
            <Tabs.Tab value="claude-desktop">Claude Desktop</Tabs.Tab>
            <Tabs.Tab value="claude-code">Claude Code</Tabs.Tab>
            <Tabs.Tab value="chatgpt">ChatGPT</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="claude-desktop" pt="sm">
            <Text size="sm" mb="xs">
              <b>Configuración → Conectores → Añadir conector personalizado</b> y completa:
            </Text>
            <List size="sm" spacing={4}>
              <List.Item>
                URL del servidor: <Text span ff="monospace">{`${window.location.origin}/mcp`}</Text>
              </List.Item>
              <List.Item>
                En "Autenticación", cambia la opción marcada por defecto ("Iniciar sesión ahora") a{" "}
                <b>"Sin inicio de sesión"</b> — si no, Claude intenta un login por OAuth que este servidor no
                soporta y falla con un error de registro, aunque pongas bien la cabecera de abajo.
              </List.Item>
              <List.Item>
                Ya con esa opción, añade la cabecera personalizada <Text span ff="monospace">x-api-key</Text> con
                el valor de tu API key.
              </List.Item>
            </List>
          </Tabs.Panel>

          <Tabs.Panel value="claude-code" pt="sm">
            <Text size="sm" mb="xs">
              Ejecuta esto en una terminal, sustituyendo <Text span ff="monospace">TU_CLAVE</Text>:
            </Text>
            <Code block>
              {`claude mcp add --transport http gestion-documental ${window.location.origin}/mcp --header "x-api-key: TU_CLAVE"`}
            </Code>
          </Tabs.Panel>

          <Tabs.Panel value="chatgpt" pt="sm">
            <List size="sm" spacing={4}>
              <List.Item>
                Activa primero el <b>modo desarrollador</b>: <b>Configuración → Conectores (o "Apps y
                conectores") → Avanzado → Developer mode</b>.
              </List.Item>
              <List.Item>
                <b>Conectores → Crear</b> (o "Añadir conector personalizado"): pon un nombre reconocible, la URL{" "}
                <Text span ff="monospace">{`${window.location.origin}/mcp`}</Text>, y en autenticación la opción
                de clave de API o cabecera personalizada — el nombre es <Text span ff="monospace">x-api-key</Text>{" "}
                y el valor tu API key.
              </List.Item>
            </List>
            <Text size="sm" c="dimmed" mt="xs">
              Sin el modo desarrollador activo, los formularios que se muestran al guardar un documento (nombre,
              tipo, fecha...) pueden no funcionar igual que en Claude.
            </Text>
          </Tabs.Panel>
        </Tabs>
        <Text size="sm" c="dimmed">
          Después puede que tengas que activar el conector para esa conversación. Si usas varios proyectos, crea
          un conector por cada uno con su propia key para no mezclarlos.
        </Text>
      </Alert>

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
              <Table.Th>Prefijo</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Emitida</Table.Th>
              <Table.Th></Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {keys.map((k) => (
              <Table.Tr key={k.id}>
                <Table.Td>{k.nombre || "—"}</Table.Td>
                <Table.Td>{k.prefijo}</Table.Td>
                <Table.Td>
                  <Badge color={k.estado ? "green" : "gray"} variant="light">
                    {k.estado ? "activa" : "revocada"}
                  </Badge>
                </Table.Td>
                <Table.Td>{formatearFecha(k.fecha_emision)}</Table.Td>
                <Table.Td>
                  {k.estado === 1 && (
                    <Anchor component="button" type="button" onClick={() => revocar(k.id)}>
                      Revocar
                    </Anchor>
                  )}
                </Table.Td>
                <Table.Td>
                  <Anchor component="button" type="button" c="red" onClick={() => eliminar(k.id)}>
                    Eliminar
                  </Anchor>
                </Table.Td>
              </Table.Tr>
            ))}
            {keys.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>Este proyecto no tiene ninguna API key todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}
