import { useEffect, useState } from "react"
import { Alert, Badge, Button, Group, Paper, Stack, Switch, Table, Text, Textarea } from "@mantine/core"
import { api } from "../api"
import { formatearFecha } from "../formato"

const MOTORES = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity" }

// Qué ven las IAs de la web (robots, llms.txt, datos estructurados), con el conector
function LoQueVenLasIAs({ proyecto, activo, onPropuesta }) {
  const [geo, setGeo] = useState(null)
  const [robots, setRobots] = useState({})
  const [llms, setLlms] = useState("")
  const [error, setError] = useState(null)

  useEffect(() => {
    api.leerGeoWeb(proyecto.id, activo.id).then((g) => { setGeo(g); setRobots(g.robots); setLlms(g.llms_txt || "") }).catch((err) => setError(err.message))
  }, [proyecto.id, activo.id])

  async function proponer() {
    setError(null)
    const cambiados = Object.fromEntries(Object.entries(robots).filter(([k, v]) => geo.robots[k] !== v))
    const datos = { ...(Object.keys(cambiados).length ? { robots: cambiados } : {}), ...(llms !== (geo.llms_txt || "") ? { llms_txt: llms } : {}) }
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, activo.id, { operacion: "wp_geo", datos }))
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) return <Text fz="13px" c="dimmed">{error}</Text>
  if (!geo) return <Text fz="13px">Cargando...</Text>
  const puede = activo.nivel_permiso !== "lectura" && activo.estado !== "pausado"
  return (
    <Stack gap="xs">
      <Text fz="13px" c="dimmed">
        Qué robots de IA pueden leer tu web: si bloqueas uno, es difícil salir en las respuestas de esa IA; algunas empresas los bloquean
        para que no aprendan de su contenido. Lo decides tú.{geo.robots_txt_fisico && " Ojo: la web tiene un robots.txt propio en el servidor, que manda sobre esto."}
      </Text>
      <Group gap="md">
        {Object.entries(robots).map(([bot, permitido]) => (
          <Switch key={bot} size="xs" label={bot} checked={permitido} disabled={!puede} onChange={(e) => setRobots({ ...robots, [bot]: e.currentTarget.checked })} />
        ))}
      </Group>
      <Textarea label="llms.txt (resumen de la web para las IAs, en /llms.txt)" autosize minRows={3} value={llms} disabled={!puede}
        onChange={(e) => setLlms(e.target.value)} description="Quiénes sois, qué hacéis, dónde, y las páginas más importantes. Tu IA te lo puede redactar." />
      <Text fz="12.5px" c="dimmed">
        Datos estructurados de la empresa: {geo.datos_estructurados ? `sí (${geo.datos_estructurados["@type"] || "puestos"})` : "no hay"}. Pídele a tu IA que los prepare con tus datos.
      </Text>
      {puede && <Group><Button size="xs" onClick={proponer}>Ver cómo quedaría</Button></Group>}
    </Stack>
  )
}

export default function GeoWeb({ proyecto, activo, onPropuesta }) {
  const [datos, setDatos] = useState(null)
  const [nuevas, setNuevas] = useState("")
  const [midiendo, setMidiendo] = useState(false)
  const [error, setError] = useState(null)

  function cargar() {
    api.estadoGeo(proyecto.id, activo.id).then(setDatos).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, activo.id])

  async function anadir() {
    try {
      await api.anadirPreguntasGeo(proyecto.id, activo.id, nuevas.split("\n").filter((l) => l.trim()))
      setNuevas("")
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function medir() {
    setMidiendo(true)
    setError(null)
    try {
      await api.medirGeo(proyecto.id, activo.id)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setMidiendo(false)
    }
  }

  if (!datos) return error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>
  const a = datos.resultados?.actual
  return (
    <Stack gap="md">
      <Text fz="13.5px" c="dimmed" maw={700}>
        Cada mes se pregunta a las IAs lo que preguntaría un cliente y se mira si sale tu empresa. Es una medida aproximada: las IAs cambian
        sus respuestas de un día para otro; sirve para ver la tendencia. Cada pregunta cuesta una consulta a cada IA.
        IAs disponibles: {datos.motores.length ? datos.motores.map((m) => MOTORES[m] || m).join(", ") : "ninguna (hace falta la clave de Anthropic de la empresa o credenciales «openai», «gemini», «perplexity»)"}.
      </Text>
      {error && <Alert color="red">{error}</Alert>}
      {a && (
        <Paper withBorder radius="md" p="sm">
          <Text fw={600} fz="14px">Sale en {a.aparece} de {a.respuestas} respuestas{a.respuestas ? ` (${Math.round((a.aparece * 100) / a.respuestas)} %)` : ""} · citan la web en {a.enlaza}</Text>
          <Text fz="12px" c="dimmed">Medido el {formatearFecha(a.fecha)}{datos.resultados.anterior?.respuestas ? ` · la vez anterior: ${Math.round((datos.resultados.anterior.aparece * 100) / datos.resultados.anterior.respuestas)} %` : ""}</Text>
          <Group gap="xs" mt={6}>
            {Object.entries(a.por_motor).map(([m, v]) => <Badge key={m} variant="light" tt="none" color={v.aparece ? "teal" : "gray"}>{MOTORES[m] || m}: {v.aparece}/{v.respuestas}</Badge>)}
          </Group>
          {a.competidores.length > 0 && <Text fz="12.5px" mt={6}>Otros sitios que citan: {a.competidores.slice(0, 8).map(([d, n]) => `${d} (${n})`).join(", ")}</Text>}
          {a.errores.length > 0 && <Text fz="12px" c="red" mt={4}>{a.errores.join(" · ")}</Text>}
        </Paper>
      )}
      <div>
        <Text fw={600} fz="13.5px" mb={4}>Preguntas de seguimiento</Text>
        {datos.preguntas.length === 0 ? <Text fz="13px" c="dimmed">Ninguna todavía.</Text> : (
          <Table fz="13px" verticalSpacing={3}>
            <Table.Tbody>
              {datos.preguntas.map((p) => (
                <Table.Tr key={p.id} style={{ opacity: p.activa ? 1 : 0.5 }}>
                  <Table.Td>{p.pregunta}</Table.Td>
                  <Table.Td w={90} align="right">
                    <Button size="compact-xs" variant="subtle" color="gray" onClick={async () => { await api.cambiarPreguntaGeo(proyecto.id, p.id, { borrar: true }); cargar() }}>Quitar</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Group align="flex-end" mt="xs">
          <Textarea style={{ flex: 1 }} autosize minRows={2} placeholder="Una pregunta por línea, p. ej.: mejor laboratorio de análisis de alimentos en Sevilla"
            value={nuevas} onChange={(e) => setNuevas(e.target.value)} />
          <Button size="xs" variant="light" onClick={anadir} disabled={!nuevas.trim()}>Añadir</Button>
        </Group>
      </div>
      <Group><Button size="xs" onClick={medir} loading={midiendo} disabled={!datos.preguntas.length || !datos.motores.length}>Medir ahora</Button>
        {midiendo && <Text fz="12.5px" c="dimmed">Preguntando a las IAs: puede tardar unos minutos.</Text>}</Group>
      {activo.capacidad === "wordpress" && activo.conector_instalado && (
        <div>
          <Text fw={600} fz="13.5px" mb={4}>Lo que ven las IAs de tu web</Text>
          <LoQueVenLasIAs proyecto={proyecto} activo={activo} onPropuesta={onPropuesta} />
        </div>
      )}
    </Stack>
  )
}
