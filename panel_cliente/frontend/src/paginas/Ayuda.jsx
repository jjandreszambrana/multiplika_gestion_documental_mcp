import { useEffect, useState } from "react"
import { Alert, Anchor, Grid, NavLink, Paper, Text, Title } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import { ALTO_INDICE } from "../theme"

export default function Ayuda({ onVolver }) {
  const [secciones, setSecciones] = useState(null)
  const [idActual, setIdActual] = useState(null)
  const [seccion, setSeccion] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .obtenerAyuda()
      .then((r) => {
        setSecciones(r.secciones)
        setIdActual(r.secciones[0]?.id ?? null)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!idActual) return
    setSeccion(null)
    api
      .obtenerSeccionAyuda(idActual)
      .then(setSeccion)
      .catch((err) => setError(err.message))
  }, [idActual])

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

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!secciones && !error && <Text>Cargando...</Text>}

      {secciones && (
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="xs" mah={ALTO_INDICE} style={{ overflowY: "auto" }}>
              {secciones.map((s) => (
                <NavLink
                  key={s.id}
                  label={s.titulo}
                  description={s.resumen}
                  active={s.id === idActual}
                  onClick={() => setIdActual(s.id)}
                  styles={{ root: { borderRadius: "var(--mantine-radius-md)" } }}
                />
              ))}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="lg">
              {!seccion ? (
                <Text>Cargando...</Text>
              ) : (
                <>
                  <Title order={2} mb="md">
                    {seccion.titulo}
                  </Title>
                  <Markdown>{seccion.markdown}</Markdown>
                </>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
      )}
    </>
  )
}
