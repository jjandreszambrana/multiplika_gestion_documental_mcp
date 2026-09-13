import { useEffect, useState } from "react"
import { Alert, Anchor, Avatar, Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core"
import { IconArrowBackUp, IconEye, IconEyeOff } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

function iniciales(nombre) {
  if (!nombre) return "?"
  const partes = nombre.trim().split(/\s+/)
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase()
}

// Línea a línea, formato diff unificado (ver calcular_diff del core):
// "+" añadido, "-" quitado, el resto es contexto sin cambios.
function LineaDiff({ linea }) {
  if (linea.startsWith("+")) {
    return (
      <Text component="pre" size="12.5px" ff="monospace" m={0} px="10" py="2" c="green.8" bg="green.0" style={{ whiteSpace: "pre-wrap" }}>
        {linea}
      </Text>
    )
  }
  if (linea.startsWith("-") || linea.startsWith("−")) {
    return (
      <Text component="pre" size="12.5px" ff="monospace" m={0} px="10" py="2" c="red.8" bg="red.0" style={{ whiteSpace: "pre-wrap" }}>
        {linea}
      </Text>
    )
  }
  return (
    <Text component="pre" size="12.5px" ff="monospace" m={0} px="10" py="2" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
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
    <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
      <Group justify="space-between" p="14" wrap="nowrap">
        <Group gap="9" wrap="nowrap">
          <Avatar radius="xl" size={28} color="acento">
            <Text size="11px" fw={600}>
              {iniciales(registro.usuario)}
            </Text>
          </Avatar>
          <Text size="13.5px">
            <Text span fw={600}>
              {registro.usuario || "Usuario eliminado"}
            </Text>{" "}
            <Text span c="dimmed">
              · {formatearFecha(registro.fecha)}
            </Text>
          </Text>
          {esElMasReciente && (
            <Badge size="10px" variant="light" tt="uppercase" radius="sm">
              Más reciente
            </Badge>
          )}
        </Group>
        <Group gap="14" wrap="nowrap">
          <Anchor
            component="button"
            type="button"
            size="12.5px"
            fw={500}
            c="dimmed"
            onClick={alternarDiff}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            {diff ? <IconEyeOff size={14} /> : <IconEye size={14} />}
            {diff ? "Ocultar cambios" : "Ver cambios"}
          </Anchor>
          {proyecto.puede_editar && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              onClick={revertir}
              loading={revirtiendo}
              leftSection={<IconArrowBackUp size={14} stroke={1.8} />}
            >
              Revertir a antes de este cambio
            </Button>
          )}
        </Group>
      </Group>
      {error && (
        <Alert color="red" mx="14" mb="14">
          {error}
        </Alert>
      )}
      {diff && (
        <div style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
          {diff.length === 0 ? (
            <Text size="sm" c="dimmed" p="14">
              Sin diferencias de texto.
            </Text>
          ) : (
            diff.map((linea, i) => <LineaDiff key={i} linea={linea} />)
          )}
        </div>
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

  return (
    <Stack mt="xl" gap="10">
      <Title order={4} fz="16px">
        Historial de cambios
      </Title>
      {error && <Alert color="red">{error}</Alert>}
      {!error && !registros && (
        <Text size="sm" c="dimmed">
          Cargando historial...
        </Text>
      )}
      {registros && registros.length === 0 && (
        <Text size="sm" c="dimmed">
          Este documento no tiene ediciones confirmadas desde el panel todavía.
        </Text>
      )}
      {registros?.map((registro, i) => (
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
