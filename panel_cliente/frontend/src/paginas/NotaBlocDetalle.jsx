import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Box, Button, CheckIcon, CloseButton, ColorSwatch, Group, Modal, MultiSelect, Paper, SegmentedControl, Select,
  Stack, Switch, TagsInput, Text, TextInput, Title, Tooltip, useComputedColorScheme,
} from "@mantine/core"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import {
  IconAlarm, IconArchive, IconArchiveOff, IconArrowLeft, IconEdit, IconLink, IconPin, IconPinFilled, IconPlus, IconTrash,
} from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import FormularioProgramacion from "../componentes/FormularioProgramacion"
import ControlSeguimiento from "../componentes/Seguimiento"
import { COLORES, VISIBILIDADES } from "../componentes/TarjetaNotaBloc"
import { COLOR_ESTADO, formatearFecha } from "../formato"

const TIPOS_ENLACE = [
  { value: "nota", label: "Otra nota" },
  { value: "documento", label: "Documento" },
  { value: "registro", label: "Registro de datos" },
  { value: "entidad", label: "Entidad" },
]

// Nombre del campo con el que se enlaza ya al crear la nota
const CAMPO_ENLACE = { nota: "ids_notas", documento: "ids_documentos", registro: "ids_registros", entidad: "ids_entidades" }

// "2026-10-01T09:30:00" → "2026-10-01T09:30", lo que pide un <input type="datetime-local">
function paraInputFecha(valor) {
  if (valor) return String(valor).slice(0, 16)
  const d = new Date()
  const dos = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

function formularioDe(nota) {
  return {
    titulo: nota?.titulo || "",
    fecha: paraInputFecha(nota?.fecha),
    descripcion: nota?.descripcion || "",
    contenido: nota?.contenido || "",
    etiquetas: nota?.etiquetas || [],
    visibilidad: nota?.visibilidad || "todos",
    idsPersonas: (nota?.personas || []).map((p) => String(p.id)),
    fijada: nota?.fijada || false,
    color: nota?.color || null,
  }
}

// Elegir el distintivo de color: uno de la lista o ninguno
function SelectorColor({ valor, onChange }) {
  return (
    <div>
      <Text size="sm" fw={500} mb={6}>Color</Text>
      <Group gap="xs">
        <Tooltip label="Sin color">
          <ColorSwatch
            component="button" type="button" color="transparent" withShadow={false}
            style={{ cursor: "pointer", border: "1px dashed var(--mantine-color-gray-5)" }}
            onClick={() => onChange(null)}
          >
            {!valor && <CheckIcon size={11} />}
          </ColorSwatch>
        </Tooltip>
        {COLORES.map((c) => (
          <Tooltip key={c.value} label={c.label}>
            <ColorSwatch
              component="button" type="button" color={`var(--mantine-color-${c.value}-6)`}
              style={{ cursor: "pointer", color: "white" }} onClick={() => onChange(c.value)}
            >
              {valor === c.value && <CheckIcon size={11} />}
            </ColorSwatch>
          </Tooltip>
        ))}
      </Group>
    </div>
  )
}

// Añadir un enlace: a otra nota, a un documento, a un registro de datos o a una entidad.
function ModalEnlace({ opened, proyecto, idNota, onClose, onEnlazar }) {
  const [tipo, setTipo] = useState("nota")
  const [opciones, setOpciones] = useState([])
  const [modelos, setModelos] = useState([])
  const [idModelo, setIdModelo] = useState(null)
  const [elegido, setElegido] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!opened) return
    setElegido(null)
    setError(null)
    setOpciones([])
    if (tipo === "nota") {
      api.listarNotasBloc(proyecto.id, { archivadas: "todas" })
        .then((notas) => setOpciones(notas.filter((n) => n.id !== idNota).map((n) => ({
          value: String(n.id), label: `${n.titulo} (${formatearFecha(n.fecha).slice(0, 10)})`,
        }))))
        .catch((err) => setError(err.message))
    } else if (tipo === "documento") {
      api.listarOBuscarDocumentos(proyecto.id, "")
        .then((docs) => setOpciones(docs.map((d) => ({ value: String(d.id), label: `${d.nombre} (${d.tipo_documento})` }))))
        .catch((err) => setError(err.message))
    } else if (tipo === "entidad") {
      api.listarEntidades(proyecto.id)
        .then((filas) => setOpciones(filas.map((e) => ({ value: String(e.id), label: `${e.nombre} (${e.tipo})` }))))
        .catch((err) => setError(err.message))
    } else {
      api.listarModelosRegistro(proyecto.id)
        .then((filas) => {
          setModelos(filas)
          setIdModelo(filas.length ? String(filas[0].id) : null)
        })
        .catch((err) => setError(err.message))
    }
  }, [opened, tipo, proyecto.id, idNota])

  useEffect(() => {
    if (!opened || tipo !== "registro" || !idModelo) return
    setElegido(null)
    api.listarRegistros(proyecto.id, { idModelo })
      .then((filas) => setOpciones(filas.map((r) => ({
        value: String(r.id),
        label: `${formatearFecha(r.fecha)}${r.hora ? ` ${String(r.hora).slice(0, 5)}` : ""} · n.º ${r.id} · ${r.creado_por}`,
      }))))
      .catch((err) => setError(err.message))
  }, [opened, tipo, idModelo, proyecto.id])

  async function enlazar() {
    setGuardando(true)
    setError(null)
    try {
      await onEnlazar(tipo, Number(elegido))
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Enlazar la nota con..." size="md">
      <Stack>
        <SegmentedControl value={tipo} onChange={setTipo} data={TIPOS_ENLACE} />
        {tipo === "registro" && (
          <Select
            label="Modelo" allowDeselect={false}
            data={modelos.map((m) => ({ value: String(m.id), label: m.titulo }))}
            value={idModelo} onChange={setIdModelo}
          />
        )}
        <Select
          label={TIPOS_ENLACE.find((t) => t.value === tipo).label} searchable
          placeholder="Busca y elige" nothingFoundMessage="Nada con ese texto"
          data={opciones} value={elegido} onChange={setElegido}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button onClick={enlazar} loading={guardando} disabled={!elegido}>Enlazar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function GrupoEnlaces({ titulo, elementos, puedeQuitar, onAbrir, onQuitar, etiqueta }) {
  if (!elementos.length) return null
  return (
    <div>
      <Text size="12.5px" c="dimmed" mb="4">{titulo}</Text>
      <Group gap="6">
        {elementos.map((e) => (
          <Badge
            key={e.id} variant="light" color="gray" tt="none" fw={500} size="lg" radius="sm"
            style={{ cursor: onAbrir ? "pointer" : undefined }}
            onClick={onAbrir ? () => onAbrir(e.id) : undefined}
            rightSection={puedeQuitar ? (
              <CloseButton size="xs" variant="transparent" aria-label="Quitar enlace"
                onClick={(ev) => { ev.stopPropagation(); onQuitar(e.id) }} />
            ) : null}
          >
            {etiqueta(e)}
          </Badge>
        ))}
      </Group>
    </div>
  )
}

export default function NotaBlocDetalle({
  proyecto, esSuperadmin, idNota, enlaceInicial, onVolver, onCreada, onVerNota, onVerDocumento, onVerEntidad, onVerProgramacion,
}) {
  const esNueva = !idNota
  const puedeEscribir = proyecto.puede_editar
  const esquemaColor = useComputedColorScheme("light")
  const [nota, setNota] = useState(null)
  const [editando, setEditando] = useState(esNueva)
  const [form, setForm] = useState(() => formularioDe(null))
  const [etiquetasEnUso, setEtiquetasEnUso] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [modalEnlace, setModalEnlace] = useState(false)
  const [modalRecordatorio, setModalRecordatorio] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  useEffect(() => {
    setError(null)
    setEditando(esNueva)
    if (esNueva) {
      setNota(null)
      setForm(formularioDe(null))
      return
    }
    api.obtenerNotaBloc(proyecto.id, idNota).then(setNota).catch((err) => setError(err.message))
  }, [proyecto.id, idNota, esNueva])

  useEffect(() => {
    if (!editando) return
    api.listarEtiquetasBloc(proyecto.id).then((f) => setEtiquetasEnUso(f.map((e) => e.etiqueta))).catch(() => {})
    if (!esSuperadmin) api.listarUsuariosProyecto(proyecto.id).then(setUsuarios).catch(() => {})
  }, [editando, proyecto.id, esSuperadmin])

  const cambiar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }))
  // Soporte no es un usuario del proyecto: sus notas solo pueden ser de todos
  const eligeVisibilidad = !esSuperadmin && (esNueva || nota?.puede_gestionar)

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = {
      titulo: form.titulo,
      fecha: form.fecha,
      descripcion: form.descripcion,
      contenido: form.contenido,
      etiquetas: form.etiquetas,
      fijada: form.fijada,
      color: form.color,
    }
    if (eligeVisibilidad) {
      cuerpo.visibilidad = form.visibilidad
      cuerpo.ids_personas = form.visibilidad === "personas" ? form.idsPersonas.map(Number) : []
    }
    try {
      if (esNueva) {
        if (enlaceInicial) cuerpo[CAMPO_ENLACE[enlaceInicial.tipo]] = [enlaceInicial.id]
        const creada = await api.crearNotaBloc(proyecto.id, cuerpo)
        onCreada(creada.id)
      } else {
        setNota(await api.actualizarNotaBloc(proyecto.id, idNota, cuerpo))
        setEditando(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function accion(llamada) {
    setError(null)
    try {
      const resultado = await llamada()
      if (resultado) setNota(resultado)
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar() {
    try {
      await api.eliminarNotaBloc(proyecto.id, idNota)
      onVolver()
    } catch (err) {
      setError(err.message)
      setConfirmarBorrado(false)
    }
  }

  const volver = (
    <Anchor
      component="button" type="button" onClick={onVolver} mb="lg"
      display="flex" style={{ alignItems: "center", gap: 6 }}
      underline="hover" c="dimmed" fz="13.5px" fw={500}
    >
      <IconArrowLeft size={15} stroke={2} />
      Bloc de notas
    </Anchor>
  )

  if (editando) {
    return (
      <>
        {volver}
        <Title order={2} mb="lg">{esNueva ? "Nueva nota" : "Cambiar nota"}</Title>
        <Stack component="form" onSubmit={guardar}>
          <Group align="flex-end" grow>
            <TextInput
              label="Título" required placeholder="Reunión con el proveedor de fruta"
              value={form.titulo} onChange={(e) => cambiar("titulo")(e.currentTarget.value)}
            />
            <TextInput
              type="datetime-local" label="Fecha y hora" required maw={240}
              value={form.fecha} onChange={(e) => cambiar("fecha")(e.currentTarget.value)}
            />
          </Group>
          <TextInput
            label="Descripción" placeholder="Opcional: un resumen de una línea" maxLength={500}
            value={form.descripcion} onChange={(e) => cambiar("descripcion")(e.currentTarget.value)}
          />
          <TagsInput
            label="Etiquetas" placeholder="Escribe y pulsa Intro" data={etiquetasEnUso} clearable
            value={form.etiquetas} onChange={cambiar("etiquetas")}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>Contenido</Text>
            <Box data-color-mode={esquemaColor}>
              <MDEditor value={form.contenido} onChange={(v) => cambiar("contenido")(v || "")} height={360} preview="edit" />
            </Box>
          </div>
          {eligeVisibilidad && (
            <div>
              <Text size="sm" fw={500} mb={4}>Quién la ve</Text>
              <SegmentedControl
                value={form.visibilidad} onChange={cambiar("visibilidad")}
                data={Object.entries(VISIBILIDADES).map(([value, v]) => ({ value, label: v.etiqueta }))}
              />
              {form.visibilidad === "personas" && (
                <MultiSelect
                  mt="xs" placeholder="Con quién la compartes" searchable
                  data={usuarios.map((u) => ({ value: String(u.id), label: u.nombre }))}
                  value={form.idsPersonas} onChange={cambiar("idsPersonas")}
                />
              )}
            </div>
          )}
          <SelectorColor valor={form.color} onChange={cambiar("color")} />
          <Switch
            label="Fijarla arriba" description="Sale la primera en el bloc de notas, para todos los que la ven"
            checked={form.fijada} onChange={(e) => cambiar("fijada")(e.currentTarget.checked)}
          />
          {error && <Alert color="red">{error}</Alert>}
          <Group>
            <Button type="submit" loading={guardando}>{esNueva ? "Guardar nota" : "Guardar cambios"}</Button>
            <Button variant="subtle" color="gray" onClick={() => (esNueva ? onVolver() : setEditando(false))}>
              Cancelar
            </Button>
          </Group>
        </Stack>
      </>
    )
  }

  if (!nota) {
    return (
      <>
        {volver}
        {error ? <Alert color="red">{error}</Alert> : <Text>Cargando...</Text>}
      </>
    )
  }

  const visibilidad = VISIBILIDADES[nota.visibilidad]
  const IconoVisibilidad = visibilidad.icono
  const hayEnlaces = nota.notas.length + nota.documentos.length + nota.registros.length + nota.entidades.length > 0

  return (
    <>
      {volver}
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {puedeEscribir ? (
            <Tooltip label={nota.fijada ? "Quitar de arriba" : "Fijar arriba"}>
              <ActionIcon
                variant="subtle" color={nota.fijada ? "acento" : "gray"}
                onClick={() => accion(() => api.actualizarNotaBloc(proyecto.id, idNota, { fijada: !nota.fijada }))}
              >
                {nota.fijada ? <IconPinFilled size={18} /> : <IconPin size={18} />}
              </ActionIcon>
            </Tooltip>
          ) : nota.fijada && <IconPinFilled size={18} color="var(--mantine-color-acento-6)" />}
          {nota.color && (
            <ColorSwatch size={16} color={`var(--mantine-color-${nota.color}-6)`} withShadow={false} style={{ flexShrink: 0 }} />
          )}
          <Title order={2}>{nota.titulo}</Title>
          {nota.archivada && <Badge color="gray" variant="light">Archivada</Badge>}
        </Group>
        {puedeEscribir && (
          <Group gap="xs" wrap="nowrap">
            <Button variant="light" leftSection={<IconEdit size={15} />} onClick={() => { setForm(formularioDe(nota)); setEditando(true) }}>
              Editar
            </Button>
            {nota.puede_gestionar && (
              <>
                <Tooltip label={nota.archivada ? "Desarchivar" : "Archivar (se quita de la lista sin borrarla)"}>
                  <ActionIcon
                    variant="default" size="lg"
                    onClick={() => accion(() => api.actualizarNotaBloc(proyecto.id, idNota, { archivada: !nota.archivada }))}
                  >
                    {nota.archivada ? <IconArchiveOff size={17} /> : <IconArchive size={17} />}
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Eliminar">
                  <ActionIcon variant="default" size="lg" color="red" onClick={() => setConfirmarBorrado(true)}>
                    <IconTrash size={17} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        )}
      </Group>

      <Group gap="xs" mb="md" c="dimmed" fz="13px">
        <Text size="13px">{formatearFecha(nota.fecha).slice(0, 16)}</Text>
        <Text size="13px">·</Text>
        <Tooltip label={visibilidad.ayuda}>
          <Group gap="4">
            <IconoVisibilidad size={14} stroke={1.8} />
            <Text size="13px">
              {nota.visibilidad === "personas"
                ? `Con ${nota.personas.map((p) => p.nombre).join(", ")}`
                : visibilidad.etiqueta}
            </Text>
          </Group>
        </Tooltip>
        <Text size="13px">·</Text>
        <Text size="13px">
          Escrita por {nota.creado_por}
          {nota.modificado_por !== nota.creado_por || nota.fecha_modificacion !== nota.fecha_alta
            ? ` · cambiada por ${nota.modificado_por} el ${formatearFecha(nota.fecha_modificacion).slice(0, 16)}`
            : ""}
        </Text>
      </Group>

      <Group mb="md">
        <ControlSeguimiento proyecto={proyecto} tipo="nota_bloc" idObjeto={nota.id} />
      </Group>

      {nota.etiquetas.length > 0 && (
        <Group gap="4" mb="md">
          {nota.etiquetas.map((e) => (
            <Badge key={e} variant="light" color="gray" tt="none" fw={500}>{e}</Badge>
          ))}
        </Group>
      )}
      {nota.descripcion && <Text mb="md" fw={500}>{nota.descripcion}</Text>}
      {error && <Alert color="red" mb="md">{error}</Alert>}

      <Paper withBorder radius="lg" p="20" mb="xl">
        {nota.contenido ? <Markdown>{nota.contenido}</Markdown> : <Text c="dimmed">Sin contenido.</Text>}
      </Paper>

      <Group justify="space-between" mb="sm">
        <Title order={4}>Enlaces</Title>
        {puedeEscribir && (
          <Button size="xs" variant="light" leftSection={<IconLink size={14} />} onClick={() => setModalEnlace(true)}>
            Enlazar
          </Button>
        )}
      </Group>
      {hayEnlaces ? (
        <Stack gap="sm" mb="xl">
          <GrupoEnlaces
            titulo="Notas" elementos={nota.notas} puedeQuitar={puedeEscribir} onAbrir={onVerNota}
            onQuitar={(id) => accion(() => api.desenlazarNotaBloc(proyecto.id, idNota, "nota", id))}
            etiqueta={(n) => n.titulo}
          />
          <GrupoEnlaces
            titulo="Documentos" elementos={nota.documentos} puedeQuitar={puedeEscribir} onAbrir={onVerDocumento}
            onQuitar={(id) => accion(() => api.desenlazarNotaBloc(proyecto.id, idNota, "documento", id))}
            etiqueta={(d) => d.nombre}
          />
          <GrupoEnlaces
            titulo="Entidades" elementos={nota.entidades} puedeQuitar={puedeEscribir} onAbrir={onVerEntidad}
            onQuitar={(id) => accion(() => api.desenlazarNotaBloc(proyecto.id, idNota, "entidad", id))}
            etiqueta={(e) => `${e.nombre} (${e.tipo})`}
          />
          <GrupoEnlaces
            titulo="Registros de datos" elementos={nota.registros} puedeQuitar={puedeEscribir}
            onQuitar={(id) => accion(() => api.desenlazarNotaBloc(proyecto.id, idNota, "registro", id))}
            etiqueta={(r) => `${r.modelo} · ${formatearFecha(r.fecha)} · n.º ${r.id}`}
          />
        </Stack>
      ) : (
        <Text size="sm" c="dimmed" mb="xl">Sin enlaces.</Text>
      )}

      <Group justify="space-between" mb="sm">
        <Title order={4}>Recordatorios</Title>
        {puedeEscribir && (
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setModalRecordatorio(true)}>
            Nuevo recordatorio
          </Button>
        )}
      </Group>
      {nota.recordatorios.length === 0 ? (
        <Text size="sm" c="dimmed">Ninguno.</Text>
      ) : (
        <Stack gap="xs">
          {nota.recordatorios.map((r) => (
            <Paper key={r.id} withBorder radius="md" p="sm" style={{ cursor: "pointer" }} onClick={() => onVerProgramacion(r.id)}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <IconAlarm size={16} stroke={1.8} />
                  <Text size="sm" fw={500}>{r.titulo}</Text>
                </Group>
                {r.estado === "activa" ? (
                  <Text size="12.5px" c="dimmed">Próximo: {formatearFecha(r.proxima_ejecucion)}</Text>
                ) : (
                  <Badge variant="light" color={COLOR_ESTADO[r.estado]}>{r.estado}</Badge>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <ModalEnlace
        opened={modalEnlace} proyecto={proyecto} idNota={idNota} onClose={() => setModalEnlace(false)}
        onEnlazar={async (tipo, idDestino) => setNota(await api.enlazarNotaBloc(proyecto.id, idNota, tipo, idDestino))}
      />
      <FormularioProgramacion
        opened={modalRecordatorio}
        onClose={() => setModalRecordatorio(false)}
        proyecto={proyecto}
        programacion={null}
        idNotaBloc={idNota}
        // La lista de avisos la ve todo el proyecto: de una nota que no es de
        // todos, mejor no poner su título de entrada
        tituloInicial={nota.visibilidad === "todos" ? `Recordatorio: ${nota.titulo}` : "Recordatorio de una nota"}
        onGuardado={() => {
          setModalRecordatorio(false)
          api.obtenerNotaBloc(proyecto.id, idNota).then(setNota).catch(() => {})
        }}
      />
      <Modal opened={confirmarBorrado} onClose={() => setConfirmarBorrado(false)} title="Eliminar nota" size="sm">
        <Text size="sm" mb="md">
          Se borra para siempre, con sus enlaces y sus recordatorios. Si solo quieres quitarla de en medio, archívala.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmarBorrado(false)}>Cancelar</Button>
          <Button color="red" onClick={eliminar}>Eliminar</Button>
        </Group>
      </Modal>
    </>
  )
}
