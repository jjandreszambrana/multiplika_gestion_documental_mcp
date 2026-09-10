import { useEffect, useState } from "react"
import { Alert, Anchor, Button, Group, PasswordInput, Select, Stack, Text, TextInput, Title } from "@mantine/core"
import { api } from "../api"

const OPCIONES_SEGURIDAD = [
  { value: "starttls", label: "STARTTLS" },
  { value: "ssl", label: "SSL/TLS" },
  { value: "ninguna", label: "Ninguna" },
]

export default function CuentaCorreo({ proyecto, onVolver }) {
  const [direccion, setDireccion] = useState("")
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpSeguridad, setSmtpSeguridad] = useState("starttls")
  const [imapHost, setImapHost] = useState("")
  const [imapPort, setImapPort] = useState("993")
  const [imapSeguridad, setImapSeguridad] = useState("ssl")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    api.obtenerCuentaEmail(proyecto.id)
      .then((c) => {
        setDireccion(c.email_cuenta_direccion || "")
        setUsuario(c.email_cuenta_usuario || "")
        setSmtpHost(c.email_cuenta_smtp_host || "")
        setSmtpPort(String(c.email_cuenta_smtp_port || 587))
        setSmtpSeguridad(c.email_cuenta_smtp_seguridad || "starttls")
        setImapHost(c.email_cuenta_imap_host || "")
        setImapPort(String(c.email_cuenta_imap_port || 993))
        setImapSeguridad(c.email_cuenta_imap_seguridad || "ssl")
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [proyecto.id])

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      await api.actualizarCuentaEmail(proyecto.id, {
        direccion: direccion.trim() || null,
        usuario: usuario.trim() || null,
        password: password || null,
        smtp_host: smtpHost.trim() || null,
        smtp_port: smtpPort ? Number(smtpPort) : null,
        smtp_seguridad: smtpSeguridad,
        imap_host: imapHost.trim() || null,
        imap_port: imapPort ? Number(imapPort) : null,
        imap_seguridad: imapSeguridad,
      })
      setPassword("")
      setGuardado(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="md" display="block">
        ← Volver
      </Anchor>
      <Title order={2} mb="xs">
        Cuenta de correo de {proyecto.nombre}
      </Title>
      <Text c="dimmed" mb="lg">
        Vuestra propia cuenta de correo (no una compartida) — se usa para mandar los avisos de
        caducidad y para recibir documentos que nos reenviéis por email. La contraseña se guarda
        cifrada y no vuelve a mostrarse.
      </Text>

      {cargando ? (
        <Text>Cargando...</Text>
      ) : (
        <Stack component="form" onSubmit={guardar} maw={480} autoComplete="off">
          <TextInput
            label="Dirección de correo"
            placeholder="documentos@vuestraempresa.com"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            type="email"
            autoComplete="off"
          />
          <TextInput
            label="Usuario (opcional)"
            placeholder="Déjalo vacío si es igual que la dirección"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
          />
          <PasswordInput
            label="Contraseña"
            placeholder="Déjala vacía para no cambiarla"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
          />
          <Group align="flex-end">
            <TextInput
              label="Servidor SMTP (envío)"
              placeholder="smtp.vuestraempresa.com"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              autoComplete="off"
              style={{ flex: 1 }}
            />
            <TextInput
              label="Puerto"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              w={80}
            />
            <Select
              label="Seguridad"
              data={OPCIONES_SEGURIDAD}
              value={smtpSeguridad}
              onChange={(valor) => setSmtpSeguridad(valor || "starttls")}
              w={140}
              allowDeselect={false}
            />
          </Group>
          <Group align="flex-end">
            <TextInput
              label="Servidor IMAP (recepción)"
              placeholder="imap.vuestraempresa.com"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              autoComplete="off"
              style={{ flex: 1 }}
            />
            <TextInput
              label="Puerto"
              value={imapPort}
              onChange={(e) => setImapPort(e.target.value)}
              w={80}
            />
            <Select
              label="Seguridad"
              data={OPCIONES_SEGURIDAD}
              value={imapSeguridad}
              onChange={(valor) => setImapSeguridad(valor || "ssl")}
              w={140}
              allowDeselect={false}
            />
          </Group>
          <Button type="submit" loading={guardando}>
            Guardar
          </Button>
          {guardado && <Text c="green">Guardado.</Text>}
        </Stack>
      )}

      {error && (
        <Alert color="red" mt="md">
          {error}
        </Alert>
      )}
    </>
  )
}
