import { useState } from "react"
import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from "@mantine/core"
import { api } from "../api"

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const { token } = await api.login(email, password)
      onLogin(token)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Center mih="100vh">
      <Paper component="form" onSubmit={enviar} withBorder shadow="sm" p="xl" w={320}>
        <Stack gap="md">
          <Title order={2} size="h3">
            Gestión documental
          </Title>
          <TextInput
            label="Usuario"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <PasswordInput
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <Alert color="red">{error}</Alert>}
          <Button type="submit" loading={enviando}>
            Entrar
          </Button>
        </Stack>
      </Paper>
    </Center>
  )
}
