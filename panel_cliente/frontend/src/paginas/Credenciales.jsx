import { useEffect, useState } from "react"
import { Alert, Anchor, Button, PasswordInput, Stack, Table, Text, TextInput, Title } from "@mantine/core"
import { api } from "../api"

export default function Credenciales({ proyecto, onVolver }) {
  const [credenciales, setCredenciales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [usuario, setUsuario] = useState("")
  const [valor, setValor] = useState("")
  const [creando, setCreando] = useState(false)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      setCredenciales(await api.listarCredenciales(proyecto.id))
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
      await api.crearCredencial(proyecto.id, nombre, descripcion, valor, usuario)
      setNombre("")
      setDescripcion("")
      setUsuario("")
      setValor("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(idCredencial) {
    if (!window.confirm("¿Eliminar esta credencial para siempre? No se puede deshacer.")) return
    setError(null)
    try {
      await api.eliminarCredencial(proyecto.id, idCredencial)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="md" display="block">
        ← Volver
      </Anchor>
      <Title order={2} mb="xs">
        Credenciales de {proyecto.nombre}
      </Title>
      <Text c="dimmed" mb="lg">
        Para que la IA pueda conectar con servicios externos. La contraseña/API key se guarda
        cifrada y no vuelve a mostrarse — la IA ve el nombre, para qué sirve y el usuario (si
        lleva), pero nunca la contraseña.
      </Text>

      <Stack component="form" onSubmit={crear} maw={480} mb="xl" autoComplete="off">
        <TextInput
          placeholder='Nombre corto (ej. "erp_contabilidad")'
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="off"
          required
        />
        <TextInput
          placeholder="Para qué sirve"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          autoComplete="off"
          required
        />
        {/* El navegador reconoce cualquier campo de texto + uno de
            contraseña como un formulario de login y ofrece autorrellenar
            con credenciales guardadas de OTRO sitio — esto es para
            credenciales de un servicio externo, no para entrar aquí.
            autoComplete="off"/"new-password" no lo bloquea al 100% en
            todos los navegadores, pero es lo que reconocen la mayoría. */}
        <TextInput
          placeholder="Usuario (opcional — solo si el servicio lo pide)"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        />
        <PasswordInput
          placeholder="Contraseña, API key o token"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
          required
        />
        <Button type="submit" loading={creando}>
          Guardar credencial
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
              <Table.Th>Para qué sirve</Table.Th>
              <Table.Th>Usuario</Table.Th>
              <Table.Th>Actualizada</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {credenciales.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.nombre}</Table.Td>
                <Table.Td>{c.descripcion}</Table.Td>
                <Table.Td>{c.usuario || "—"}</Table.Td>
                <Table.Td>{c.fecha_actualizacion}</Table.Td>
                <Table.Td>
                  <Anchor component="button" type="button" c="red" onClick={() => eliminar(c.id)}>
                    Eliminar
                  </Anchor>
                </Table.Td>
              </Table.Tr>
            ))}
            {credenciales.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>Este proyecto no tiene ninguna credencial todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  )
}
