import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Checkbox, Group, Paper, SegmentedControl, Select, Stack, Text, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import ControlSeguimiento, { TIPOS_SEGUIMIENTO } from "../componentes/Seguimiento"

const VISTAS = {
  abiertos: { label: "Pendiente y en curso", estados: ["pendiente", "en_curso"] },
  aplazado: { label: "Aplazado", estados: ["aplazado"] },
  realizado: { label: "Realizado", estados: ["realizado"] },
  todos: { label: "Todo", estados: [] },
}

// Todo lo que tiene estado de seguimiento: notas del bloc, documentos y
// notas de documentos, en una sola lista.
export default function Seguimiento({ proyecto, esSuperadmin, onVolver, onVerNota, onVerDocumento }) {
  const [filas, setFilas] = useState(null)
  const [vista, setVista] = useState("abiertos")
  const [tipo, setTipo] = useState(null)
  const [quien, setQuien] = useState("todos")
  const [archivados, setArchivados] = useState(false)
  const [error, setError] = useState(null)
  const [refrescando, setRefrescando] = useState(false)

  function cargar() {
    setRefrescando(true)
    setError(null)
    return api
      .listarSeguimiento(proyecto.id, {
        estados: VISTAS[vista].estados, tipo, solo_mios: quien === "mios", sin_responsable: quien === "nadie",
        incluir_archivados: archivados,
      })
      .then(setFilas)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, vista, tipo, quien, archivados])

  function abrir(f) {
    if (f.tipo === "nota_bloc") onVerNota(f.id)
    else onVerDocumento(f.id_documento)
  }

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

      <Title order={2} mb="6">Seguimiento</Title>
      <Text c="dimmed" maw={620} fz="13.5px" mb="lg">
        Notas del bloc, documentos y notas de documentos a los que se les ha puesto un estado. Cada mañana a
        las 8:00 a cada uno le llega un resumen con lo pendiente y en curso que tiene encargado, más lo que no
        tiene a nadie.
      </Text>

      <Group mb="md" align="flex-end">
        <SegmentedControl
          value={vista} onChange={setVista}
          data={Object.entries(VISTAS).map(([value, v]) => ({ value, label: v.label }))}
        />
        <Select
          placeholder="Todo tipo" clearable w={190}
          data={Object.entries(TIPOS_SEGUIMIENTO).map(([value, label]) => ({ value, label }))}
          value={tipo} onChange={setTipo}
        />
        <Select
          w={190} allowDeselect={false} value={quien} onChange={setQuien}
          data={[
            { value: "todos", label: "De cualquiera" },
            ...(esSuperadmin ? [] : [{ value: "mios", label: "Lo que llevo yo" }]),
            { value: "nadie", label: "Sin nadie encargado" },
          ]}
        />
        <Checkbox label="Con archivados" checked={archivados} onChange={(e) => setArchivados(e.currentTarget.checked)} mb="8" />
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={cargar} loading={refrescando} mb="6">
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!filas ? (
        <Text>Cargando...</Text>
      ) : filas.length === 0 ? (
        <Text c="dimmed">Nada con estos filtros.</Text>
      ) : (
        <Stack gap="xs">
          {filas.map((f) => (
            <Paper key={`${f.tipo}-${f.id}`} withBorder radius="md" p="sm" style={{ cursor: "pointer" }} onClick={() => abrir(f)}>
              <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text size="11.5px" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: ".03em" }}>
                    {TIPOS_SEGUIMIENTO[f.tipo]}{f.archivado ? " · archivado" : ""}
                  </Text>
                  <Text fw={500} size="sm" lineClamp={2}>{f.titulo}</Text>
                  <Text size="12px" c="dimmed" mt={2}>
                    Cambiado por {f.cambiado_por} el {formatearFecha(f.fecha_cambio).slice(0, 16)}
                  </Text>
                </div>
                <ControlSeguimiento
                  proyecto={proyecto} tipo={f.tipo} idObjeto={f.id} seguimiento={f} onCambiado={cargar}
                />
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </>
  )
}
