import { useEffect, useState } from "react"
import {
  Alert, Badge, Button, Checkbox, CopyButton, Group, Paper, SegmentedControl, Stack, Table, Text, Textarea, TextInput,
  Title, Tooltip,
} from "@mantine/core"
import { IconCheck, IconCopy, IconShare } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

const ESTADO_COLOR = { activo: "green", caducado: "gray", anulado: "red" }
const ESTADO_LABEL = { activo: "Activo", caducado: "Caducado", anulado: "Anulado" }

function BotonCopiar({ url, ...props }) {
  return (
    <CopyButton value={url}>
      {({ copied, copy }) => (
        <Button
          variant="light" onClick={copy} color={copied ? "green" : undefined}
          leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          {...props}
        >
          {copied ? "Copiado" : "Copiar enlace"}
        </Button>
      )}
    </CopyButton>
  )
}

function FilaCompartido({ proyecto, compartido, onCambiado }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  async function anular() {
    setCargando(true)
    setError(null)
    try {
      await api.anularCompartido(proyecto.id, compartido.id)
      await onCambiado()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Table.Tr>
      <Table.Td>
        <Text size="13px">{formatearFecha(compartido.fecha_creacion)}</Text>
        <Text size="11.5px" c="dimmed">{compartido.creado_por}</Text>
      </Table.Td>
      <Table.Td>
        {compartido.email_destino ? (
          <Tooltip label={compartido.error_email} disabled={!compartido.error_email}>
            <Text size="13px" c={compartido.estado_email === "fallido" ? "red" : undefined}>
              {compartido.email_destino}
              {compartido.estado_email === "fallido" && " (no se pudo mandar)"}
            </Text>
          </Tooltip>
        ) : (
          <Text size="13px" c="dimmed">Copiado a mano</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge color={ESTADO_COLOR[compartido.estado]} variant="light">
          {ESTADO_LABEL[compartido.estado]}
        </Badge>
        <Text size="11.5px" c="dimmed">
          {compartido.estado === "anulado" ? formatearFecha(compartido.fecha_anulacion) : `Hasta el ${formatearFecha(compartido.fecha_expiracion)}`}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="13px">
          PDF: {compartido.descargas_pdf}
          {compartido.incluir_original && ` · Original: ${compartido.descargas_original}`}
        </Text>
      </Table.Td>
      <Table.Td>
        {compartido.estado === "activo" && (
          <Group gap="8" wrap="nowrap">
            <BotonCopiar url={compartido.url} size="compact-xs" />
            {proyecto.puede_editar && (
              <Button size="compact-xs" variant="subtle" color="red" onClick={anular} loading={cargando}>
                Anular
              </Button>
            )}
          </Group>
        )}
        {error && (
          <Text size="11px" c="red">
            {error}
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  )
}

export default function CompartirDocumento({ proyecto, idDocumento, documento, refresco }) {
  const [compartidos, setCompartidos] = useState(null)
  const [error, setError] = useState(null)
  const [dias, setDias] = useState("7")
  const [incluirOriginal, setIncluirOriginal] = useState(false)
  const [email, setEmail] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [creando, setCreando] = useState(false)
  const [recienCreado, setRecienCreado] = useState(null)

  function recargar() {
    return api.listarCompartidos(proyecto.id, idDocumento).then(setCompartidos).catch((err) => setError(err.message))
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idDocumento, refresco])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      const creado = await api.crearCompartido(proyecto.id, idDocumento, {
        dias_validez: Number(dias),
        incluir_original: incluirOriginal,
        email_destino: email.trim() || null,
        mensaje: mensaje.trim() || null,
      })
      setRecienCreado(creado)
      setEmail("")
      setMensaje("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={4} fz="16px" mb="6">
          Compartir por enlace
        </Title>
        <Text size="12.5px" c="dimmed" maw={620}>
          Crea un enlace para que alguien de fuera, sin cuenta, descargue este documento en PDF. El PDF se genera ahora y
          queda fijo: si corriges el documento después, quien abra el enlace seguirá viendo esta versión. Cualquiera que
          tenga el enlace puede descargarlo mientras no caduque o lo anules.
        </Text>
      </div>

      {proyecto.puede_editar && !documento.archivado && (
        <form onSubmit={crear}>
          <Stack gap="10" maw={520}>
            <div>
              <Text size="13px" fw={500} mb="4">
                Válido durante
              </Text>
              <SegmentedControl
                value={dias} onChange={setDias}
                data={[{ value: "7", label: "7 días" }, { value: "30", label: "30 días" }, { value: "90", label: "90 días" }]}
              />
            </div>
            {documento.archivo_original_nombre && (
              <Checkbox
                label={`Permitir descargar también el archivo original (${documento.archivo_original_nombre})`}
                checked={incluirOriginal} onChange={(e) => setIncluirOriginal(e.currentTarget.checked)}
              />
            )}
            <TextInput
              label="Mandar por email a (opcional)"
              description="Si lo dejas vacío, solo se crea el enlace para que lo copies y lo mandes tú."
              type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)}
            />
            {email.trim() && (
              <Textarea
                label="Mensaje (opcional)" autosize minRows={2}
                value={mensaje} onChange={(e) => setMensaje(e.currentTarget.value)}
              />
            )}
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={creando} leftSection={<IconShare size={15} stroke={1.8} />} style={{ alignSelf: "flex-start" }}>
              {email.trim() ? "Crear enlace y mandarlo" : "Crear enlace"}
            </Button>
          </Stack>
        </form>
      )}
      {documento.archivado && (
        <Text size="12.5px" c="dimmed">
          Este documento está archivado: desarchívalo para poder compartirlo.
        </Text>
      )}

      {recienCreado && (
        <Paper withBorder radius="lg" p="16">
          <Text size="13px" fw={600} mb="6">
            Enlace creado
          </Text>
          {recienCreado.email_destino && recienCreado.estado_email === "enviado" && (
            <Text size="13px" c="green" mb="6">
              Mandado a {recienCreado.email_destino}.
            </Text>
          )}
          {recienCreado.estado_email === "fallido" && (
            <Alert color="orange" mb="8">
              No se pudo mandar el email ({recienCreado.error_email}). El enlace sí está creado: cópialo y mándalo tú.
            </Alert>
          )}
          <Group gap="8" wrap="nowrap">
            <TextInput value={recienCreado.url} readOnly style={{ flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
            <BotonCopiar url={recienCreado.url} />
          </Group>
        </Paper>
      )}

      <div>
        <Title order={4} fz="16px" mb="10">
          Enlaces creados
        </Title>
        {!compartidos ? (
          <Text c="dimmed">Cargando...</Text>
        ) : compartidos.length === 0 ? (
          <Text c="dimmed">Todavía no se ha compartido este documento.</Text>
        ) : (
          <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Creado</Table.Th>
                  <Table.Th>Destinatario</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Descargas</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {compartidos.map((c) => (
                  <FilaCompartido key={c.id} proyecto={proyecto} compartido={c} onCambiado={recargar} />
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </div>
    </Stack>
  )
}
