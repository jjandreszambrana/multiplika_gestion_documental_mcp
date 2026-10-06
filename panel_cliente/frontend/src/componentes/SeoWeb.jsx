import { useEffect, useState } from "react"
import {
  Alert, Anchor, Badge, Button, Group, List, Modal, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title,
} from "@mantine/core"
import { api } from "../api"
import { formatearFecha } from "../formato"
import GeoWeb from "./GeoWeb"

const GRAVEDAD = { alta: "red", media: "yellow", baja: "gray" }
// Problemas que se arreglan con el título o la descripción para Google
const DE_TITULO_O_DESCRIPCION = new Set([
  "sin_descripcion", "descripcion_larga", "descripcion_corta", "descripcion_duplicada", "titulo_largo", "titulo_corto", "titulo_duplicado",
])

function Cifra({ titulo, valor, anterior, mejorSiBaja = false, sufijo = "" }) {
  let cambio = null
  if (anterior != null && anterior !== 0 && valor != null) {
    const pct = ((valor - anterior) / anterior) * 100
    const bueno = mejorSiBaja ? pct < 0 : pct > 0
    cambio = <Text fz="12px" c={Math.abs(pct) < 1 ? "dimmed" : bueno ? "teal" : "red"}>{pct > 0 ? "+" : ""}{pct.toFixed(0)} % vs. antes</Text>
  }
  return (
    <Paper withBorder radius="md" p="sm">
      <Text fz="12px" c="dimmed">{titulo}</Text>
      <Text fz="22px" fw={600}>{valor ?? "—"}{sufijo}</Text>
      {cambio}
    </Paper>
  )
}

function Google({ proyecto, activo, cuenta }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cuenta?.correo) return
    api.rendimientoGoogle(proyecto.id, activo.id).then(setDatos).catch((err) => setError(err.message))
  }, [proyecto.id, activo.id, cuenta])

  if (!cuenta) return null
  if (!cuenta.correo) {
    return <Alert color="gray">Los datos de Google Search Console todavía no están disponibles en este servidor. Avisa a soporte de Multiplika.</Alert>
  }
  if (error) {
    return (
      <Alert color="blue" title="Conecta tu web con Google Search Console">
        <Text fz="13.5px" mb="xs">{error}</Text>
        <List size="sm" type="ordered">
          <List.Item>Entra en search.google.com/search-console con la cuenta de Google de tu web.</List.Item>
          <List.Item>Elige tu web → Configuración → Usuarios y permisos → Añadir usuario.</List.Item>
          <List.Item>Escribe <b>{cuenta.correo}</b> con permiso «Restringido» y guarda.</List.Item>
          <List.Item>Vuelve aquí y recarga la página.</List.Item>
        </List>
      </Alert>
    )
  }
  if (!datos) return <Text>Cargando datos de Google...</Text>
  const a = datos.actual
  const p = datos.anterior
  return (
    <Stack gap="sm">
      <Text fz="13px" c="dimmed">Últimos 28 días ({formatearFecha(datos.desde).slice(0, 10)} – {formatearFecha(datos.hasta).slice(0, 10)}) frente a los 28 anteriores.</Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Cifra titulo="Visitas desde Google" valor={a.clics} anterior={p.clics} />
        <Cifra titulo="Veces que salió en Google" valor={a.impresiones} anterior={p.impresiones} />
        <Cifra titulo="De cada 100 que la ven, entran" valor={a.ctr} anterior={p.ctr} sufijo=" %" />
        <Cifra titulo="Posición media" valor={a.posicion} anterior={p.posicion} mejorSiBaja />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <div>
          <Text fw={600} fz="13.5px" mb={4}>Páginas que más visitas traen</Text>
          <Table fz="12.5px" verticalSpacing={3}>
            <Table.Tbody>
              {datos.paginas.map((x) => (
                <Table.Tr key={x.clave}>
                  <Table.Td style={{ wordBreak: "break-all" }}>{x.clave.replace(/^https?:\/\/[^/]+/, "") || "/"}</Table.Td>
                  <Table.Td align="right">{x.clics}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
        <div>
          <Text fw={600} fz="13.5px" mb={4}>Búsquedas por las que te encuentran</Text>
          <Table fz="12.5px" verticalSpacing={3}>
            <Table.Tbody>
              {datos.busquedas.map((x) => (
                <Table.Tr key={x.clave}>
                  <Table.Td>{x.clave}</Table.Td>
                  <Table.Td align="right">{x.clics}</Table.Td>
                  <Table.Td align="right" c="dimmed">pos. {x.posicion}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </SimpleGrid>
    </Stack>
  )
}

function Velocidad({ proyecto, activo, cuenta }) {
  const [datos, setDatos] = useState(null)
  const [midiendo, setMidiendo] = useState(null)
  const [error, setError] = useState(null)

  async function medir(estrategia) {
    setMidiendo(estrategia)
    setError(null)
    try {
      setDatos(await api.velocidadWeb(proyecto.id, activo.id, estrategia))
    } catch (err) {
      setError(err.message)
    } finally {
      setMidiendo(null)
    }
  }

  return (
    <Stack gap="xs">
      <Group>
        <Button size="xs" variant="default" onClick={() => medir("mobile")} loading={midiendo === "mobile"}>Medir en móvil</Button>
        <Button size="xs" variant="default" onClick={() => medir("desktop")} loading={midiendo === "desktop"}>Medir en ordenador</Button>
        {midiendo && <Text fz="12.5px" c="dimmed">Google tarda hasta un minuto…</Text>}
      </Group>
      {cuenta && !cuenta.pagespeed && <Text fz="12.5px" c="dimmed">Sin clave de Google en el servidor, la medición puede fallar por límite de consultas.</Text>}
      {error && <Alert color="red">{error}</Alert>}
      {datos && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Cifra titulo="Rendimiento" valor={datos.puntuaciones.performance} sufijo="/100" />
            <Cifra titulo="SEO" valor={datos.puntuaciones.seo} sufijo="/100" />
            <Cifra titulo="Accesibilidad" valor={datos.puntuaciones.accessibility} sufijo="/100" />
            <Cifra titulo="Buenas prácticas" valor={datos.puntuaciones["best-practices"]} sufijo="/100" />
          </SimpleGrid>
          {datos.lcp_ms && <Text fz="13.5px">Lo principal de la página tarda {(datos.lcp_ms / 1000).toFixed(1)} s en verse (Google recomienda menos de 2,5 s).</Text>}
          {datos.oportunidades.length > 0 && (
            <List size="sm">
              {datos.oportunidades.map((o) => <List.Item key={o.que}>{o.que} (ahorraría {(o.ahorro_ms / 1000).toFixed(1)} s)</List.Item>)}
            </List>
          )}
        </>
      )}
    </Stack>
  )
}

// Editar lo que sale en Google de una página: crea una propuesta (vista previa y aprobar)
function EditorSeo({ proyecto, activo, hallazgo, onPropuesta, onCerrar }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    api.leerSeoPagina(proyecto.id, activo.id, hallazgo.objeto_id)
      .then((d) => setDatos({ titulo_seo: d.titulo_seo || "", descripcion_seo: d.descripcion_seo || "", plugin: d.plugin_seo, titulo: d.titulo }))
      .catch((err) => setError(err.message))
  }, [proyecto.id, activo.id, hallazgo.objeto_id])

  async function proponer() {
    setEnviando(true)
    setError(null)
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, activo.id, {
        operacion: "wp_editar_seo", id_objeto: hallazgo.objeto_id,
        datos: { titulo_seo: datos.titulo_seo, descripcion_seo: datos.descripcion_seo }, motivo: hallazgo.texto,
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal opened onClose={onCerrar} size="lg" title={<Text fw={600}>Lo que sale en Google{datos?.titulo ? ` de «${datos.titulo}»` : ""}</Text>}>
      {!datos ? (error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>) : (
        <Stack gap="sm">
          <Text fz="13px" c="dimmed">{hallazgo.texto}</Text>
          <TextInput
            label="Título para Google" description={`${datos.titulo_seo.length} caracteres (mejor entre 30 y 60). Vacío = el título de la página.`}
            value={datos.titulo_seo} onChange={(e) => setDatos({ ...datos, titulo_seo: e.target.value })}
          />
          <Textarea
            label="Descripción para Google" autosize minRows={3}
            description={`${datos.descripcion_seo.length} caracteres (mejor entre 70 y 160). Es el texto que sale debajo del título.`}
            value={datos.descripcion_seo} onChange={(e) => setDatos({ ...datos, descripcion_seo: e.target.value })}
          />
          <Text fz="12px" c="dimmed">
            {datos.plugin === "conector" ? "La web no tiene plugin de SEO: lo pondrá el conector de Multiplika." : `Se guarda en ${datos.plugin}.`}
          </Text>
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={proponer} loading={enviando}>Ver cómo quedaría</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

function Auditoria({ proyecto, activo, onPropuesta }) {
  const [datos, setDatos] = useState(null)
  const [estado, setEstado] = useState("abierto")
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)
  const [aviso, setAviso] = useState(null)
  const puedeProponer = activo.nivel_permiso !== "lectura" && activo.estado !== "pausado" && activo.conector_instalado

  function cargar(e = estado) {
    return api.hallazgosSeo(proyecto.id, activo.id, e).then(setDatos).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, activo.id])

  // Mientras está en curso, se mira cada 5 segundos
  useEffect(() => {
    if (datos?.auditoria?.estado !== "en_curso") return
    const t = setTimeout(() => cargar(), 5000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos])

  async function auditar() {
    setError(null)
    try {
      await api.auditarSeo(proyecto.id, activo.id)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function accion(h, que) {
    setError(null)
    try {
      if (que === "tarea") {
        const r = await api.hallazgoSeoATarea(proyecto.id, h.id)
        setAviso(`Creada la tarea «${r.titulo_nota}» en el bloc de notas, como pendiente en el seguimiento.`)
      } else {
        await api.marcarHallazgoSeo(proyecto.id, h.id, que)
      }
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const au = datos?.auditoria
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fz="13.5px" c="dimmed">
          {!au ? "Todavía no se ha auditado esta web." : au.estado === "en_curso" ? "Auditando: recorriendo la web como Google…"
            : au.estado === "fallida" ? `La última auditoría falló: ${au.error}`
            : `Última auditoría: ${formatearFecha(au.fecha_fin)}, ${au.paginas} páginas${au.limite_alcanzado ? " (se paró en el máximo)" : ""}. Se repite sola cada semana.`}
        </Text>
        <Button size="xs" onClick={auditar} loading={au?.estado === "en_curso"}>Auditar ahora</Button>
      </Group>
      {aviso && <Alert color="teal" withCloseButton onClose={() => setAviso(null)}>{aviso}</Alert>}
      {error && <Alert color="red">{error}</Alert>}
      <Select w={200} size="xs" value={estado} allowDeselect={false} onChange={(v) => { setEstado(v); cargar(v) }}
        data={[{ value: "abierto", label: "Por arreglar" }, { value: "en_tarea", label: "Convertidos en tarea" }, { value: "ignorado", label: "Ignorados" }]} />
      {datos && datos.hallazgos.length === 0 ? (
        <Text c="dimmed" fz="13.5px">{au?.estado === "terminada" ? "Nada en esta lista." : ""}</Text>
      ) : datos && (
        <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
          <Table verticalSpacing="xs" fz="13px">
            <Table.Tbody>
              {datos.hallazgos.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td w={90}><Badge color={GRAVEDAD[h.gravedad]} variant="light" tt="none" style={{ overflow: "visible" }}>{h.gravedad}</Badge></Table.Td>
                  <Table.Td>
                    <Text fz="13px">{h.texto}</Text>
                    {h.url && <Anchor href={h.url} target="_blank" fz="12px" style={{ wordBreak: "break-all" }}>{h.url}</Anchor>}
                    {h.clics != null && <Text fz="12px" c="dimmed">{h.clics} visitas desde Google en 28 días</Text>}
                  </Table.Td>
                  <Table.Td w={230}>
                    <Group gap={4} justify="flex-end">
                      {puedeProponer && h.objeto_id && DE_TITULO_O_DESCRIPCION.has(h.tipo) && (
                        <Button size="compact-xs" variant="light" onClick={() => setEditando(h)}>Arreglar</Button>
                      )}
                      {h.estado === "abierto" && <Button size="compact-xs" variant="subtle" onClick={() => accion(h, "tarea")}>Crear tarea</Button>}
                      {h.estado !== "ignorado" ? (
                        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => accion(h, "ignorado")}>Ignorar</Button>
                      ) : (
                        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => accion(h, "abierto")}>Recuperar</Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      {!activo.conector_instalado && <Text fz="12px" c="dimmed">Para arreglar títulos y descripciones desde aquí hace falta el conector de Multiplika (pestaña Vigilancia).</Text>}
      {editando && (
        <EditorSeo proyecto={proyecto} activo={activo} hallazgo={editando} onCerrar={() => setEditando(null)}
          onPropuesta={(c) => { setEditando(null); onPropuesta(c) }} />
      )}
    </Stack>
  )
}

export default function SeoWeb({ proyecto, activo, onPropuesta }) {
  const [cuenta, setCuenta] = useState(null)
  const [informe, setInforme] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.cuentaGoogleSeo(proyecto.id).then(setCuenta).catch(() => setCuenta({}))
  }, [proyecto.id])

  async function guardarInforme() {
    setGuardando(true)
    setError(null)
    try {
      setInforme(await api.guardarInformeSeo(proyecto.id, activo.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Stack gap="xl">
      <div><Title order={4} mb="xs">Google</Title><Google proyecto={proyecto} activo={activo} cuenta={cuenta} /></div>
      <div><Title order={4} mb="xs">Velocidad</Title><Velocidad proyecto={proyecto} activo={activo} cuenta={cuenta} /></div>
      <div><Title order={4} mb="xs">Salir en las respuestas de las IAs (GEO)</Title><GeoWeb proyecto={proyecto} activo={activo} onPropuesta={onPropuesta} /></div>
      <div><Title order={4} mb="xs">Auditoría</Title><Auditoria proyecto={proyecto} activo={activo} onPropuesta={onPropuesta} /></div>
      <div>
        <Title order={4} mb="xs">Informe mensual</Title>
        <Text fz="13.5px" c="dimmed" mb="xs">
          El día 1 de cada mes se guarda solo el del mes anterior en tus documentos (tipo «Informe SEO»), listo para sacarlo en PDF con tu estilo.
        </Text>
        <Button size="xs" variant="default" onClick={guardarInforme} loading={guardando}>Guardar ya el del mes pasado</Button>
        {informe && <Text fz="13.5px" mt="xs">Guardado en tus documentos como «{informe.nombre}».</Text>}
        {error && <Alert color="red" mt="xs">{error}</Alert>}
      </div>
    </Stack>
  )
}
