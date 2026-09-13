import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Stack, Text } from "@mantine/core"
import { api } from "../api"
import { formatearFecha } from "../formato"

// Línea a línea, formato diff unificado (ver calcular_diff del core):
// "+" añadido, "-" quitado, el resto es contexto sin cambios.
function LineaDiff({ linea }) {
  const color = linea.startsWith("+") ? "teal" : linea.startsWith("-") ? "red" : "dimmed"
  return (
    <Text component="pre" size="sm" c={color} m={0} style={{ whiteSpace: "pre-wrap" }}>
      {linea}
    </Text>
  )
}

function RegistroHistorial({ proyecto, idDocumento, idVersion, registro, esElMasReciente, onRevertido }) {
  const [diff, setDiff] = useState(null)
  const [error, setError] = useState(null)
  const [revirtiendo, setRevirtiendo] = useState(false)

  function alternarDiff() {
    if (diff) {
      setDiff(null)
      return
    }
    api
      .obtenerDiffHistorial(proyecto.id, idDocumento, idVersion, registro.id)
      .then((r) => setDiff(r.diff))
      .catch((err) => setError(err.message))
  }

  async function revertir() {
    if (!confirm("¿Volver el documento al estado de justo antes de este cambio? Queda registrado como una edición más.")) {
      return
    }
    setRevirtiendo(true)
    setError(null)
    try {
      await api.revertirDocumento(proyecto.id, idDocumento, idVersion, registro.id)
      onRevertido()
    } catch (err) {
      setError(err.message)
    } finally {
      setRevirtiendo(false)
    }
  }

  return (
    <Paper withBorder p="sm">
      <Group justify="space-between">
        <Text size="sm">
          <b>{registro.usuario || "Usuario eliminado"}</b> — {formatearFecha(registro.fecha)}
          {esElMasReciente && (
            <Badge ml="xs" size="sm" variant="light">
              cambio más reciente
            </Badge>
          )}
        </Text>
        <Group gap="xs">
          <Anchor component="button" type="button" size="sm" onClick={alternarDiff}>
            {diff ? "Ocultar cambios" : "Ver cambios"}
          </Anchor>
          {proyecto.puede_editar && (
            <Button size="xs" variant="subtle" color="red" onClick={revertir} loading={revirtiendo}>
              Revertir a antes de este cambio
            </Button>
          )}
        </Group>
      </Group>
      {error && (
        <Alert color="red" mt="xs">
          {error}
        </Alert>
      )}
      {diff && (
        <Paper withBorder p="xs" mt="xs" bg="var(--mantine-color-gray-0)">
          {diff.length === 0 ? (
            <Text size="sm" c="dimmed">
              Sin diferencias de texto.
            </Text>
          ) : (
            diff.map((linea, i) => <LineaDiff key={i} linea={linea} />)
          )}
        </Paper>
      )}
    </Paper>
  )
}

export default function HistorialEdicion({ proyecto, idDocumento, idVersion, onRevertido }) {
  const [registros, setRegistros] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listarHistorialDocumento(proyecto.id, idDocumento, idVersion)
      .then(setRegistros)
      .catch((err) => setError(err.message))
  }, [proyecto.id, idDocumento, idVersion])

  if (error) return <Alert color="red">{error}</Alert>
  if (!registros) return <Text size="sm">Cargando historial...</Text>
  if (registros.length === 0) {
    return (
      <Text size="sm" c="dimmed" mt="md">
        Este documento no tiene ediciones confirmadas desde el panel todavía.
      </Text>
    )
  }

  return (
    <Stack mt="md" gap="xs">
      {registros.map((registro, i) => (
        <RegistroHistorial
          key={registro.id}
          proyecto={proyecto}
          idDocumento={idDocumento}
          idVersion={idVersion}
          registro={registro}
          esElMasReciente={i === 0}
          onRevertido={onRevertido}
        />
      ))}
    </Stack>
  )
}
