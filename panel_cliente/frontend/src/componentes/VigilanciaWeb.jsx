import { useEffect, useState } from "react"
import { Alert, Badge, Box, Button, Group, List, Paper, Select, Stack, Switch, Table, Text, Title } from "@mantine/core"
import { IconDownload, IconRefresh } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import { ESTADOS_VIGILANCIA, FRECUENCIAS } from "../webs"

export function EstadoVigilancia({ estado }) {
  const e = ESTADOS_VIGILANCIA[estado]
  if (!e) return <Badge color="gray" variant="light" radius="sm" tt="none" fw={500}>Sin comprobar</Badge>
  return <Badge color={e.color} variant="light" radius="sm" tt="none" fw={500}>{e.etiqueta}</Badge>
}

function ListaArchivos({ titulo, archivos }) {
  if (!archivos?.length) return null
  return (
    <Text fz="13px">
      <b>{titulo}:</b> {archivos.slice(0, 8).join(", ")}{archivos.length > 8 && ` y ${archivos.length - 8} más`}
    </Text>
  )
}

// Lo que hay debajo del resumen de cada comprobación, para saber qué hacer.
function Detalle({ comprobacion, proyecto, activo, onCambiado, onPropuesta }) {
  const idActivo = activo.id
  const d = comprobacion.detalle || {}
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState(null)

  async function aceptar() {
    try {
      await api.aceptarAdministradores(proyecto.id, idActivo)
      setConfirmar(false)
      onCambiado()
    } catch (err) {
      setError(err.message)
    }
  }

  if (comprobacion.tipo === "wordpress") {
    return (
      <Stack gap={6}>
        {d.nuevos_administradores?.length > 0 && (
          <Alert color="red" title="Administradores nuevos sin revisar">
            <List size="sm" mb="xs">
              {d.nuevos_administradores.map((a) => <List.Item key={a.id}>{a.nombre} (usuario «{a.usuario}»)</List.Item>)}
            </List>
            <Text fz="13px" mb="xs">
              Si no conoces a alguno, puede ser un intruso: bórralo en WordPress y cambia las contraseñas. Si los conoces, dalos por buenos.
            </Text>
            {confirmar ? (
              <Group>
                <Button size="xs" color="red" onClick={aceptar}>Sí, los conozco a todos</Button>
                <Button size="xs" variant="default" onClick={() => setConfirmar(false)}>No</Button>
              </Group>
            ) : (
              <Button size="xs" variant="light" color="red" onClick={() => setConfirmar(true)}>Son de confianza</Button>
            )}
            {error && <Text c="red" fz="13px" mt={4}>{error}</Text>}
          </Alert>
        )}
        {d.vulnerables?.length > 0 && (
          <Table withTableBorder fz="13px" verticalSpacing={4}>
            <Table.Thead><Table.Tr><Table.Th>Plugin</Table.Th><Table.Th>Fallo conocido</Table.Th><Table.Th>Arreglado en</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {d.vulnerables.map((v, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{v.plugin} {v.version}{!v.activo && " (desactivado)"}</Table.Td>
                  <Table.Td>{v.fallo}</Table.Td>
                  <Table.Td>{v.arreglado_en}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {d.desactualizados?.length > 0 && (
          <Text fz="13px" c="dimmed">
            Con versión nueva: {d.desactualizados.map((p) => `${p.plugin} (${p.version} → ${p.ultima})`).join(", ")}
          </Text>
        )}
      </Stack>
    )
  }
  if (comprobacion.tipo === "actualizaciones" && d.pendientes?.length > 0) {
    const puedeProponer = activo.nivel_permiso !== "lectura" && activo.estado !== "pausado"
    async function actualizar(p) {
      try {
        onPropuesta(await api.proponerCambioWeb(proyecto.id, idActivo, {
          operacion: p.tipo === "plugin" ? "wp_actualizar_plugin" : "wp_actualizar_tema", datos: { elemento: p.elemento },
        }))
      } catch (err) {
        setError(err.message)
      }
    }
    return (
      <Stack gap={4}>
        {d.pendientes.map((p) => (
          <Group key={p.elemento} gap="xs">
            <Text fz="13px">{p.nombre}: {p.version} → {p.version_nueva}{!p.activo && " (desactivado)"}</Text>
            {puedeProponer && <Button size="compact-xs" variant="light" onClick={() => actualizar(p)}>Actualizar</Button>}
          </Group>
        ))}
        {!puedeProponer && <Text fz="12px" c="dimmed">Para actualizar desde aquí, la web no puede estar en solo lectura.</Text>}
        {error && <Text c="red" fz="13px">{error}</Text>}
      </Stack>
    )
  }
  if (comprobacion.tipo === "cloudflare" && d.nivel_seguridad) {
    const atacado = d.nivel_seguridad === "under_attack"
    const puedeProponer = activo.nivel_permiso !== "lectura" && activo.estado !== "pausado"
    async function cambiarNivel() {
      try {
        onPropuesta(await api.proponerCambioWeb(proyecto.id, idActivo, {
          operacion: "cf_nivel_seguridad", datos: { nivel: atacado ? "medium" : "under_attack" },
        }))
      } catch (err) {
        setError(err.message)
      }
    }
    return (
      <Stack gap={4}>
        <Text fz="13px" c="dimmed">
          {atacado
            ? "El modo «estoy siendo atacado» frena los ataques pero hace esperar unos segundos a cada visitante: quítalo cuando pase."
            : "Si la web está recibiendo un ataque (va muy lenta o se cae por exceso de visitas falsas), activa el modo «estoy siendo atacado»."}
        </Text>
        {puedeProponer && (
          <Group><Button size="compact-xs" variant="light" color={atacado ? "gray" : "red"} onClick={cambiarNivel}>
            {atacado ? "Volver al nivel normal" : "Activar «estoy siendo atacado»"}
          </Button></Group>
        )}
        {error && <Text c="red" fz="13px">{error}</Text>}
      </Stack>
    )
  }
  if (comprobacion.tipo === "integridad") {
    return (
      <Stack gap={2}>
        <ListaArchivos titulo="Modificados" archivos={d.modificados} />
        <ListaArchivos titulo="Que no son de WordPress" archivos={d.sobran} />
        <ListaArchivos titulo="PHP en subidas" archivos={d.php_en_subidas} />
        <ListaArchivos titulo="Faltan" archivos={d.faltan} />
      </Stack>
    )
  }
  if (comprobacion.tipo === "errores" && d.nuevos?.length > 0) {
    return (
      <Box component="pre" fz="11.5px" m={0} p="xs" bg="var(--mantine-color-gray-0)" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 180, overflow: "auto" }}>
        {d.nuevos.join("\n")}
      </Box>
    )
  }
  if (comprobacion.tipo === "cabeceras" && d.faltan?.length > 0) {
    return (
      <Text fz="13px" c="dimmed">
        Las pone quien mantiene el servidor o un plugin de seguridad. Para qué sirven: {d.faltan.map((f) => `${f.cabecera}, ${f.para_que}`).join("; ")}.
      </Text>
    )
  }
  if (comprobacion.tipo === "archivos_expuestos" && d.encontrados?.length > 0) {
    return <Text fz="13px" c="red">Hay que borrarlos del servidor o bloquearlos cuanto antes: cualquiera puede descargarlos.</Text>
  }
  return null
}

// Instrucciones para instalar el conector, solo en webs WordPress que no lo tienen
function InstalarConector({ proyecto }) {
  const [error, setError] = useState(null)
  async function descargar() {
    try {
      const blob = await api.descargarConectorBlob(proyecto.id)
      const enlace = document.createElement("a")
      enlace.href = URL.createObjectURL(blob)
      enlace.download = "multiplika-conector.zip"
      enlace.click()
      URL.revokeObjectURL(enlace.href)
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <Alert color="blue" title="Instala el conector de Multiplika para vigilar más a fondo">
      <Text fz="13.5px" mb="xs">
        Con él, la gestión documental puede además hacer copias de seguridad, comprobar si alguien ha modificado los archivos
        de WordPress (señal de hackeo), leer los errores de la web y actualizar plugins con vuelta atrás si algo se rompe.
      </Text>
      <List size="sm" mb="sm" type="ordered">
        <List.Item>Descarga el conector con el botón de abajo.</List.Item>
        <List.Item>En tu WordPress: Plugins → Añadir nuevo → Subir plugin, elige el archivo y actívalo.</List.Item>
        <List.Item>
          La credencial de esta web tiene que ser de un usuario <b>administrador</b> de WordPress (el conector solo atiende a
          administradores).
        </List.Item>
        <List.Item>Vuelve aquí y pulsa «Probar conexión».</List.Item>
      </List>
      <Button size="xs" leftSection={<IconDownload size={14} />} onClick={descargar}>Descargar el conector</Button>
      {error && <Text c="red" fz="13px" mt={4}>{error}</Text>}
    </Alert>
  )
}

export default function VigilanciaWeb({ proyecto, activo, refresco, onPropuesta }) {
  const [comprobaciones, setComprobaciones] = useState(null)
  const [historial, setHistorial] = useState([])
  const [comprobando, setComprobando] = useState(null)
  const [error, setError] = useState(null)

  function cargar() {
    api.estadoVigilancia(proyecto.id, activo.id).then(setComprobaciones).catch((err) => setError(err.message))
    api.historialVigilancia(proyecto.id, activo.id).then(setHistorial).catch(() => setHistorial([]))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, activo.id, refresco])

  async function comprobar(tipo) {
    setComprobando(tipo || "todas")
    setError(null)
    try {
      await api.comprobarAhora(proyecto.id, activo.id, tipo)
      cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setComprobando(null)
    }
  }

  async function configurar(tipo, datos) {
    try {
      await api.configurarVigilancia(proyecto.id, activo.id, tipo, datos)
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!activo.url) return <Text c="dimmed">Esta cuenta no tiene dirección: no hay nada que vigilar.</Text>
  if (!comprobaciones) return error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fz="13.5px" c="dimmed" maw={620}>
          Se comprueba sola cada cierto tiempo. Si algo grave falla se avisa en el momento (notificaciones y correo) a quienes
          pueden editar; lo demás llega en el resumen de los lunes. {activo.estado === "pausado" && "Ahora está en pausa: no se vigila."}
        </Text>
        <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => comprobar(null)} loading={comprobando === "todas"}>
          Comprobar todo ahora
        </Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      {activo.capacidad === "wordpress" && !activo.conector_instalado && <InstalarConector proyecto={proyecto} />}
      {comprobaciones.map((c) => (
        <Paper key={c.tipo} withBorder radius="md" p="sm" style={{ opacity: c.activa ? 1 : 0.55 }}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs">
                <Text fw={600} fz="14px">{c.titulo}</Text>
                <EstadoVigilancia estado={c.activa ? c.estado : null} />
              </Group>
              <Text fz="13.5px">{c.activa ? c.resumen || "Todavía no se ha comprobado." : "Desactivada."}</Text>
              {c.ultima && <Text fz="12px" c="dimmed">Última vez: {formatearFecha(c.ultima)}</Text>}
              {c.activa && <Detalle comprobacion={c} proyecto={proyecto} activo={activo} onCambiado={cargar} onPropuesta={onPropuesta} />}
            </Stack>
            <Stack gap={6} align="flex-end">
              <Button size="xs" variant="subtle" onClick={() => comprobar(c.tipo)} loading={comprobando === c.tipo} disabled={!c.activa}>
                Comprobar
              </Button>
              {proyecto.es_admin && (<>
                {c.tipo !== "copias" && <Select
                  size="xs" w={170} data={FRECUENCIAS} value={String(c.cada_minutos)} allowDeselect={false}
                  onChange={(v) => configurar(c.tipo, { cada_minutos: Number(v) })}
                />}
                <Switch size="xs" label="Activa" checked={c.activa} onChange={(e) => configurar(c.tipo, { activa: e.currentTarget.checked })} />
              </>)}
            </Stack>
          </Group>
        </Paper>
      ))}
      <div>
        <Title order={5} mb="xs">Problemas de los últimos 30 días</Title>
        {historial.length === 0 ? (
          <Text c="dimmed" fz="13.5px">Ninguno.</Text>
        ) : (
          <Table striped fz="13px" verticalSpacing={4}>
            <Table.Tbody>
              {historial.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td w={140}>{formatearFecha(h.fecha)}</Table.Td>
                  <Table.Td w={220}>{h.titulo}</Table.Td>
                  <Table.Td><EstadoVigilancia estado={h.estado} /></Table.Td>
                  <Table.Td>{h.resumen}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </Stack>
  )
}
