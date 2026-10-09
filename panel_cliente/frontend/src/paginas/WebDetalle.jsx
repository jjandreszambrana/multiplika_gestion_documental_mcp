import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Button, Group, Menu, Modal, NumberInput, Pagination, Paper, SegmentedControl, Select,
  Stack, Switch, Table, Tabs, Text, TextInput, Textarea, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconDots, IconPlugConnected, IconPlus, IconRefresh, IconSearch, IconUpload } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import CambioWeb, { EstadoCambio } from "../componentes/CambioWeb"
import FormularioActivo from "../componentes/FormularioActivo"
import VigilanciaWeb from "../componentes/VigilanciaWeb"
import CopiasWeb from "../componentes/CopiasWeb"
import SeoWeb from "../componentes/SeoWeb"
import BaseDatosWeb from "../componentes/BaseDatosWeb"
import RedWeb from "../componentes/RedWeb"
import FicherosWeb from "../componentes/FicherosWeb"
import { ESTADOS_CAMBIO, MODOS, NIVELES, PLATAFORMAS } from "../webs"

const TIPOS_CONTENIDO = [
  { value: "entradas", label: "Entradas" },
  { value: "paginas", label: "Páginas" },
  { value: "comentarios", label: "Comentarios" },
  { value: "medios", label: "Medios" },
  { value: "plugins", label: "Plugins" },
  { value: "usuarios", label: "Usuarios" },
]
const ESTADOS_FILTRO = {
  entradas: ["borrador", "publicado", "pendiente", "privado", "programado"],
  paginas: ["borrador", "publicado", "pendiente", "privado"],
  comentarios: ["aprobado", "retenido", "spam", "papelera"],
  plugins: ["activo", "inactivo"],
}
const ESTADOS_PUBLICACION = [
  { value: "borrador", label: "Borrador" }, { value: "publicado", label: "Publicado" },
  { value: "pendiente", label: "Pendiente de revisión" }, { value: "privado", label: "Privado" },
]
const MODERAR = [
  { estado: "aprobado", etiqueta: "Aprobar" }, { estado: "retenido", etiqueta: "Retener" },
  { estado: "spam", etiqueta: "Marcar como spam" }, { estado: "papelera", etiqueta: "Mandar a la papelera" },
]

// Edición o alta de una entrada/página: guarda una PROPUESTA (no toca la
// web) y la vista previa decide si se aplica.
function EditorPublicacion({ proyecto, activo, tipo, idObjeto, onPropuesta, onCerrar }) {
  const [datos, setDatos] = useState(idObjeto ? null : { titulo: "", contenido: "", extracto: "", estado: "borrador", slug: "" })
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!idObjeto) return
    api.obtenerContenidoWeb(proyecto.id, activo.id, tipo, idObjeto)
      .then((o) => setDatos({ titulo: o.titulo || "", contenido: o.contenido || "", extracto: o.extracto || "", estado: o.estado, slug: o.slug || "" }))
      .catch((err) => setError(err.message))
  }, [proyecto.id, activo.id, tipo, idObjeto])

  async function proponer(evento) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    const operacion = `wp_${idObjeto ? "editar" : "crear"}_${tipo === "entradas" ? "entrada" : "pagina"}`
    const cuerpo = Object.fromEntries(Object.entries(datos).filter(([k, v]) => idObjeto || v !== "" || k === "titulo"))
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, activo.id, { operacion, datos: cuerpo, id_objeto: idObjeto, motivo: motivo || null }))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e?.target ? e.target.value : e }))
  return (
    <Modal opened onClose={onCerrar} size="xl" title={<Text fw={600}>{idObjeto ? "Editar" : tipo === "entradas" ? "Nueva entrada" : "Nueva página"}</Text>}>
      {!datos ? (
        error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>
      ) : (
        <Stack component="form" onSubmit={proponer} gap="sm">
          <TextInput label="Título" required value={datos.titulo} onChange={cambiar("titulo")} />
          <Group grow>
            <Select label="Estado" data={ESTADOS_PUBLICACION} value={datos.estado} onChange={cambiar("estado")} allowDeselect={false} />
            <TextInput label="Dirección (slug)" placeholder="se genera sola si se deja vacía" value={datos.slug} onChange={cambiar("slug")} />
          </Group>
          <Textarea label="Extracto" autosize minRows={2} value={datos.extracto} onChange={cambiar("extracto")} />
          <Textarea
            label="Contenido" description="Tal cual lo guarda WordPress (HTML). Si no estás seguro, pídeselo a tu IA."
            autosize minRows={8} maxRows={20} styles={{ input: { fontFamily: "monospace", fontSize: 12.5 } }}
            value={datos.contenido} onChange={cambiar("contenido")}
          />
          <TextInput label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" loading={enviando}>Ver cómo quedaría</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}

function SubirMedio({ proyecto, activo, onPropuesta, onCerrar }) {
  const [documentos, setDocumentos] = useState([])
  const [idDocumento, setIdDocumento] = useState(null)
  const [textoAlternativo, setTextoAlternativo] = useState("")
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    api.listarOBuscarDocumentos(proyecto.id).then((d) => setDocumentos(d.filter((x) => !x.archivado))).catch((err) => setError(err.message))
  }, [proyecto.id])

  async function proponer() {
    setEnviando(true)
    setError(null)
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, activo.id, {
        operacion: "wp_subir_medio", datos: { id_documento: Number(idDocumento), texto_alternativo: textoAlternativo || null },
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal opened onClose={onCerrar} title={<Text fw={600}>Subir a la biblioteca de medios</Text>}>
      <Stack gap="sm">
        <Select
          label="Documento" description="Se sube el archivo original adjunto al documento (p. ej. una foto)." searchable
          data={documentos.map((d) => ({ value: String(d.id), label: d.nombre }))} value={idDocumento} onChange={setIdDocumento}
        />
        <TextInput label="Texto alternativo" description="Describe la imagen: ayuda a la accesibilidad y al posicionamiento en Google." value={textoAlternativo} onChange={(e) => setTextoAlternativo(e.target.value)} />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={proponer} disabled={!idDocumento} loading={enviando}>Ver cómo quedaría</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function Contenido({ proyecto, activo, refresco, onPropuesta }) {
  const [tipo, setTipo] = useState("entradas")
  const [buscar, setBuscar] = useState("")
  const [estado, setEstado] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [editor, setEditor] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const puedeProponer = activo.nivel_permiso !== "lectura" && activo.estado !== "pausado" && !activo.archivado

  function cargar(t = tipo, b = buscar, e = estado, p = pagina) {
    setCargando(true)
    setError(null)
    api.listarContenidoWeb(proyecto.id, activo.id, t, b, e, p)
      .then(setFilas)
      .catch((err) => { setError(err.message); setFilas([]) })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo.id, refresco])

  function cambiarTipo(t) {
    setTipo(t); setEstado(null); setPagina(1); setFilas(null)
    cargar(t, buscar, null, 1)
  }

  async function moderar(comentario, nuevoEstado) {
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, activo.id, {
        operacion: "wp_moderar_comentario", datos: { estado: nuevoEstado }, id_objeto: comentario.id,
      }))
    } catch (err) {
      setError(err.message)
    }
  }

  const esPublicacion = tipo === "entradas" || tipo === "paginas"
  return (
    <Stack gap="sm">
      <SegmentedControl data={TIPOS_CONTENIDO} value={tipo} onChange={cambiarTipo} />
      <Group component="form" onSubmit={(e) => { e.preventDefault(); setPagina(1); cargar(tipo, buscar, estado, 1) }}>
        {tipo !== "plugins" && (
          <TextInput placeholder="Buscar" leftSection={<IconSearch size={15} />} value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ flex: 1, maxWidth: 300 }} />
        )}
        {ESTADOS_FILTRO[tipo] && (
          <Select
            placeholder={tipo === "comentarios" ? "Aprobados" : "Todos"} clearable w={170}
            data={ESTADOS_FILTRO[tipo]} value={estado} onChange={(v) => { setEstado(v); setPagina(1); cargar(tipo, buscar, v, 1) }}
          />
        )}
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={() => cargar()} loading={cargando}><IconRefresh size={17} /></ActionIcon>
        </Tooltip>
        {puedeProponer && esPublicacion && (
          <Button ml="auto" variant="light" leftSection={<IconPlus size={15} />} onClick={() => setEditor({ idObjeto: null })}>
            {tipo === "entradas" ? "Nueva entrada" : "Nueva página"}
          </Button>
        )}
        {puedeProponer && tipo === "medios" && (
          <Button ml="auto" variant="light" leftSection={<IconUpload size={15} />} onClick={() => setSubiendo(true)}>Subir desde un documento</Button>
        )}
      </Group>
      {!puedeProponer && (
        <Text fz="12.5px" c="dimmed">
          {activo.estado === "pausado" ? "En pausa: solo se puede consultar." : "En solo lectura: se puede consultar, pero no proponer cambios."}
        </Text>
      )}
      {error && <Alert color="red">{error}</Alert>}
      {!filas ? (
        <Text>Cargando...</Text>
      ) : filas.length === 0 ? (
        <Text c="dimmed">No hay nada que mostrar.</Text>
      ) : (
        <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Tbody>
              {filas.map((f) => (
                <Table.Tr
                  key={f.id || f.plugin}
                  style={{ cursor: esPublicacion && puedeProponer ? "pointer" : "default" }}
                  onClick={() => esPublicacion && puedeProponer && setEditor({ idObjeto: f.id })}
                >
                  {esPublicacion && (<>
                    <Table.Td><Text fz="13.5px" fw={500}>{f.titulo || "(sin título)"}</Text></Table.Td>
                    <Table.Td><Badge variant="light" color="gray" tt="none">{f.estado}</Badge></Table.Td>
                    <Table.Td><Text fz="12.5px" c="dimmed">{formatearFecha(f.modificado)}</Text></Table.Td>
                  </>)}
                  {tipo === "comentarios" && (<>
                    <Table.Td w={160}><Text fz="13px" fw={500}>{f.autor || "Anónimo"}</Text><Text fz="12px" c="dimmed">{formatearFecha(f.fecha)}</Text></Table.Td>
                    <Table.Td><Text fz="13px">{f.texto}</Text></Table.Td>
                    <Table.Td w={50}>
                      {puedeProponer && (
                        <Menu position="bottom-end">
                          <Menu.Target><ActionIcon variant="subtle" color="gray"><IconDots size={16} /></ActionIcon></Menu.Target>
                          <Menu.Dropdown>
                            {MODERAR.filter((m) => m.estado !== f.estado).map((m) => (
                              <Menu.Item key={m.estado} onClick={() => moderar(f, m.estado)}>{m.etiqueta}</Menu.Item>
                            ))}
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </Table.Td>
                  </>)}
                  {tipo === "medios" && (<>
                    <Table.Td><Text fz="13.5px">{f.titulo}</Text></Table.Td>
                    <Table.Td><Text fz="12.5px" c="dimmed">{f.tipo}</Text></Table.Td>
                    <Table.Td><Anchor href={f.direccion} target="_blank" fz="12.5px">Ver</Anchor></Table.Td>
                  </>)}
                  {tipo === "plugins" && (<>
                    <Table.Td><Text fz="13.5px" fw={500}>{f.nombre}</Text></Table.Td>
                    <Table.Td><Text fz="12.5px">{f.version}</Text></Table.Td>
                    <Table.Td><Badge variant="light" color={f.estado === "activo" ? "teal" : "gray"} tt="none">{f.estado}</Badge></Table.Td>
                  </>)}
                  {tipo === "usuarios" && (<>
                    <Table.Td><Text fz="13.5px" fw={500}>{f.nombre}</Text><Text fz="12px" c="dimmed">{f.usuario}</Text></Table.Td>
                    <Table.Td><Text fz="12.5px">{(f.roles || []).join(", ")}</Text></Table.Td>
                  </>)}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      {tipo !== "plugins" && filas && (filas.length === 20 || pagina > 1) && (
        <Pagination total={filas.length === 20 ? pagina + 1 : pagina} value={pagina} onChange={(p) => { setPagina(p); cargar(tipo, buscar, estado, p) }} size="sm" />
      )}
      {editor && (
        <EditorPublicacion
          proyecto={proyecto} activo={activo} tipo={tipo} idObjeto={editor.idObjeto}
          onCerrar={() => setEditor(null)} onPropuesta={(c) => { setEditor(null); onPropuesta(c) }}
        />
      )}
      {subiendo && (
        <SubirMedio proyecto={proyecto} activo={activo} onCerrar={() => setSubiendo(false)} onPropuesta={(c) => { setSubiendo(false); onPropuesta(c) }} />
      )}
    </Stack>
  )
}

function Cambios({ proyecto, activo, version, refresco, onAbrir }) {
  const [estado, setEstado] = useState(null)
  const [cambios, setCambios] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listarCambiosWeb(proyecto.id, activo.id, estado).then(setCambios).catch((err) => setError(err.message))
  }, [proyecto.id, activo.id, estado, version, refresco])

  return (
    <Stack gap="sm">
      <Select
        placeholder="Todos los estados" clearable w={220} value={estado} onChange={setEstado}
        data={Object.entries(ESTADOS_CAMBIO).filter(([k]) => !["aplicando", "deshaciendo"].includes(k)).map(([value, e]) => ({ value, label: e.etiqueta }))}
      />
      {error && <Alert color="red">{error}</Alert>}
      {!cambios ? (
        <Text>Cargando...</Text>
      ) : cambios.length === 0 ? (
        <Text c="dimmed">Todavía no hay ningún cambio propuesto.</Text>
      ) : (
        <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr><Table.Th>Fecha</Table.Th><Table.Th>Cambio</Table.Th><Table.Th>Propuesto por</Table.Th><Table.Th>Estado</Table.Th></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cambios.map((c) => (
                <Table.Tr key={c.id} onClick={() => onAbrir(c)} style={{ cursor: "pointer" }}>
                  <Table.Td w={140}><Text fz="12.5px" c="dimmed">{formatearFecha(c.fecha_propuesta)}</Text></Table.Td>
                  <Table.Td><Text fz="13.5px">{c.resumen}</Text></Table.Td>
                  <Table.Td><Text fz="12.5px">{c.propuesto_por}</Text></Table.Td>
                  <Table.Td><EstadoCambio estado={c.estado} /></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  )
}

// Un ajuste según su tipo (número, sí/no, opción, texto o credencial)
function Ajuste({ ajuste, valor, credenciales, deshabilitado, sinConector, onChange }) {
  const comun = {
    label: ajuste.titulo, disabled: deshabilitado,
    description: sinConector ? `${ajuste.descripcion} (Necesita el conector de Multiplika instalado.)` : ajuste.descripcion,
  }
  if (ajuste.tipo === "si_no") {
    return <Switch {...comun} checked={!!valor} onChange={(e) => onChange(e.currentTarget.checked)} />
  }
  if (ajuste.tipo === "opcion") {
    return (
      <Select {...comun} allowDeselect={false} value={valor}
        data={Object.entries(ajuste.opciones).map(([value, label]) => ({ value, label }))} onChange={onChange} />
    )
  }
  if (ajuste.tipo === "credencial") {
    return (
      <Select {...comun} clearable searchable value={valor || null} onChange={(v) => onChange(v || null)}
        data={credenciales.map((c) => c.nombre)} nothingFoundMessage="Créala antes en Administración → Credenciales" />
    )
  }
  if (ajuste.tipo === "texto") {
    return <TextInput {...comun} value={valor || ""} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <NumberInput {...comun} min={ajuste.minimo} max={ajuste.maximo} value={valor}
      onChange={(v) => onChange(v === "" ? null : v)} />
  )
}

function DatosYAjustes({ proyecto, activo, catalogo, onCambiado }) {
  const [editando, setEditando] = useState(false)
  const [credenciales, setCredenciales] = useState([])

  useEffect(() => {
    if (proyecto.es_admin) api.listarCredenciales(proyecto.id).then(setCredenciales).catch(() => setCredenciales([]))
  }, [proyecto.id, proyecto.es_admin])
  const [ajustes, setAjustes] = useState(activo.ajustes)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const nivel = NIVELES[activo.nivel_permiso]

  async function guardarAjustes() {
    setGuardando(true)
    setError(null)
    try {
      onCambiado(await api.actualizarAjustesActivo(proyecto.id, activo.id, ajustes))
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function archivar(archivado) {
    try {
      onCambiado(await api.actualizarActivo(proyecto.id, activo.id, { archivado }))
    } catch (err) {
      setError(err.message)
    }
  }

  if (editando) {
    return (
      <FormularioActivo
        proyecto={proyecto} activo={activo} catalogo={catalogo} onCancelar={() => setEditando(false)}
        onGuardado={(a) => { setEditando(false); onCambiado(a) }}
      />
    )
  }
  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md">
        <Stack gap={6}>
          <Text fz="13.5px"><b>Plataforma:</b> {PLATAFORMAS[activo.plataforma] || activo.plataforma}</Text>
          <Text fz="13.5px"><b>Credencial:</b> {activo.nombre_credencial || "ninguna"}</Text>
          {activo.modo_conexion && <Text fz="13.5px"><b>Forma de conectar:</b> {MODOS[activo.modo_conexion] || activo.modo_conexion}</Text>}
          {activo.capacidad === "wordpress" && (
            <Text fz="13.5px"><b>Conector de Multiplika:</b> {activo.conector_instalado ? "instalado" : "no instalado (o falta probar la conexión)"}</Text>
          )}
          <Text fz="13.5px"><b>Entidad:</b> {activo.nombre_entidad || "ninguna"}</Text>
          <Text fz="13.5px"><b>Qué puede hacer la IA:</b> {nivel?.etiqueta}. <Text span c="dimmed" fz="13px">{nivel?.ayuda}</Text></Text>
          {activo.descripcion && <Text fz="13.5px"><b>Descripción:</b> {activo.descripcion}</Text>}
          {activo.fecha_ultima_conexion && <Text fz="12.5px" c="dimmed">Última prueba de conexión: {formatearFecha(activo.fecha_ultima_conexion)}</Text>}
        </Stack>
        {proyecto.es_admin && (
          <Group mt="md">
            <Button variant="light" onClick={() => setEditando(true)}>Editar</Button>
            <Button variant="subtle" color="gray" onClick={() => archivar(!activo.archivado)}>{activo.archivado ? "Desarchivar" : "Archivar"}</Button>
          </Group>
        )}
      </Paper>
      <div>
        <Title order={4} mb="xs">Ajustes</Title>
        <Stack gap="sm" maw={520}>
          {(catalogo?.ajustes || []).filter((a) => (activo.ajustes_disponibles || []).includes(a.clave)).map((a) => (
            <Ajuste
              key={a.clave} ajuste={a} valor={ajustes[a.clave]} credenciales={credenciales}
              deshabilitado={!proyecto.es_admin} sinConector={a.necesita_conector && !activo.conector_instalado}
              onChange={(v) => setAjustes((x) => ({ ...x, [a.clave]: v }))}
            />
          ))}
          {error && <Alert color="red">{error}</Alert>}
          {proyecto.es_admin && (
            <Group><Button onClick={guardarAjustes} loading={guardando}>Guardar ajustes</Button></Group>
          )}
        </Stack>
      </div>
    </Stack>
  )
}

export default function WebDetalle({ proyecto, idActivo, onVolver }) {
  const [activo, setActivo] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [error, setError] = useState(null)
  const [prueba, setPrueba] = useState(null)
  const [probando, setProbando] = useState(false)
  const [cambioAbierto, setCambioAbierto] = useState(null)
  const [pestana, setPestana] = useState(null)
  const [version, setVersion] = useState(0)
  const [refresco, setRefresco] = useState(0)
  const [refrescando, setRefrescando] = useState(false)

  function cargar() {
    return api.obtenerActivo(proyecto.id, idActivo).then(setActivo).catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    api.catalogoActivos(proyecto.id).then(setCatalogo).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, idActivo])

  function recargar() {
    setRefrescando(true)
    setRefresco((r) => r + 1)
    cargar().finally(() => setRefrescando(false))
  }

  async function probar() {
    setProbando(true)
    try {
      setPrueba(await api.probarConexionActivo(proyecto.id, idActivo))
      cargar()
    } catch (err) {
      setPrueba({ ok: false, error: err.message })
    } finally {
      setProbando(false)
    }
  }

  function trasCambio(cambio) {
    setCambioAbierto(cambio)
    setVersion((v) => v + 1)
    cargar()
  }

  if (!activo) return error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>
  const PRIMERA = { bd: "bd", red: "publicaciones", ficheros: "ficheros" }
  const pestanaActual = pestana || (activo.url ? "vigilancia" : PRIMERA[activo.capacidad] || "datos")

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="lg" display="flex" style={{ alignItems: "center", gap: 6 }} underline="hover" c="dimmed" fz="13.5px" fw={500}>
        <IconArrowLeft size={15} stroke={2} />
        Webs y redes
      </Anchor>
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Group gap="xs" mb={4}>
            <Title order={2}>{activo.nombre}</Title>
            <Badge color={NIVELES[activo.nivel_permiso]?.color} variant="light" tt="none">{NIVELES[activo.nivel_permiso]?.etiqueta}</Badge>
            {activo.estado === "pausado" && <Badge color="gray" variant="light" tt="none">En pausa</Badge>}
            {activo.archivado && <Badge color="gray" tt="none">Archivada</Badge>}
          </Group>
          {activo.url && <Anchor href={activo.url} target="_blank" fz="13.5px">{activo.url}</Anchor>}
        </div>
        <Group gap="xs">
          <Tooltip label="Refrescar">
            <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={refrescando}>
              <IconRefresh size={17} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
          {activo.conectable && (
            <Button variant="default" leftSection={<IconPlugConnected size={16} />} onClick={probar} loading={probando}>Probar conexión</Button>
          )}
        </Group>
      </Group>
      {prueba && (
        <Alert color={prueba.ok ? "teal" : "red"} mb="md" withCloseButton onClose={() => setPrueba(null)}>
          {prueba.ok
            ? prueba.tablas != null ? `Conectado: la base de datos tiene ${prueba.tablas} tablas.`
              : prueba.mensaje ? prueba.mensaje
              : `Conectado a «${prueba.sitio?.nombre}» como ${prueba.usuario?.nombre} (${(prueba.usuario?.roles || []).join(", ")}).`
            : prueba.error}
        </Alert>
      )}
      {!prueba && activo.estado === "error" && activo.ultimo_error && (
        <Alert color="red" mb="md">Falló la última conexión: {activo.ultimo_error}</Alert>
      )}
      {!activo.conectable && (
        <Alert color="gray" mb="md">
          La gestión documental todavía no se conecta con esta plataforma: queda en el inventario y se podrá conectar cuando esté disponible.
        </Alert>
      )}

      <Tabs value={pestanaActual} onChange={setPestana}>
        <Tabs.List mb="md">
          {activo.url && <Tabs.Tab value="vigilancia">Vigilancia</Tabs.Tab>}
          {activo.url && <Tabs.Tab value="seo">SEO</Tabs.Tab>}
          {activo.capacidad === "wordpress" && <Tabs.Tab value="contenido">Contenido</Tabs.Tab>}
          {activo.capacidad === "bd" && <Tabs.Tab value="bd">Base de datos</Tabs.Tab>}
          {activo.capacidad === "red" && <Tabs.Tab value="publicaciones">Publicaciones</Tabs.Tab>}
          {activo.capacidad === "ficheros" && <Tabs.Tab value="ficheros">Archivos</Tabs.Tab>}
          {activo.conector_instalado && <Tabs.Tab value="copias">Copias</Tabs.Tab>}
          <Tabs.Tab value="cambios" rightSection={activo.propuestas_pendientes > 0 ? <Badge size="xs" circle>{activo.propuestas_pendientes}</Badge> : null}>
            Cambios
          </Tabs.Tab>
          <Tabs.Tab value="datos">Datos y ajustes</Tabs.Tab>
        </Tabs.List>
        {activo.url && (
          <Tabs.Panel value="vigilancia"><VigilanciaWeb proyecto={proyecto} activo={activo} refresco={refresco} onPropuesta={trasCambio} /></Tabs.Panel>
        )}
        {activo.capacidad === "ficheros" && (
          <Tabs.Panel value="ficheros"><FicherosWeb proyecto={proyecto} activo={activo} refresco={refresco} onPropuesta={trasCambio} /></Tabs.Panel>
        )}
        {activo.capacidad === "red" && (
          <Tabs.Panel value="publicaciones"><RedWeb proyecto={proyecto} activo={activo} refresco={refresco} onPropuesta={trasCambio} /></Tabs.Panel>
        )}
        {activo.capacidad === "bd" && (
          <Tabs.Panel value="bd"><BaseDatosWeb proyecto={proyecto} activo={activo} refresco={refresco} /></Tabs.Panel>
        )}
        {activo.capacidad === "wordpress" && (
          <Tabs.Panel value="contenido"><Contenido proyecto={proyecto} activo={activo} refresco={refresco} onPropuesta={trasCambio} /></Tabs.Panel>
        )}
        {activo.url && (
          <Tabs.Panel value="seo"><SeoWeb proyecto={proyecto} activo={activo} refresco={refresco} onPropuesta={trasCambio} /></Tabs.Panel>
        )}
        {activo.conector_instalado && (
          <Tabs.Panel value="copias"><CopiasWeb proyecto={proyecto} activo={activo} refresco={refresco} onPropuesta={trasCambio} /></Tabs.Panel>
        )}
        <Tabs.Panel value="cambios"><Cambios proyecto={proyecto} activo={activo} version={version} refresco={refresco} onAbrir={setCambioAbierto} /></Tabs.Panel>
        <Tabs.Panel value="datos">
          <DatosYAjustes proyecto={proyecto} activo={activo} catalogo={catalogo} onCambiado={() => cargar()} />
        </Tabs.Panel>
      </Tabs>

      {cambioAbierto && (
        <CambioWeb
          proyecto={proyecto} cambio={cambioAbierto} nivel={activo.nivel_permiso}
          onCerrar={() => setCambioAbierto(null)} onCambiado={trasCambio}
        />
      )}
    </>
  )
}
