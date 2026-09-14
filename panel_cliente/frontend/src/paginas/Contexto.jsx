import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Box, Button, Group, Paper, Stack, Tabs, Text, Textarea, Title } from "@mantine/core"
import { IconArrowLeft, IconEdit, IconEye } from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"

function CampoContexto({ titulo, ayuda, valorInicial, onGuardar }) {
  const [texto, setTexto] = useState(valorInicial || "")
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)
    try {
      await onGuardar(texto)
      setGuardado(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Paper component="form" onSubmit={guardar} withBorder p="lg" mb="lg">
      <Stack gap="sm">
        <Title order={4}>{titulo}</Title>
        <Text c="dimmed" size="sm">
          {ayuda}
        </Text>
        <Tabs defaultValue="editar" radius="lg">
          <Tabs.List>
            <Tabs.Tab value="editar" leftSection={<IconEdit size={14} stroke={1.8} />}>
              Editar
            </Tabs.Tab>
            <Tabs.Tab value="preview" leftSection={<IconEye size={14} stroke={1.8} />}>
              Vista previa
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="editar" pt="sm">
            <Textarea
              rows={7}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setGuardado(false)
              }}
              styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: "13px", lineHeight: 1.7 } }}
            />
            <Text size="11px" c="dimmed" mt="4">
              Admite formato markdown (negrita, listas, títulos...).
            </Text>
          </Tabs.Panel>
          <Tabs.Panel value="preview" pt="sm">
            <Box p="md" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-lg)", minHeight: 154 }}>
              {texto ? <Markdown>{texto}</Markdown> : <Text c="dimmed" size="sm">Nada que previsualizar todavía.</Text>}
            </Box>
          </Tabs.Panel>
        </Tabs>
        <Group gap="sm">
          <Button type="submit" loading={guardando}>
            Guardar
          </Button>
          {guardado && (
            <Badge color="green" variant="light">
              ✓ Guardado
            </Badge>
          )}
        </Group>
        {error && <Alert color="red">{error}</Alert>}
      </Stack>
    </Paper>
  )
}

export default function Contexto({ proyecto, onVolver }) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    api
      .obtenerContextoNegocio(proyecto.id)
      .then(setDatos)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [proyecto.id])

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
      <Title order={2} mb="xs">
        Contexto de negocio
      </Title>
      <Text c="dimmed" mb="lg">
        Esto es lo que lee la IA en cuanto se conecta a este proyecto — cuéntale a qué se dedica
        tu empresa para que sepa cómo ayudarte con los documentos.
      </Text>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {cargando ? (
        <Text>Cargando...</Text>
      ) : (
        <>
          <CampoContexto
            titulo="Negocio"
            ayuda="Qué es tu empresa y a qué se dedica (p. ej. una asesoría fiscal, un despacho de arquitectura)."
            valorInicial={datos.descripcion}
            onGuardar={(texto) => api.actualizarContextoNegocio(proyecto.id, texto)}
          />
          <CampoContexto
            titulo="Preferencias de trabajo"
            ayuda="Cómo debe comportarse la IA contigo: tono, prioridades, cosas a evitar."
            valorInicial={datos.preferencias_trabajo}
            onGuardar={(texto) => api.actualizarPreferenciasNegocio(proyecto.id, texto)}
          />
        </>
      )}
    </>
  )
}
