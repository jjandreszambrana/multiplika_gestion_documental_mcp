import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Autocomplete, Badge, Button, Group, Modal, NumberInput, Paper,
  SegmentedControl, Select, Stack, Switch, Table, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconPencil, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { useEstadoPersistente } from "../estadoPersistente"

const TODAS = "__todas__"

// Aviso a partir del cual conviene repasar qué está marcado como global: las
// globales viajan en cada sesión, así que engordan el coste de todas las
// conversaciones (ver docs → "Reglas de comportamiento").
const TOKENS_GLOBALES_AVISO = 1500

const VACIA = { nombre: "", texto: "", categoria: "", prioridad: 0, es_global: false, activa: true, reservada: false }

function Estado({ regla }) {
  return (
    <Group gap="6" wrap="nowrap">
      {regla.es_global ? (
        <Tooltip label="Va en el contexto de la IA desde que abre la conversación">
          <Badge variant="light" color="acento">
            Global
          </Badge>
        </Tooltip>
      ) : (
        <Badge variant="light" color="gray">
          Bajo demanda
        </Badge>
      )}
      {regla.activa === false && (
        <Badge variant="light" color="red">
          Desactivada
        </Badge>
      )}
      {regla.reservada && (
        <Tooltip label="No se comparte con las GDs enlazadas que nos consultan">
          <Badge variant="light" color="yellow">
            Reservada
          </Badge>
        </Tooltip>
      )}
    </Group>
  )
}

function ModalRegla({ opened, regla, categorias, onClose, onGuardar }) {
  const [datos, setDatos] = useState(VACIA)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  // Al abrirlo se rellena con la regla que se va a editar, o se vacía si es
  // una nueva — el modal no se desmonta entre aperturas.
  useEffect(() => {
    if (opened) {
      setDatos(regla ? { ...VACIA, ...regla } : VACIA)
      setError(null)
    }
  }, [opened, regla])

  function cambiar(campo, valor) {
    setDatos((previo) => ({ ...previo, [campo]: valor }))
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({
        nombre: datos.nombre.trim(),
        texto: datos.texto.trim(),
        categoria: datos.categoria.trim(),
        prioridad: Number(datos.prioridad) || 0,
        es_global: datos.es_global,
        activa: datos.activa,
        reservada: datos.reservada,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={regla ? `Editar "${regla.nombre}"` : "Nueva regla"} size="lg">
      <Stack component="form" onSubmit={guardar}>
        <Textarea
          label="Regla"
          description="Una sola idea, en una o dos frases: es lo que leerá la IA tal cual."
          placeholder="p.ej. El correo de contacto de la empresa es contacto@empresa.com"
          autosize minRows={3} maxRows={14} required
          value={datos.texto}
          onChange={(e) => cambiar("texto", e.currentTarget.value)}
        />
        <Group grow align="flex-start">
          <TextInput
            label="Nombre"
            description="Sin repetir. Otra regla puede mandar cargar esta por su nombre."
            placeholder="boletines_replicas" required
            value={datos.nombre}
            onChange={(e) => cambiar("nombre", e.currentTarget.value)}
          />
          <Autocomplete
            label="Categoría"
            description="Agrupa reglas por tipo de tarea."
            placeholder="datos_empresa, correo, estilo..." required
            data={categorias}
            value={datos.categoria}
            onChange={(valor) => cambiar("categoria", valor)}
          />
        </Group>
        <Group align="flex-end">
          <NumberInput
            label="Prioridad" w={120}
            description="Mayor, antes"
            value={datos.prioridad}
            onChange={(valor) => cambiar("prioridad", valor)}
          />
          <Stack gap="6" mb="6">
            <Switch
              label="Global: la IA la recibe en todas las conversaciones"
              checked={datos.es_global}
              onChange={(e) => cambiar("es_global", e.currentTarget.checked)}
            />
            <Switch
              label="Reservada: no se comparte con las GDs que nos consultan"
              checked={datos.reservada}
              onChange={(e) => cambiar("reservada", e.currentTarget.checked)}
            />
            {regla && (
              <Switch
                label="Activa"
                checked={datos.activa}
                onChange={(e) => cambiar("activa", e.currentTarget.checked)}
              />
            )}
          </Stack>
        </Group>

        {regla && (
          <Text c="dimmed" fz="12.5px">
            Si la renombras y otra regla la menciona por su nombre, cámbialo también en el texto de esa otra.
          </Text>
        )}
        {error && <Alert color="red">{error}</Alert>}

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit" loading={guardando}
            disabled={!datos.nombre.trim() || !datos.texto.trim() || !datos.categoria.trim()}
          >
            {regla ? "Guardar" : "Crear regla"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export default function Reglas({ proyecto, onVolver }) {
  const puedeEscribir = proyecto.es_admin || proyecto.puede_editar
  const [reglas, setReglas] = useState(null)
  const [heredadas, setHeredadas] = useState([])
  const [peso, setPeso] = useState(null)
  const [ambito, setAmbito] = useEstadoPersistente(`filtros:${proyecto.id}:reglas:ambito`, "propia")
  const [categoria, setCategoria] = useEstadoPersistente(`filtros:${proyecto.id}:reglas:categoria`, TODAS)
  const [error, setError] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [reglaEditando, setReglaEditando] = useState(null)
  const [refrescando, setRefrescando] = useState(false)

  function cargar() {
    setError(null)
    return Promise.all([
      api.listarReglas(proyecto.id).then(setReglas),
      api.textoReglasGlobales(proyecto.id).then(setPeso),
      // Las heredadas se piden a las centrales en vivo: si no hay ninguna
      // enlazada o no responden, simplemente no hay nada que enseñar.
      api.listarReglasHeredadas(proyecto.id).then(setHeredadas).catch(() => setHeredadas([])),
    ]).catch((err) => setError(err.message))
  }

  function recargar() {
    setRefrescando(true)
    cargar().finally(() => setRefrescando(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  function abrirNueva() {
    setReglaEditando(null)
    setModalAbierto(true)
  }

  function abrirEdicion(regla) {
    if (!puedeEscribir) return
    setReglaEditando(regla)
    setModalAbierto(true)
  }

  async function guardar(datos) {
    if (reglaEditando) {
      await api.actualizarRegla(proyecto.id, reglaEditando.id, datos)
    } else {
      await api.crearRegla(proyecto.id, datos)
    }
    await cargar()
  }

  async function eliminar(regla) {
    if (!window.confirm(`¿Eliminar "${regla.nombre}"? Si solo quieres dejar de aplicarla, desactívala.`)) return
    try {
      await api.eliminarRegla(proyecto.id, regla.id)
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const propias = reglas || []
  const visibles = (ambito === "propia" ? propias : heredadas).filter(
    (r) => categoria === TODAS || r.categoria === categoria,
  )
  const categorias = [...new Set([...propias, ...heredadas].map((r) => r.categoria))].sort()
  const globalesActivas = propias.filter((r) => r.es_global && r.activa).length
  const esHeredada = ambito === "heredada"

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

      <Group justify="space-between" align="flex-start" mb="6">
        <Title order={2}>Reglas de comportamiento</Title>
        <Group gap="xs">
          {puedeEscribir && (
            <Button leftSection={<IconPlus size={15} stroke={2.2} />} onClick={abrirNueva}>
              Nueva regla
            </Button>
          )}
          <Tooltip label="Refrescar">
            <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={refrescando}>
              <IconRefresh size={17} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Text c="dimmed" mb="lg" maw={640} fz="13.5px">
        Cómo debe trabajar la IA en esta gestión documental: datos fijos de la empresa, criterios,
        formas de redactar. No son documentos. Las marcadas como <b>globales</b> las recibe la IA al
        empezar cada conversación; el resto las pide ella sola cuando le toca una tarea de esa
        categoría, o por su nombre cuando una regla global le dice que cargue otra.
      </Text>

      {peso && (
        <Alert color={peso.tokens_aproximados > TOKENS_GLOBALES_AVISO ? "yellow" : "gray"} mb="lg" maw={640}>
          {globalesActivas === 0
            ? "Todavía no hay ninguna regla global: la IA solo recibe la instrucción de pedir las reglas por categoría cuando las necesite."
            : `${globalesActivas} ${globalesActivas === 1 ? "regla global" : "reglas globales"} — unos ${peso.tokens_aproximados} tokens en cada conversación.`}
          {peso.tokens_aproximados > TOKENS_GLOBALES_AVISO &&
            " Van pesando: repasa si alguna puede dejar de ser global y cargarse solo por categoría."}
        </Alert>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Group mb="md">
        <SegmentedControl
          value={ambito}
          onChange={setAmbito}
          data={[
            { value: "propia", label: `Propias (${propias.length})` },
            { value: "heredada", label: `Heredadas (${heredadas.length})` },
          ]}
        />
        <Select
          w={220}
          aria-label="Filtrar por categoría"
          value={categoria}
          onChange={(v) => setCategoria(v || TODAS)}
          data={[{ value: TODAS, label: "Todas las categorías" }, ...categorias.map((c) => ({ value: c, label: c }))]}
        />
      </Group>

      {!reglas ? (
        <Text>Cargando...</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover={!esHeredada} verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={210}>Nombre</Table.Th>
                <Table.Th>Regla</Table.Th>
                <Table.Th w={150}>Categoría</Table.Th>
                <Table.Th w={esHeredada ? 180 : 210}>{esHeredada ? "Viene de" : "Estado"}</Table.Th>
                {!esHeredada && puedeEscribir && <Table.Th w={80} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visibles.map((regla) => (
                <Table.Tr
                  key={esHeredada ? `${regla.origen}-${regla.id}` : regla.id}
                  onClick={esHeredada ? undefined : () => abrirEdicion(regla)}
                  style={esHeredada || !puedeEscribir ? undefined : { cursor: "pointer" }}
                >
                  <Table.Td>
                    <Text fz="13px" ff="monospace" style={{ wordBreak: "break-all" }}>
                      {regla.nombre}
                    </Text>
                    {!esHeredada && regla.prioridad > 0 && (
                      <Text fz="11.5px" c="dimmed">
                        prioridad {regla.prioridad}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text fz="13.5px" lineClamp={2} style={{ opacity: regla.activa === false ? 0.55 : 1 }}>
                      {regla.texto}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="gray">
                      {regla.categoria}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {esHeredada ? (
                      <Tooltip label="Se cambia en la central. Si una regla propia la contradice, manda la propia.">
                        <Badge variant="light" color="blue">
                          {regla.origen}
                        </Badge>
                      </Tooltip>
                    ) : (
                      <Estado regla={regla} />
                    )}
                  </Table.Td>
                  {!esHeredada && puedeEscribir && (
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group gap="4" wrap="nowrap">
                        <Tooltip label="Editar">
                          <ActionIcon variant="subtle" color="gray" onClick={() => abrirEdicion(regla)} aria-label="Editar regla">
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Eliminar">
                          <ActionIcon variant="subtle" color="red" onClick={() => eliminar(regla)} aria-label="Eliminar regla">
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {visibles.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" py="md">
                      {esHeredada
                        ? "No hay reglas heredadas: esta gestión documental no consulta a ninguna central, o la central no tiene reglas compartidas."
                        : "Todavía no hay ninguna regla con este filtro."}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <ModalRegla
        opened={modalAbierto}
        regla={reglaEditando}
        categorias={categorias}
        onClose={() => setModalAbierto(false)}
        onGuardar={guardar}
      />
    </>
  )
}
