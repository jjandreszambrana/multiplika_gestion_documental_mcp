import { useEffect, useState } from "react"
import { ActionIcon, Anchor, Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconPlus } from "@tabler/icons-react"
import { api } from "../api"
import CambioWeb from "../componentes/CambioWeb"
import EditorPublicacion from "../componentes/EditorPublicacion"
import { ESTADOS_PUBLICACION } from "../webs"

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function Chip({ p, onClick }) {
  const e = ESTADOS_PUBLICACION[p.estado] || { color: "gray" }
  return (
    <Badge color={e.color} variant="light" radius="sm" tt="none" fw={500} fullWidth style={{ cursor: "pointer", justifyContent: "flex-start" }} onClick={onClick}>
      {p.fecha_prevista ? String(p.fecha_prevista).slice(11, 16) + " " : ""}{p.titulo}
    </Badge>
  )
}

// Calendario editorial: todas las publicaciones de todas las redes, por mes.
export default function Publicaciones({ proyecto, onVolver }) {
  const hoy = new Date()
  const [mes, setMes] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [publicaciones, setPublicaciones] = useState([])
  const [abierta, setAbierta] = useState(null)
  const [cambio, setCambio] = useState(null)

  function cargar() {
    const desde = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const hasta = new Date(mes.getFullYear(), mes.getMonth() + 1, 1)
    api.listarPublicaciones(proyecto.id, { desde: iso(desde), hasta: iso(hasta) }).then(setPublicaciones).catch(() => setPublicaciones([]))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, mes])

  const primerDia = (mes.getDay() + 6) % 7
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas = [...Array(primerDia).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)]
  const sinFecha = publicaciones.filter((p) => !p.fecha_prevista)
  const delDia = (d) => publicaciones.filter((p) => p.fecha_prevista && String(p.fecha_prevista).slice(0, 10) === iso(new Date(mes.getFullYear(), mes.getMonth(), d)))

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="lg" display="flex" style={{ alignItems: "center", gap: 6 }} underline="hover" c="dimmed" fz="13.5px" fw={500}>
        <IconArrowLeft size={15} stroke={2} />
        Webs y redes
      </Anchor>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2} mb={6}>Calendario de publicaciones</Title>
          <Text c="dimmed" fz="13.5px" maw={620}>Lo que sale en tus redes. Nada se publica sin que alguien lo apruebe; lo aprobado sale solo a su hora.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAbierta({ id: null })}>Nueva publicación</Button>
      </Group>
      <Group mb="sm" gap="xs">
        <ActionIcon variant="default" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><IconChevronLeft size={16} /></ActionIcon>
        <Text fw={600} w={170} ta="center">{MESES[mes.getMonth()]} {mes.getFullYear()}</Text>
        <ActionIcon variant="default" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><IconChevronRight size={16} /></ActionIcon>
      </Group>
      <SimpleGrid cols={7} spacing={4}>
        {DIAS.map((d) => <Text key={d} fz="12px" c="dimmed" ta="center">{d}</Text>)}
        {celdas.map((d, i) => (
          <Paper key={i} withBorder={!!d} radius="sm" p={4} mih={86} bg={d && iso(new Date(mes.getFullYear(), mes.getMonth(), d)) === iso(hoy) ? "var(--mantine-color-gray-0)" : undefined}>
            {d && (
              <Stack gap={3}>
                <Text fz="11px" c="dimmed">{d}</Text>
                {delDia(d).map((p) => <Chip key={p.id} p={p} onClick={() => setAbierta({ id: p.id })} />)}
              </Stack>
            )}
          </Paper>
        ))}
      </SimpleGrid>
      {sinFecha.length > 0 && (
        <Stack gap={4} mt="md" maw={400}>
          <Text fz="13px" fw={600}>Sin fecha (salen al aprobarlas)</Text>
          {sinFecha.map((p) => <Chip key={p.id} p={p} onClick={() => setAbierta({ id: p.id })} />)}
        </Stack>
      )}
      {abierta && (
        <EditorPublicacion proyecto={proyecto} idPublicacion={abierta.id} onCerrar={() => setAbierta(null)} onCambiada={cargar}
          onPropuesta={(c) => { setAbierta(null); setCambio(c) }} />
      )}
      {cambio && <CambioWeb proyecto={proyecto} cambio={cambio} nivel={null} onCerrar={() => setCambio(null)} onCambiado={setCambio} />}
    </>
  )
}
