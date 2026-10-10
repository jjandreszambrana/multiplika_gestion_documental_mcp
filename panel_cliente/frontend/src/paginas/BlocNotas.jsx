import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Button, Checkbox, ColorSwatch, Group, SegmentedControl, Select, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconPlus, IconRefresh, IconSearch } from "@tabler/icons-react"
import { api } from "../api"
import { useEstadoPersistente } from "../estadoPersistente"
import TarjetaNotaBloc, { COLORES } from "../componentes/TarjetaNotaBloc"

export default function BlocNotas({ proyecto, esSuperadmin, onVolver, onVerNota, onNuevaNota }) {
  const [notas, setNotas] = useState(null)
  const [etiquetas, setEtiquetas] = useState([])
  const [texto, setTexto] = useEstadoPersistente(`filtros:${proyecto.id}:bloc:texto`, "")
  const [etiqueta, setEtiqueta] = useEstadoPersistente(`filtros:${proyecto.id}:bloc:etiqueta`, null)
  const [color, setColor] = useEstadoPersistente(`filtros:${proyecto.id}:bloc:color`, null)
  const [archivadas, setArchivadas] = useEstadoPersistente(`filtros:${proyecto.id}:bloc:archivadas`, "no")
  const [soloMias, setSoloMias] = useEstadoPersistente(`filtros:${proyecto.id}:bloc:soloMias`, false)
  const [error, setError] = useState(null)
  const [refrescando, setRefrescando] = useState(false)

  function cargar() {
    setRefrescando(true)
    setError(null)
    return api
      .listarNotasBloc(proyecto.id, { texto: texto.trim(), etiqueta, color, archivadas, solo_mias: soloMias })
      .then(setNotas)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  // Al escribir se espera un poco antes de buscar, para no pedir a cada letra
  useEffect(() => {
    const temporizador = setTimeout(cargar, 300)
    return () => clearTimeout(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, texto, etiqueta, color, archivadas, soloMias])

  useEffect(() => {
    api.listarEtiquetasBloc(proyecto.id).then(setEtiquetas).catch(() => setEtiquetas([]))
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

      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="6">
            Bloc de notas
          </Title>
          <Text c="dimmed" maw={560} fz="13.5px">
            Lo que apuntas de reuniones, llamadas o ideas. Cada nota se puede enlazar con otras notas, con
            documentos y con registros de datos, y la IA también las lee.
          </Text>
        </div>
        {proyecto.puede_editar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => onNuevaNota(null)}>
            Nueva nota
          </Button>
        )}
      </Group>

      <Group mb="md" align="flex-end">
        <TextInput
          placeholder="Buscar en las notas" leftSection={<IconSearch size={15} />} w={260}
          value={texto} onChange={(e) => setTexto(e.currentTarget.value)}
        />
        <Select
          placeholder="Etiqueta" clearable searchable w={200}
          data={etiquetas.map((e) => ({ value: e.etiqueta, label: `${e.etiqueta} (${e.notas})` }))}
          value={etiqueta} onChange={setEtiqueta}
        />
        <Select
          placeholder="Color" clearable w={150}
          data={COLORES} value={color} onChange={setColor}
          leftSection={color ? <ColorSwatch size={14} color={`var(--mantine-color-${color}-6)`} /> : null}
          renderOption={({ option }) => (
            <Group gap="xs">
              <ColorSwatch size={14} color={`var(--mantine-color-${option.value}-6)`} />
              {option.label}
            </Group>
          )}
        />
        <SegmentedControl
          value={archivadas} onChange={setArchivadas}
          data={[
            { value: "no", label: "Activas" },
            { value: "si", label: "Archivadas" },
          ]}
        />
        {!esSuperadmin && (
          <Checkbox label="Solo las mías" checked={soloMias} onChange={(e) => setSoloMias(e.currentTarget.checked)} mb="8" />
        )}
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={cargar} loading={refrescando} mb="6">
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!notas ? (
        <Text>Cargando...</Text>
      ) : notas.length === 0 ? (
        <Text c="dimmed">
          {texto || etiqueta || color || soloMias || archivadas === "si" ? "Ninguna nota con estos filtros." : "Todavía no hay ninguna nota."}
        </Text>
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
