import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Button, Group, PasswordInput, Select, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"

const ID_ROL_ADMIN_TENANT = "2"
const ID_ROL_OPERADOR = "3"
const ID_ROL_INVITADO = "4"

const OPCIONES_ROL = [
  { value: "", label: "Sin acceso" },
  { value: ID_ROL_INVITADO, label: "Invitado (solo lectura)" },
  { value: ID_ROL_OPERADOR, label: "Operador" },
  { value: ID_ROL_ADMIN_TENANT, label: "Admin del proyecto" },
]

function FilaUsuario({ usuario, idRolActual, onCambiarRol, onGuardarUsuario }) {
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(usuario.nombre)
  const [email, setEmail] = useState(usuario.email)
  const [password, setPassword] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function cambiar(valor) {
    setCambiando(true)
    setError(null)
    try {
      await onCambiarRol(usuario.id, valor)
    } catch (err) {
      setError(err.message)
    } finally {
      setCambiando(false)
    }
  }

  function empezarEdicion() {
    setNombre(usuario.nombre)
    setEmail(usuario.email)
    setPassword("")
    setError(null)
    setEditando(true)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await onGuardarUsuario(usuario.id, nombre, email, password)
      setEditando(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (editando) {
    return (
      <Table.Tr>
        <Table.Td>
          <TextInput value={nombre} onChange={(e) => setNombre(e.target.value)} size="xs" required />
        </Table.Td>
        <Table.Td>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} size="xs" required />
        </Table.Td>
        <Table.Td colSpan={2}>
          <Group gap="xs" wrap="nowrap">
            <PasswordInput
              placeholder="Nueva contraseña (opcional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              size="xs"
              style={{ flex: 1 }}
            />
            <Button onClick={guardar} loading={guardando} size="xs">
              Guardar
            </Button>
            <Button onClick={() => setEditando(false)} variant="subtle" color="gray" size="xs">
              Cancelar
            </Button>
          </Group>
          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}
        </Table.Td>
      </Table.Tr>
    )
  }

  return (
    <Table.Tr>
      <Table.Td>{usuario.nombre}</Table.Td>
      <Table.Td>{usuario.email}</Table.Td>
      <Table.Td>
        <Select
          data={OPCIONES_ROL}
          value={idRolActual ?? ""}
          onChange={cambiar}
          disabled={cambiando}
          allowDeselect={false}
          w={200}
        />
        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Anchor component="button" type="button" size="sm" onClick={empezarEdicion}>
          Editar
        </Anchor>
      </Table.Td>
    </Table.Tr>
  )
}

export default function Usuarios({ proyecto, onVolver }) {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [creando, setCreando] = useState(false)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      const [listaUsuarios, listaRoles] = await Promise.all([
        api.listarUsuarios(proyecto.id_tenant, proyecto.id),
        api.listarRolesProyecto(proyecto.id),
      ])
      setUsuarios(listaUsuarios)
      setRoles(listaRoles)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [proyecto.id_tenant, proyecto.id])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      await api.crearUsuario(proyecto.id_tenant, proyecto.id, nombre, email, password)
      setNombre("")
      setEmail("")
      setPassword("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  async function cambiarRol(idUsuario, idRol) {
    if (idRol) {
      await api.asignarRol(proyecto.id, idUsuario, Number(idRol))
    } else {
      await api.quitarRol(proyecto.id, idUsuario)
    }
    await recargar()
  }

  async function guardarUsuario(idUsuario, nombreNuevo, emailNuevo, passwordNueva) {
    await api.actualizarUsuario(proyecto.id_tenant, proyecto.id, idUsuario, nombreNuevo, emailNuevo, passwordNueva)
    await recargar()
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
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="xs">
            Usuarios
          </Title>
          <Text c="dimmed">
            El rol que elijas aquí aplica solo a "{proyecto.nombre}" — un usuario puede tener un rol
            distinto en cada proyecto de tu empresa.
          </Text>
        </div>
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={cargando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack component="form" onSubmit={crear} maw={480} mb="xl">
        <TextInput
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <TextInput
          placeholder="Email de acceso"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordInput
          placeholder="Contraseña inicial"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Button type="submit" loading={creando}>
          Crear usuario
        </Button>
      </Stack>

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
              <Table.Th>Email</Table.Th>
              <Table.Th>Rol en {proyecto.nombre}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {usuarios.map((u) => {
              const asignacion = roles.find((r) => r.id_usuario === u.id)
              return (
                <FilaUsuario
                  key={u.id}
                  usuario={u}
                  idRolActual={asignacion ? String(asignacion.id_rol) : ""}
                  onCambiarRol={cambiarRol}
                  onGuardarUsuario={guardarUsuario}
                />
              )
            })}
            {usuarios.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>Tu empresa no tiene ningún usuario todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}
