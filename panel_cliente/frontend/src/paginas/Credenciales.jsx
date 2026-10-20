import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Button, Collapse, CopyButton, Group, Modal, PasswordInput, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconCheck, IconCopy, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

const CAMPOS_EXTRA_INICIALES = () => [{ nombre: "", valor: "" }, { nombre: "", valor: "" }, { nombre: "", valor: "" }]

export default function Credenciales({ proyecto, onVolver }) {
  const [credenciales, setCredenciales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [usuario, setUsuario] = useState("")
  const [valor, setValor] = useState("")
  const [creando, setCreando] = useState(false)
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false)
  const [camposExtra, setCamposExtra] = useState(CAMPOS_EXTRA_INICIALES)
  const [revelada, setRevelada] = useState(null)

  function cambiarCampoExtra(indice, clave, valorCampo) {
    setCamposExtra(camposExtra.map((c, i) => (i === indice ? { ...c, [clave]: valorCampo } : c)))
  }

  function quitarCampoExtra(indice) {
    setCamposExtra(camposExtra.filter((_, i) => i !== indice))
  }

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
      const camposValidos = camposExtra.filter((c) => c.nombre.trim() && c.valor.trim())
      await api.crearCredencial(proyecto.id, nombre, descripcion, valor, usuario, camposValidos)
      setNombre("")
      setDescripcion("")
      setUsuario("")
      setValor("")
      setCamposExtra(CAMPOS_EXTRA_INICIALES())
      setAvanzadoAbierto(false)
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

  async function revelar(credencial) {
    setError(null)
    try {
      setRevelada({ nombre: credencial.nombre, ...(await api.revelarCredencial(proyecto.id, credencial.id)) })
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
            Credenciales de {proyecto.nombre}
          </Title>
          <Text c="dimmed">
            Para que la IA pueda conectar con servicios externos. La contraseña/API key se guarda
            cifrada — la IA ve el nombre, para qué sirve y el usuario (si lleva), pero nunca la
            contraseña. Un administrador puede verla con «Ver contraseña», y queda apuntado en la
            actividad.
          </Text>
        </div>
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={cargando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

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
        <Anchor component="button" type="button" size="sm" onClick={() => setAvanzadoAbierto(!avanzadoAbierto)}>
          {avanzadoAbierto ? "Ocultar avanzado" : "Avanzado — varios secretos a la vez (OAuth...)"}
        </Anchor>
        <Collapse in={avanzadoAbierto}>
          <Stack gap="xs">
            <Text size="12.5px" c="dimmed">
              Para servicios con más de un secreto (p.ej. Application Key, Application Secret,
              Consumer Key) — pon el nombre que quieras a cada uno.
            </Text>
            {camposExtra.map((campo, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                <TextInput
                  placeholder="Nombre del campo (ej. Application Key)"
                  value={campo.nombre}
                  onChange={(e) => cambiarCampoExtra(i, "nombre", e.target.value)}
                  autoComplete="off"
                  style={{ flex: 1 }}
                />
                <PasswordInput
                  placeholder="Valor"
                  value={campo.valor}
                  onChange={(e) => cambiarCampoExtra(i, "valor", e.target.value)}
                  autoComplete="new-password"
                  data-1p-ignore
                  data-lpignore="true"
                  style={{ flex: 1 }}
                />
                <ActionIcon color="red" variant="subtle" onClick={() => quitarCampoExtra(i)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setCamposExtra([...camposExtra, { nombre: "", valor: "" }])}
              style={{ alignSelf: "flex-start" }}
            >
              Añadir otro campo
            </Button>
          </Stack>
        </Collapse>
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
              <Table.Th>Campos avanzados</Table.Th>
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
                <Table.Td>{c.campos_extra?.length > 0 ? c.campos_extra.join(", ") : "—"}</Table.Td>
                <Table.Td>{formatearFecha(c.fecha_actualizacion)}</Table.Td>
                <Table.Td>
                  <Group gap="md" wrap="nowrap">
                    <Anchor component="button" type="button" onClick={() => revelar(c)}>
                      Ver contraseña
                    </Anchor>
                    <Anchor component="button" type="button" c="red" onClick={() => eliminar(c.id)}>
                      Eliminar
                    </Anchor>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {credenciales.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>Este proyecto no tiene ninguna credencial todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={revelada !== null} onClose={() => setRevelada(null)} title={revelada?.nombre}>
        {revelada && (
          <Stack>
            {[["Usuario", revelada.usuario], ["Contraseña", revelada.valor]].map(([etiqueta, texto]) => (
              <TextInput
                key={etiqueta}
                label={etiqueta}
                value={texto || "—"}
                readOnly
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                rightSection={texto && (
                  <CopyButton value={texto}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Copiado" : "Copiar"}>
                        <ActionIcon variant="subtle" color={copied ? "teal" : "gray"} onClick={copy}>
                          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                )}
              />
            ))}
          </Stack>
        )}
      </Modal>
    </>
  )
}
