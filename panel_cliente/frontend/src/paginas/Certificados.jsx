import { useEffect, useState } from "react"
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  FileInput,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconDownload, IconHistory, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

export default function Certificados({ proyecto, onVolver }) {
  const [certificados, setCertificados] = useState([])
  const [entidades, setEntidades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [idEntidad, setIdEntidad] = useState(null)
  const [contrasena, setContrasena] = useState("")
  const [archivo, setArchivo] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [certificadoLog, setCertificadoLog] = useState(null)
  const [log, setLog] = useState([])
  const [cargandoLog, setCargandoLog] = useState(false)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      setCertificados(await api.listarCertificados(proyecto.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
    api.listarEntidades(proyecto.id).then(setEntidades).catch(() => setEntidades([]))
  }, [proyecto.id])

  async function crear(evento) {
    evento.preventDefault()
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      await api.subirCertificado(proyecto.id, {
        nombre, descripcion: descripcion || null, idEntidad, contrasena: contrasena || null, archivo,
      })
      setNombre("")
      setDescripcion("")
      setIdEntidad(null)
      setContrasena("")
      setArchivo(null)
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function eliminar(idCertificado) {
    if (!window.confirm("¿Eliminar este certificado para siempre? No se puede deshacer.")) return
    setError(null)
    try {
      await api.eliminarCertificado(proyecto.id, idCertificado)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function descargar(idCertificado) {
    setError(null)
    try {
      const { blob, nombreFichero } = await api.descargarCertificadoBlob(proyecto.id, idCertificado)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = nombreFichero
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  async function verLog(certificado) {
    setCertificadoLog(certificado)
    setCargandoLog(true)
    try {
      setLog(await api.listarLogCertificado(proyecto.id, certificado.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoLog(false)
    }
  }

  const opcionesEntidad = entidades.map((e) => ({ value: String(e.id), label: e.nombre }))

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
            Certificados de {proyecto.nombre}
          </Title>
          <Text c="dimmed">
            Certificados digitales de entidades (.p12/.pfx o .cer/.pem). El archivo y su
            contraseña se guardan cifrados; cada descarga queda registrada con quién y cuándo.
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
          placeholder='Nombre corto (ej. "Certificado FNMT 2026")'
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <Textarea
          placeholder="Nota opcional — para qué se usa"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          autosize minRows={1}
        />
        <Select
          placeholder="Entidad (opcional)"
          data={opcionesEntidad}
          value={idEntidad}
          onChange={setIdEntidad}
          searchable
          clearable
        />
        <FileInput
          placeholder="Archivo del certificado (.p12, .pfx, .cer, .pem)"
          value={archivo}
          onChange={setArchivo}
          accept=".p12,.pfx,.cer,.pem,.crt"
          required
        />
        <PasswordInput
          placeholder="Contraseña (solo si es .p12/.pfx protegido)"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
        />
        <Button type="submit" loading={subiendo}>
          Subir certificado
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
              <Table.Th>Titular</Table.Th>
              <Table.Th>NIF</Table.Th>
              <Table.Th>Entidad</Table.Th>
              <Table.Th>Caduca</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {certificados.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.nombre}</Table.Td>
                <Table.Td>{c.titular || "—"}</Table.Td>
                <Table.Td>{c.nif_titular || "—"}</Table.Td>
                <Table.Td>{opcionesEntidad.find((o) => o.value === String(c.id_entidad))?.label || "—"}</Table.Td>
                <Table.Td>{formatearFecha(c.fecha_caducidad)}</Table.Td>
                <Table.Td>
                  <Group gap="4" wrap="nowrap" justify="flex-end">
                    <Tooltip label="Descargar">
                      <ActionIcon variant="subtle" color="gray" onClick={() => descargar(c.id)}>
                        <IconDownload size={16} stroke={1.8} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Ver uso">
                      <ActionIcon variant="subtle" color="gray" onClick={() => verLog(c)}>
                        <IconHistory size={16} stroke={1.8} />
                      </ActionIcon>
                    </Tooltip>
                    <Anchor component="button" type="button" c="red" fz="13px" onClick={() => eliminar(c.id)}>
                      Eliminar
                    </Anchor>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {certificados.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>Este proyecto no tiene ningún certificado todavía.</Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={!!certificadoLog} onClose={() => setCertificadoLog(null)} title={`Uso de "${certificadoLog?.nombre}"`} size="lg">
        {cargandoLog ? (
          <Text>Cargando...</Text>
        ) : (
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Usuario</Table.Th>
                <Table.Th>Acción</Table.Th>
                <Table.Th>Fecha</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {log.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{l.usuario || "—"}</Table.Td>
                  <Table.Td>{l.accion}</Table.Td>
                  <Table.Td>{formatearFecha(l.fecha)}</Table.Td>
                </Table.Tr>
              ))}
              {log.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}>Todavía no se ha usado.</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Modal>
    </>
  )
}
