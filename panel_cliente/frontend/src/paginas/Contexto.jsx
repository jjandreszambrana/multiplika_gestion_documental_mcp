import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Stack, Switch, Text, Title, useComputedColorScheme } from "@mantine/core"
import { IconArrowLeft } from "@tabler/icons-react"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import { api } from "../api"

function CampoContexto({ titulo, ayuda, valorInicial, onGuardar }) {
  const [texto, setTexto] = useState(valorInicial || "")
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)
  const esquemaColor = useComputedColorScheme("light")

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
        <div data-color-mode={esquemaColor}>
          <MDEditor
            value={texto}
            onChange={(valor) => {
              setTexto(valor || "")
              setGuardado(false)
            }}
            height={220}
            preview="live"
          />
        </div>
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

// Apartados opcionales de esta GD: aquí y no en su propia pantalla, para que
// nadie los apague de un clic sin querer.
function Apartados({ proyecto, onCambiarModulo }) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Paper withBorder p="md" mb="lg">
      <Stack gap="xs">
        <Title order={4}>Apartados de esta gestión documental</Title>
        {error && <Alert color="red">{error}</Alert>}
        <Switch
          id="apartado-asesor-contable"
          label="Asesor contable"
          description="La IA trabaja como asesor contable y fiscal con su biblioteca, y cada usuario puede conectar su contabilidad del SIF."
          checked={!!proyecto.modulo_contable}
          disabled={guardando}
          onChange={(e) => {
            const activo = e.currentTarget.checked
            setGuardando(true)
            setError(null)
            api
              .actualizarModuloContable(proyecto.id, activo)
              .then(() => onCambiarModulo(activo))
              .catch((err) => setError(err.message))
              .finally(() => setGuardando(false))
          }}
        />
      </Stack>
    </Paper>
  )
}

export default function Contexto({ proyecto, onVolver, onCambiarModulo }) {
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
        Inicio
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
      <Apartados proyecto={proyecto} onCambiarModulo={onCambiarModulo} />
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
