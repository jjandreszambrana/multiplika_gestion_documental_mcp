import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Button, Group, NumberInput, Paper, SegmentedControl, Select, Stack,
  Switch, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconTrash } from "@tabler/icons-react"
import { api } from "../api"

const TODAS = "__todas__"

// Aviso a partir del cual conviene repasar qué está marcado como global: las
// globales viajan en cada sesión, así que engordan el coste de todas las
// conversaciones (ver docs → "Reglas de comportamiento").
const TOKENS_GLOBALES_AVISO = 1500

function Etiquetas({ regla }) {
  return (
    <Group gap="6">
      <Badge variant="light" color="gray">
        {regla.categoria}
      </Badge>
      {regla.es_global ? (
        <Badge variant="light" color="acento">
          Global
        </Badge>
      ) : (
        <Badge variant="light" color="gray">
          Bajo demanda
        </Badge>
      )}
      {!regla.activa && (
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

function FilaRegla({ proyecto, regla, puedeEscribir, onCambiada, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(regla.texto)
  const [categoria, setCategoria] = useState(regla.categoria)
  const [prioridad, setPrioridad] = useState(regla.prioridad)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function cambiar(cambios) {
    setError(null)
    setGuardando(true)
    try {
      onCambiada(await api.actualizarRegla(proyecto.id, regla.id, cambios))
      setEditando(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Paper withBorder radius="lg" p="16" mb="10">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap="6" style={{ flex: 1, minWidth: 0 }}>
          <Text fz="14.5px" style={{ opacity: regla.activa ? 1 : 0.55 }}>
            {regla.texto}
          </Text>
          <Etiquetas regla={regla} />
        </Stack>
        {puedeEscribir && (
          <Group gap="lg" wrap="nowrap">
            <Switch
              size="sm"
              label="Global"
              checked={regla.es_global}
              onChange={(e) => cambiar({ es_global: e.currentTarget.checked })}
            />
            <Switch
              size="sm"
              label="Activa"
              checked={regla.activa}
              onChange={(e) => cambiar({ activa: e.currentTarget.checked })}
            />
            <Switch
              size="sm"
              label="Reservada"
              checked={regla.reservada}
              onChange={(e) => cambiar({ reservada: e.currentTarget.checked })}
            />
            <Anchor component="button" type="button" size="sm" onClick={() => setEditando(!editando)}>
              {editando ? "Cancelar" : "Editar"}
            </Anchor>
            <Tooltip label="Eliminar regla">
              <ActionIcon variant="subtle" color="red" onClick={() => onEliminar(regla)} aria-label="Eliminar regla">
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>

      {error && (
        <Alert color="red" mt="sm">
          {error}
        </Alert>
      )}

      {editando && (
        <Stack mt="sm" maw={640}>
          <Textarea label="Texto de la regla" autosize minRows={2} value={texto} onChange={(e) => setTexto(e.currentTarget.value)} />
          <Group align="flex-end">
            <TextInput label="Categoría" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)} />
            <NumberInput label="Prioridad" w={110} value={prioridad} onChange={setPrioridad} />
            <Button
              size="sm"
              loading={guardando}
              disabled={!texto.trim() || !categoria.trim()}
              onClick={() => cambiar({ texto: texto.trim(), categoria: categoria.trim(), prioridad: Number(prioridad) || 0 })}
            >
              Guardar
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  )
}

export default function Reglas({ proyecto, onVolver }) {
  const puedeEscribir = proyecto.es_admin || proyecto.puede_editar
  const [reglas, setReglas] = useState(null)
  const [heredadas, setHeredadas] = useState([])
  const [peso, setPeso] = useState(null)
  const [ambito, setAmbito] = useState("propia")
  const [categoria, setCategoria] = useState(TODAS)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState("")
  const [categoriaNueva, setCategoriaNueva] = useState("")
  const [esGlobal, setEsGlobal] = useState(false)
  const [reservada, setReservada] = useState(false)
  const [creando, setCreando] = useState(false)

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

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      await api.crearRegla(proyecto.id, {
        texto: texto.trim(),
        categoria: categoriaNueva.trim(),
        es_global: esGlobal,
        reservada,
      })
      setTexto("")
      setEsGlobal(false)
      setReservada(false)
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(regla) {
    if (!window.confirm("¿Eliminar esta regla? Si solo quieres dejar de aplicarla, desactívala.")) return
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
      <Title order={2} mb="6">
        Reglas de comportamiento
      </Title>
      <Text c="dimmed" mb="lg" maw={640} fz="13.5px">
        Cómo debe trabajar la IA en esta gestión documental: datos fijos de la empresa, criterios,
        formas de redactar. No son documentos. Las marcadas como <b>globales</b> las recibe la IA al
        empezar cada conversación; el resto las pide ella sola cuando le toca una tarea de esa
        categoría, así que no cuestan nada mientras no vengan a cuento.
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

      {puedeEscribir && (
        <Stack component="form" onSubmit={crear} maw={640} mb="xl" gap="xs">
          <Textarea
            label="Nueva regla"
            placeholder="p.ej. El correo de contacto de la empresa es contacto@empresa.com"
            autosize
            minRows={2}
            value={texto}
            onChange={(e) => setTexto(e.currentTarget.value)}
            required
          />
          <Group align="flex-end">
            <TextInput
              label="Categoría"
              placeholder="datos_empresa, correo, estilo..."
              value={categoriaNueva}
              onChange={(e) => setCategoriaNueva(e.currentTarget.value)}
              required
            />
            <Switch label="Global" checked={esGlobal} onChange={(e) => setEsGlobal(e.currentTarget.checked)} mb="8" />
            <Switch
              label="Reservada" checked={reservada} mb="8"
              onChange={(e) => setReservada(e.currentTarget.checked)}
            />
            <Button type="submit" loading={creando}>
              Añadir regla
            </Button>
          </Group>
          <Text c="dimmed" fz="12.5px">
            Marca "global" solo lo que hace falta en casi cualquier tarea. "Reservada" impide que la
            regla se comparta con las gestiones documentales que nos consultan.
          </Text>
        </Stack>
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
      ) : visibles.length === 0 ? (
        <Text c="dimmed">
          {ambito === "propia"
            ? "Todavía no hay ninguna regla con este filtro."
            : "No hay reglas heredadas: esta gestión documental no consulta a ninguna central, o la central no tiene reglas compartidas."}
        </Text>
      ) : ambito === "heredada" ? (
        visibles.map((regla) => (
          <Paper key={`${regla.origen}-${regla.id}`} withBorder radius="lg" p="16" mb="10">
            <Text fz="14.5px">{regla.texto}</Text>
            <Group gap="6" mt="6">
              <Etiquetas regla={regla} />
              <Badge variant="light" color="blue">
                {regla.origen}
              </Badge>
            </Group>
            <Text c="dimmed" fz="12.5px" mt="6">
              Se cambia en la central. Si una regla propia la contradice, manda la propia.
            </Text>
          </Paper>
        ))
      ) : (
        visibles.map((regla) => (
          <FilaRegla
            key={regla.id}
            proyecto={proyecto}
            regla={regla}
            puedeEscribir={puedeEscribir}
            onCambiada={(actualizada) => {
              setReglas(propias.map((r) => (r.id === actualizada.id ? actualizada : r)))
              api.textoReglasGlobales(proyecto.id).then(setPeso).catch(() => {})
            }}
            onEliminar={eliminar}
          />
        ))
      )}
    </>
  )
}
