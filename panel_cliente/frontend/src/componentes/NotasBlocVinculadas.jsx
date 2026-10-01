import { useEffect, useState } from "react"
import { Alert, Button, Group, Stack, Text } from "@mantine/core"
import { IconPlus } from "@tabler/icons-react"
import { api } from "../api"
import TarjetaNotaBloc from "./TarjetaNotaBloc"

// Notas del bloc enlazadas a un documento o a un registro de datos (las que
// puede ver quien mira), y escribir una nueva ya enlazada.
// `enlace`: { tipo: "documento" | "registro", id }
export default function NotasBlocVinculadas({ proyecto, enlace, onVerNota, onNuevaNota }) {
  const [notas, setNotas] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .listarNotasBloc(proyecto.id, { [`id_${enlace.tipo}`]: enlace.id, archivadas: "todas" })
      .then(setNotas)
      .catch((err) => setError(err.message))
  }, [proyecto.id, enlace.tipo, enlace.id])

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Notas del bloc de notas que tienen que ver con este {enlace.tipo}.
        </Text>
        {proyecto.puede_editar && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => onNuevaNota(enlace)}>
            Nueva nota
          </Button>
        )}
      </Group>
      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!notas ? (
        <Text>Cargando...</Text>
      ) : notas.length === 0 ? (
        <Text size="sm" c="dimmed">Ninguna nota enlazada.</Text>
      ) : (
        <Stack gap="xs">
          {notas.map((n) => (
            <TarjetaNotaBloc key={n.id} nota={n} onClick={() => onVerNota(n.id)} />
          ))}
        </Stack>
      )}
    </>
  )
}
