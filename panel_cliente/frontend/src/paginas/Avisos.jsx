import { useEffect, useState } from "react"
import { Alert, Anchor, Button, Stack, Text, TextInput, Title } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
import { api } from "../api"

export default function Avisos({ proyecto, onVolver }) {
  const [emailAvisos, setEmailAvisos] = useState("")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    api.obtenerConfiguracionAvisos(proyecto.id)
      .then((c) => setEmailAvisos(c.email_avisos || ""))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [proyecto.id])

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      await api.actualizarConfiguracionAvisos(proyecto.id, emailAvisos.trim())
      setGuardado(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
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
      <Title order={2} mb="xs">
        Avisos de caducidad de {proyecto.nombre}
      </Title>
      <Text c="dimmed" mb="lg">
        Cuando un documento tiene fecha de caducidad, cada día se revisa si hay alguno por caducar
        pronto. Si hay algo, se manda un único aviso por email a esta dirección (no se repite para
        el mismo documento). Déjalo vacío para desactivar el aviso.
      </Text>

      {cargando ? (
        <Text>Cargando...</Text>
      ) : (
        <Stack component="form" onSubmit={guardar} maw={480}>
          <TextInput
            label="Email de avisos"
            placeholder="quien-debe-enterarse@tuempresa.com"
            value={emailAvisos}
            onChange={(e) => setEmailAvisos(e.target.value)}
            type="email"
          />
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
