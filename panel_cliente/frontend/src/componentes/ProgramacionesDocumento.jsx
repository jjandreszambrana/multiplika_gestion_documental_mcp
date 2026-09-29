import { useEffect, useState } from "react"
import { Alert, Badge, Button, Group, Paper, Stack, Text } from "@mantine/core"
import { IconPlus } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import FormularioProgramacion from "./FormularioProgramacion"

// Pestaña "Avisos" de la ficha de un documento: los avisos programados
// enlazados a él, y crear uno nuevo ya enlazado.
export default function ProgramacionesDocumento({ proyecto, idDocumento, onVerProgramacion }) {
  const [programaciones, setProgramaciones] = useState(null)
  const [error, setError] = useState(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)

  useEffect(() => {
    api
      .listarProgramaciones(proyecto.id, { id_documento: idDocumento })
      .then(setProgramaciones)
      .catch((err) => setError(err.message))
  }, [proyecto.id, idDocumento])

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">Recordatorios programados que tienen que ver con este documento.</Text>
        {proyecto.puede_editar && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setFormularioAbierto(true)}>
            Nuevo aviso
          </Button>
        )}
      </Group>
      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!programaciones ? (
        <Text>Cargando...</Text>
      ) : programaciones.length === 0 ? (
        <Text size="sm" c="dimmed">Ningún aviso enlazado a este documento.</Text>
      ) : (
        <Stack gap="xs">
          {programaciones.map((p) => (
            <Paper key={p.id} withBorder radius="md" p="sm" style={{ cursor: "pointer" }} onClick={() => onVerProgramacion(p.id)}>
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={500} size="sm">{p.titulo}</Text>
                  <Text size="12.5px" c="dimmed">
                    {p.descripcion_repeticion} · para {p.destinatarios.join(", ")}
                  </Text>
                </div>
                {p.estado === "activa" ? (
                  <Text size="12.5px" c="dimmed" style={{ whiteSpace: "nowrap" }}>Próximo: {formatearFecha(p.proxima_ejecucion)}</Text>
                ) : (
                  <Badge variant="light" color="gray">{p.estado}</Badge>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
      <FormularioProgramacion
        opened={formularioAbierto}
        onClose={() => setFormularioAbierto(false)}
        proyecto={proyecto}
        programacion={null}
        idDocumentoInicial={idDocumento}
        onGuardado={(nueva) => { setFormularioAbierto(false); onVerProgramacion(nueva.id) }}
      />
    </>
  )
}
