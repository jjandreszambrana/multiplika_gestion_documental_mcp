import { useEffect, useState } from "react"
import { Alert, Anchor, Paper, Text } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
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
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Documentos
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
