import { Alert, Button, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { textoDeError } from '../../api/errores'
import { iniciarSesion } from '../../api/sesion'

interface Props {
  /** Se llama cuando la cookie de sesión ya está puesta. */
  alEntrar: () => void
}

export default function PantallaLogin({ alEntrar }: Props) {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setEntrando(true)
    try {
      await iniciarSesion(usuario, contrasena)
      alEntrar()
    } catch (fallo) {
      setError(textoDeError(fallo))
      setEntrando(false)
    }
  }

  return (
    <Paper withBorder shadow="sm" p="xl" maw={380} mx="auto" mt="15vh">
      <form onSubmit={enviar}>
        <Stack gap="md">
          <Title order={3}>Contabilidad</Title>

          {error && (
            <Alert color="red" role="alert" title="No se pudo entrar">
              {error}
            </Alert>
          )}

          <TextInput
            label="Usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.currentTarget.value)}
            autoFocus
            required
            autoComplete="username"
          />
          <PasswordInput
            label="Contraseña"
            value={contrasena}
            onChange={(e) => setContrasena(e.currentTarget.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" loading={entrando}>
            Entrar
          </Button>
        </Stack>
      </form>
    </Paper>
  )
}
