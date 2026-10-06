import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Box, Button, Group, Paper, ScrollArea, SegmentedControl, Select, Stack, Text, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconPlugConnected, IconPlus, IconRefresh, IconSearch, IconSettings } from "@tabler/icons-react"
import { api } from "../api"
import { useEstadoPersistente } from "../estadoPersistente"
import { formatearFecha, formatearImporte } from "../formato"
import ConexionErp from "../componentes/ConexionErp"
import EtapasModal from "../componentes/EtapasModal"
import OportunidadModal from "../componentes/OportunidadModal"

const COLOR_TIPO = { abierta: "blue", ganada: "green", perdida: "red" }

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function Tarjeta({ o, arrastrable, onAbrir }) {
  const atrasado = o.fecha_proximo_paso && o.fecha_proximo_paso <= hoyISO()
  const sinPaso = o.tipo_etapa === "abierta" && !o.proximo_paso && !o.fecha_proximo_paso
  return (
    <Paper
      withBorder radius="md" p="xs" style={{ cursor: "pointer" }} onClick={onAbrir}
      draggable={arrastrable} onDragStart={(e) => e.dataTransfer.setData("text/plain", String(o.id))}
    >
      <Text fw={500} size="sm" lineClamp={2}>{o.titulo}</Text>
      <Text size="12px" c="dimmed" truncate>{o.entidad}</Text>
      <Group justify="space-between" mt={4} gap={4}>
        <Text size="13px" fw={600}>{formatearImporte(o.importe)}</Text>
        {o.fecha_prevista_cierre && <Text size="11.5px" c="dimmed">Cierre {formatearFecha(o.fecha_prevista_cierre)}</Text>}
      </Group>
      {o.tipo_etapa === "abierta" && (
        <Text size="11.5px" mt={4} c={atrasado || sinPaso ? "red" : "dimmed"} lineClamp={1}>
          {sinPaso ? "Sin próximo paso" : `${o.proximo_paso || "Próximo paso"}${o.fecha_proximo_paso ? ` · ${formatearFecha(o.fecha_proximo_paso)}` : ""}`}
        </Text>
      )}
      {o.tipo_etapa === "perdida" && o.motivo_perdida && <Text size="11.5px" c="dimmed" lineClamp={1}>{o.motivo_perdida}</Text>}
      {o.responsable && <Badge size="xs" variant="light" color="gray" tt="none" mt={4}>{o.responsable}</Badge>}
    </Paper>
  )
}

// El embudo de ventas: una columna por etapa; arrastrar una tarjeta a otra
// columna la cambia de etapa.
export default function Ventas({ proyecto, esSuperadmin, onVolver, onVerEntidad, onVerDocumento }) {
  const [etapas, setEtapas] = useState([])
  const [datos, setDatos] = useState(null)
  const [vista, setVista] = useEstadoPersistente(`filtros:${proyecto.id}:ventas:vista`, "abiertas")
  const [quien, setQuien] = useEstadoPersistente(`filtros:${proyecto.id}:ventas:quien`, "todos")
  const [texto, setTexto] = useState("")
  const [error, setError] = useState(null)
  const [refrescando, setRefrescando] = useState(false)
  const [abierta, setAbierta] = useState(undefined) // undefined = cerrado; null = nueva; id = esa
  const [editandoEtapas, setEditandoEtapas] = useState(false)
  const [viendoErp, setViendoErp] = useState(false)
  const [encima, setEncima] = useState(null)

  function cargar() {
    setRefrescando(true)
    setError(null)
    return Promise.all([
      api.listarEtapas(proyecto.id).then(setEtapas),
      api.listarOportunidades(proyecto.id, {
        estado: vista, texto: texto.trim(), solo_mias: quien === "mias", sin_responsable: quien === "nadie",
      }).then(setDatos),
    ])
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    const t = setTimeout(cargar, texto ? 300 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, vista, quien, texto])

  async function soltar(e, etapa) {
    e.preventDefault()
    setEncima(null)
    const idOportunidad = Number(e.dataTransfer.getData("text/plain"))
    const o = datos?.oportunidades.find((x) => x.id === idOportunidad)
    if (!o || o.id_etapa === etapa.id) return
    const cambio = { id_etapa: etapa.id }
    if (etapa.tipo === "perdida") {
      const motivo = prompt(`¿Por qué se perdió «${o.titulo}»? (precio, plazo, se fue con otro...)`)
      if (motivo === null) return
      cambio.motivo_perdida = motivo || null
    }
    try {
      await api.actualizarOportunidad(proyecto.id, idOportunidad, cambio)
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  // Las columnas cerradas salen siempre, aunque se vean solo las abiertas:
  // hay que poder soltar ahí una tarjeta para ganarla o perderla
  const columnas = etapas
  const resumen = Object.fromEntries((datos?.resumen || []).map((r) => [r.id_etapa, r]))
  const abiertas = (datos?.resumen || []).filter((r) => r.tipo === "abierta")
  const total = abiertas.reduce((s, r) => s + r.importe, 0)
  const ponderado = abiertas.reduce((s, r) => s + r.importe_ponderado, 0)
  const editable = proyecto.puede_editar

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

      <Group justify="space-between" align="flex-start" mb="6">
        <Title order={2}>CRM</Title>
        {editable && (
          <Group gap="8">
            <Button variant="default" leftSection={<IconPlugConnected size={15} />} onClick={() => setViendoErp(true)}>Conexión con el ERP</Button>
            <Button variant="default" leftSection={<IconSettings size={15} />} onClick={() => setEditandoEtapas(true)}>Etapas</Button>
            <Button leftSection={<IconPlus size={15} stroke={2.2} />} onClick={() => setAbierta(null)}>Nueva oportunidad</Button>
          </Group>
        )}
      </Group>
      <Text c="dimmed" maw={680} fz="13.5px" mb="lg">
        Cada posible venta, en la etapa en que está. Arrastra una tarjeta para moverla de etapa. En el embudo abierto hay{" "}
        <b>{formatearImporte(total)}</b>; ponderado por la probabilidad de cada etapa, <b>{formatearImporte(ponderado)}</b>.
      </Text>

      <Group mb="md" align="flex-end">
        <SegmentedControl
          value={vista} onChange={setVista}
          data={[{ value: "abiertas", label: "Abiertas" }, { value: "todas", label: "Todas, también cerradas" }]}
        />
        <Select
          w={190} allowDeselect={false} value={quien} onChange={setQuien}
          data={[
            { value: "todos", label: "De cualquiera" },
            ...(esSuperadmin ? [] : [{ value: "mias", label: "Las que llevo yo" }]),
            { value: "nadie", label: "Sin responsable" },
          ]}
        />
        <TextInput
          w={240} placeholder="Buscar por título o entidad" leftSection={<IconSearch size={15} />}
          value={texto} onChange={(e) => setTexto(e.currentTarget.value)}
        />
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={cargar} loading={refrescando} mb="6">
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!datos ? (
        <Text>Cargando...</Text>
      ) : (
        <ScrollArea type="auto" offsetScrollbars>
          <Group align="flex-start" wrap="nowrap" gap="sm" pb="sm">
            {columnas.map((etapa) => {
              const de = datos.oportunidades.filter((o) => o.id_etapa === etapa.id)
              const r = resumen[etapa.id]
              return (
                <Box
                  key={etapa.id} w={260} miw={260} p="xs"
                  style={{
                    borderRadius: 10, background: "var(--mantine-color-default-hover)",
                    outline: encima === etapa.id ? "2px dashed var(--mantine-color-blue-5)" : undefined,
                  }}
                  onDragOver={editable ? (e) => { e.preventDefault(); setEncima(etapa.id) } : undefined}
                  onDragLeave={() => setEncima(null)}
                  onDrop={editable ? (e) => soltar(e, etapa) : undefined}
                >
                  <Group justify="space-between" mb={2} wrap="nowrap">
                    <Text fw={600} size="sm" truncate>{etapa.nombre}</Text>
                    <Badge size="sm" variant="light" color={COLOR_TIPO[etapa.tipo]}>{etapa.tipo === "abierta" || vista === "todas" ? de.length : r?.oportunidades ?? 0}</Badge>
                  </Group>
                  <Text size="11.5px" c="dimmed" mb="xs">
                    {formatearImporte(r?.importe ?? 0)}{etapa.tipo === "abierta" ? ` · ${etapa.probabilidad} %` : ""}
                  </Text>
                  <Stack gap="xs" mih={60}>
                    {de.map((o) => <Tarjeta key={o.id} o={o} arrastrable={editable} onAbrir={() => setAbierta(o.id)} />)}
                    {etapa.tipo !== "abierta" && vista === "abiertas" && (
                      <Text size="12px" c="dimmed" ta="center" py="sm">
                        {r?.oportunidades ? `${r.oportunidades} cerrada(s). ` : ""}
                        {editable ? `Suelta aquí una tarjeta para darla por ${etapa.tipo}.` : ""}
                      </Text>
                    )}
                  </Stack>
                </Box>
              )
            })}
          </Group>
        </ScrollArea>
      )}

      <OportunidadModal
        opened={abierta !== undefined} onClose={() => setAbierta(undefined)} proyecto={proyecto}
        idOportunidad={abierta ?? null} etapas={etapas} onGuardada={cargar}
        onVerEntidad={onVerEntidad} onVerDocumento={onVerDocumento}
      />
      <ConexionErp opened={viendoErp} onClose={() => setViendoErp(false)} proyecto={proyecto} />
      <EtapasModal
        opened={editandoEtapas} onClose={() => setEditandoEtapas(false)} proyecto={proyecto} etapas={etapas}
        onGuardadas={() => cargar()}
      />
    </>
  )
}
