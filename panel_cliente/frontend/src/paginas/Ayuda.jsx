import { useEffect, useState } from "react"
import { Alert, Anchor, Paper, Text } from "@mantine/core"
import { api } from "../api"
import Markdown from "../componentes/Markdown"

export default function Ayuda({ onVolver }) {
  const [markdown, setMarkdown] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .obtenerAyuda()
      .then((r) => setMarkdown(r.markdown))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="md" display="block">
        ← Documentos
      </Anchor>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!markdown && !error && <Text>Cargando...</Text>}

      {markdown && (
        <Paper withBorder p="lg">
          <Markdown>{markdown}</Markdown>
        </Paper>
      )}
    </>
  )
}
