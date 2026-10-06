import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Group, Modal, Paper, Switch, Table, Text, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconCalendar, IconPlus, IconRefresh, IconSearch } from "@tabler/icons-react"
import { api } from "../api"
import { useEstadoPersistente } from "../estadoPersistente"
import FormularioActivo from "../componentes/FormularioActivo"
import { EstadoVigilancia } from "../componentes/VigilanciaWeb"
import { NIVELES, PLATAFORMAS } from "../webs"

export default function Webs({ proyecto, onVolver, onVerActivo, onVerCalendario }) {
  const [activos, setActivos] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useEstadoPersistente(`filtros:${proyecto.id}:webs:q`, "")
  const [incluirArchivados, setIncluirArchivados] = useEstadoPersistente(`filtros:${proyecto.id}:webs:incluirArchivados`, false)
  const [refrescando, setRefrescando] = useState(false)
  const [creando, setCreando] = useState(false)

  function cargar(consultaQ = q, consultaArchivados = incluirArchivados) {
    setRefrescando(true)
    return api
      .listarActivos(proyecto.id, consultaQ, consultaArchivados)
      .then(setActivos)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    cargar()
    api.catalogoActivos(proyecto.id).then(setCatalogo).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="6">Webs y redes</Title>
          <Text c="dimmed" maw={600} fz="13.5px">
            Las webs, redes sociales y bases de datos de tu empresa. Tu IA (o tú desde aquí) puede consultar su contenido y
            proponer cambios; ningún cambio se hace sin que antes se vea cómo queda y alguien lo apruebe, y todos se pueden deshacer.
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="default" leftSection={<IconCalendar size={16} />} onClick={onVerCalendario}>Calendario de publicaciones</Button>
          {proyecto.es_admin && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreando(true)}>Añadir</Button>
          )}
        </Group>
      </Group>

      <Group component="form" onSubmit={(e) => { e.preventDefault(); cargar() }} mb="md">
        <TextInput
          placeholder="Buscar por nombre o dirección" leftSection={<IconSearch size={15} stroke={2} />}
          value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
        />
        <Switch
          label="Incluir archivadas" checked={incluirArchivados}
          onChange={(e) => { setIncluirArchivados(e.currentTarget.checked); cargar(q, e.currentTarget.checked) }}
        />
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={() => cargar()} loading={refrescando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && <Alert color="red" mb="md">{error}</Alert>}
      {!activos ? (
        <Text>Cargando...</Text>
      ) : activos.length === 0 ? (
        <Text c="dimmed">
          Todavía no hay ninguna web ni red dada de alta.
          {proyecto.es_admin ? " Pulsa «Añadir» o pídeselo a tu IA." : " Un administrador puede darlas de alta, o pídeselo a tu IA."}
        </Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Plataforma</Table.Th>
                <Table.Th>Vigilancia</Table.Th>
                <Table.Th>Qué puede hacer la IA</Table.Th>
                <Table.Th>Pendientes de aprobar</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {activos.map((a) => (
                <Table.Tr key={a.id} onClick={() => onVerActivo(a.id)} style={{ cursor: "pointer", opacity: a.archivado ? 0.55 : 1 }}>
                  <Table.Td>
                    <Text fw={500} fz="14px">{a.nombre}</Text>
                    <Text fz="12px" c="dimmed">{a.url || a.nombre_entidad || ""}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Text fz="13px">{PLATAFORMAS[a.plataforma] || a.plataforma}</Text>
                      {a.estado === "pausado" && <Badge color="gray" variant="light" tt="none">En pausa</Badge>}
                      {a.estado === "error" && <Badge color="red" variant="light" tt="none">Error de conexión</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td>{a.url ? <EstadoVigilancia estado={a.vigilancia} /> : <Text fz="13px" c="dimmed">—</Text>}</Table.Td>
                  <Table.Td>
                    <Badge color={NIVELES[a.nivel_permiso]?.color} variant="light" radius="sm" tt="none" fw={500}>
                      {NIVELES[a.nivel_permiso]?.etiqueta || a.nivel_permiso}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {a.propuestas_pendientes > 0 ? (
                      <Badge color="blue" radius="sm">{a.propuestas_pendientes}</Badge>
                    ) : (
                      <Text fz="13px" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal opened={creando} onClose={() => setCreando(false)} title={<Text fw={600}>Añadir web o red</Text>} size="lg">
        {creando && (
          <FormularioActivo
            proyecto={proyecto} catalogo={catalogo} onCancelar={() => setCreando(false)}
            onGuardado={(a) => { setCreando(false); onVerActivo(a.id) }}
          />
        )}
      </Modal>
    </>
  )
}
