import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Code, CopyButton, Group, List, Select, Table, Tabs, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

// ids de mcpc_roles que puede tener una key (ver lib/roles_proyecto.py::ROLES_API_KEY del core)
const ID_ROL_OPERADOR = "3"
const ROLES_API_KEY = [
  { value: ID_ROL_OPERADOR, label: "Lectura y escritura" },
  { value: "4", label: "Solo lectura" },
  { value: "5", label: "GD enlazada (otra gestión documental que consulta esta)" },
]

// De quién es la key: siempre de una persona (salvo la de GD enlazada), que
// ve con ella también lo suyo — sus accesos al SIF, sus notas privadas.
const ID_ROL_GD_ENLAZADA = "5"

// El nombre es lo ÚNICO por lo que se puede reconocer una key una vez
// emitida (el valor no se vuelve a enseñar y el prefijo no dice nada), así
// que además de pedirlo al emitirla se puede cambiar aquí mismo — las keys
// emitidas antes de que fuera obligatorio salen marcadas "Sin nombre".
function NombreEditable({ apiKey, onGuardado, onError }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(apiKey.nombre || "")
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    try {
      await api.renombrarApiKey(apiKey.id, valor.trim())
      setEditando(false)
      await onGuardado()
    } catch (err) {
      onError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!editando) {
    return (
      <Group gap="xs" wrap="nowrap">
        {apiKey.nombre ? <Text fw={500}>{apiKey.nombre}</Text> : <Text c="orange">Sin nombre</Text>}
        <Anchor
          component="button" type="button" fz="12px"
          onClick={() => {
            setValor(apiKey.nombre || "")
            setEditando(true)
          }}
        >
          {apiKey.nombre ? "Renombrar" : "Poner nombre"}
        </Anchor>
      </Group>
    )
  }

  return (
    <Group component="form" onSubmit={guardar} gap="xs" wrap="nowrap">
      <TextInput
        aria-label="Nombre de la API key"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        size="xs"
        required
        autoFocus
      />
      <Button type="submit" size="compact-sm" loading={guardando}>
        Guardar
      </Button>
      <Anchor component="button" type="button" fz="12px" c="dimmed" onClick={() => setEditando(false)}>
        Cancelar
      </Anchor>
    </Group>
  )
}

export default function ApiKeys({ proyecto, onVolver }) {
  const [keys, setKeys] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombreNueva, setNombreNueva] = useState("")
  const [idRolNueva, setIdRolNueva] = useState(ID_ROL_OPERADOR)
  const [personas, setPersonas] = useState([])
  const [idUsuarioNueva, setIdUsuarioNueva] = useState(null)
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
    api.listarUsuariosProyecto(proyecto.id).then(setPersonas).catch(() => setPersonas([]))
  }, [proyecto.id])

  async function emitir(evento) {
    evento.preventDefault()
    setEmitiendo(true)
    setError(null)
    try {
      const idUsuario = idRolNueva === ID_ROL_GD_ENLAZADA || !idUsuarioNueva ? null : Number(idUsuarioNueva)
      const nueva = await api.emitirApiKey(proyecto.id, nombreNueva.trim(), Number(idRolNueva), idUsuario)
      setKeyRecienEmitida(nueva.api_key)
      setNombreNueva("")
      setIdUsuarioNueva(null)
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
        Inicio
      </Anchor>
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="xs">
            API keys de {proyecto.nombre}
          </Title>
          <Text c="dimmed">
            Cada key conecta un cliente MCP (por ejemplo, Claude Desktop) a este proyecto.
          </Text>
        </div>
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={cargando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group component="form" onSubmit={emitir} align="flex-end" mb="xl">
        <TextInput
          aria-label="Nombre de la API key"
          label="Nombre con el que la reconocerás"
          placeholder="Ej. Claude Desktop de Juan"
          value={nombreNueva}
          onChange={(e) => setNombreNueva(e.target.value)}
          required
          style={{ flex: 1 }}
        />
        <Select
          aria-label="Permisos de la key"
          data={ROLES_API_KEY}
          value={idRolNueva}
          onChange={setIdRolNueva}
          allowDeselect={false}
        />
        {idRolNueva !== ID_ROL_GD_ENLAZADA && (
          <Select
            aria-label="De quién es la key"
            data={personas.map((p) => ({ value: String(p.id), label: p.nombre }))}
            placeholder="De quién es"
            required
            value={idUsuarioNueva}
            onChange={setIdUsuarioNueva}
            allowDeselect={false}
          />
        )}
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
              <Table.Th>Permisos</Table.Th>
              <Table.Th>De quién es</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Emitida</Table.Th>
              <Table.Th></Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {keys.map((k) => (
              <Table.Tr key={k.id}>
                <Table.Td>
                  <NombreEditable apiKey={k} onGuardado={recargar} onError={setError} />
                </Table.Td>
                <Table.Td>{k.prefijo}</Table.Td>
                <Table.Td>{ROLES_API_KEY.find((r) => r.value === String(k.id_rol))?.label}</Table.Td>
                <Table.Td>{k.id_usuario ? k.nombre_usuario || `Usuario n.º ${k.id_usuario}` : "De todos"}</Table.Td>
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
                <Table.Td colSpan={8}>Este proyecto no tiene ninguna API key todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}
