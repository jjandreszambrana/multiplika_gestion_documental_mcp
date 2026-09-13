import { useEffect, useState } from "react"
import { Alert, Anchor, Button, PasswordInput, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
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

function FilaUsuario({ usuario, idRolActual, onCambiarRol }) {
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState(null)

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
        Usuarios
      </Title>
      <Text c="dimmed" mb="lg">
        El rol que elijas aquí aplica solo a "{proyecto.nombre}" — un usuario puede tener un rol
        distinto en cada proyecto de tu empresa.
      </Text>

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
                />
              )
            })}
            {usuarios.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3}>Tu empresa no tiene ningún usuario todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}
