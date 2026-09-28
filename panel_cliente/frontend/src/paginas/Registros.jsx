import { useEffect, useState } from "react"
import {
  ActionIcon, Alert, Anchor, Badge, Button, Checkbox, FileInput, Group, Modal, MultiSelect, NumberInput, Paper, Select, Stack,
  Table, Tabs, Text, Textarea, TextInput, Title, Tooltip,
} from "@mantine/core"
import { IconArrowLeft, IconHistory, IconPaperclip, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

const PERIODICIDADES = ["diaria", "semanal", "mensual", "puntual"]
const TODOS = "__todos__"

const ESQUEMA_DE_MUESTRA = `{
  "type": "object",
  "required": ["camara", "temperatura"],
  "additionalProperties": false,
  "properties": {
    "camara": {"type": "string", "enum": ["Cámara 1", "Cámara 2"]},
    "temperatura": {"type": "number", "minimum": -30, "maximum": 15}
  }
}`

function campos(modelo) {
  return Object.entries(modelo?.esquema?.properties || {})
}

function obligatorio(modelo, campo) {
  return (modelo?.esquema?.required || []).includes(campo)
}

function comoTexto(valor) {
  if (valor === true) return "Sí"
  if (valor === false) return "No"
  if (valor === null || valor === undefined) return ""
  return typeof valor === "object" ? JSON.stringify(valor) : String(valor)
}

// Un campo del formulario por cada campo del esquema: la forma de lo que se
// anota la decide el modelo, no esta pantalla.
function CampoDeEsquema({ nombre, definicion, requerido, valor, onChange }) {
  const etiqueta = requerido ? `${nombre} *` : nombre
  if (definicion.enum) {
    return (
      <Select
        label={etiqueta} data={definicion.enum.map(String)} value={valor ?? null}
        onChange={onChange} searchable clearable={!requerido}
      />
    )
  }
  if (definicion.type === "number" || definicion.type === "integer") {
    return (
      <NumberInput
        label={etiqueta} value={valor ?? ""} onChange={onChange}
        min={definicion.minimum} max={definicion.maximum}
        step={definicion.type === "integer" ? 1 : 0.1}
        description={
          definicion.minimum !== undefined || definicion.maximum !== undefined
            ? `Entre ${definicion.minimum ?? "—"} y ${definicion.maximum ?? "—"}`
            : undefined
        }
      />
    )
  }
  if (definicion.type === "boolean") {
    return <Checkbox label={etiqueta} checked={!!valor} onChange={(e) => onChange(e.currentTarget.checked)} mt="22" />
  }
  return (
    <TextInput
      label={etiqueta}
      type={definicion.format === "date" ? "date" : "text"}
      value={valor ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  )
}

function ModalRegistro({ opened, modelo, registro, documentos, onClose, onGuardar }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [valores, setValores] = useState({})
  const [datos, setDatos] = useState({ fecha: hoy, hora: "", conforme: null, observaciones: "" })
  const [archivo, setArchivo] = useState(null)
  const [idsDocumentos, setIdsDocumentos] = useState([])
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!opened) return
    setValores(registro ? { ...registro.valores } : {})
    setIdsDocumentos((registro?.documentos || []).map((d) => String(d.id)))
    setDatos({
      fecha: registro?.fecha?.slice(0, 10) || hoy,
      hora: registro?.hora?.slice(0, 5) || "",
      conforme: registro?.conforme ?? null,
      observaciones: registro?.observaciones || "",
    })
    setArchivo(null)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, registro])

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      // Los vacíos no se mandan: un campo opcional sin rellenar no debe
      // viajar como "" y chocar con el tipo que pide el esquema.
      const limpios = Object.fromEntries(
        Object.entries(valores).filter(([, v]) => v !== "" && v !== null && v !== undefined),
      )
      await onGuardar({
        valores: limpios,
        fecha: datos.fecha,
        hora: datos.hora || null,
        conforme: datos.conforme,
        observaciones: datos.observaciones || null,
      }, archivo, idsDocumentos.map(Number))
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={opened} onClose={onClose} size="lg"
      title={registro ? `Corregir registro #${registro.id}` : `Nuevo registro — ${modelo?.titulo || ""}`}
    >
      <Stack component="form" onSubmit={guardar}>
        <Group grow align="flex-start">
          <TextInput
            label="Fecha" type="date" required
            description="El día al que se refiere, no el de hoy si anotas algo de antes"
            value={datos.fecha}
            onChange={(e) => setDatos({ ...datos, fecha: e.currentTarget.value })}
          />
          <TextInput
            label="Hora" type="time"
            value={datos.hora}
            onChange={(e) => setDatos({ ...datos, hora: e.currentTarget.value })}
          />
        </Group>

        {campos(modelo).map(([nombre, definicion]) => (
          <CampoDeEsquema
            key={nombre}
            nombre={nombre}
            definicion={definicion}
            requerido={obligatorio(modelo, nombre)}
            valor={valores[nombre]}
            onChange={(valor) => setValores((previo) => ({ ...previo, [nombre]: valor }))}
          />
        ))}

        <Select
          label="¿Conforme?"
          description="Déjalo vacío si esto no es una comprobación"
          data={[
            { value: "si", label: "Sí, dentro de lo debido" },
            { value: "no", label: "No, se salió de lo debido" },
          ]}
          value={datos.conforme === null ? null : datos.conforme ? "si" : "no"}
          onChange={(v) => setDatos({ ...datos, conforme: v === null ? null : v === "si" })}
          clearable
        />
        <Textarea
          label="Observaciones" autosize minRows={2}
          placeholder="La desviación y qué se hizo, si la hay"
          value={datos.observaciones}
          onChange={(e) => setDatos({ ...datos, observaciones: e.currentTarget.value })}
        />
        <MultiSelect
          label="Documentos vinculados" searchable clearable
          placeholder="El certificado de calibración, el informe del laboratorio..."
          data={documentos.map((d) => ({ value: String(d.id), label: `${d.nombre} (${d.tipo_documento})` }))}
          value={idsDocumentos}
          onChange={setIdsDocumentos}
        />
        <FileInput
          label="Archivo original" clearable
          placeholder={registro?.archivo_original_nombre || "La foto del parte, el PDF del análisis..."}
          description={registro?.archivo_original_nombre ? "Si eliges otro, sustituye al que ya tiene" : "Opcional, se guarda tal cual"}
          value={archivo}
          onChange={setArchivo}
        />

        {error && <Alert color="red">{error}</Alert>}
        <Text c="dimmed" fz="12.5px">
          Lo que anotes se comprueba contra el modelo antes de guardarse: si algo no encaja, te dirá qué campo.
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={guardando}>
            {registro ? "Guardar" : "Anotar"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function PestanaRegistros({ proyecto, modelos }) {
  const puedeEscribir = proyecto.es_admin || proyecto.puede_editar
  const [idModelo, setIdModelo] = useState(null)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [conforme, setConforme] = useState(TODOS)
  const [registros, setRegistros] = useState(null)
  const [error, setError] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [registroEditando, setRegistroEditando] = useState(null)
  const [modeloDelRegistro, setModeloDelRegistro] = useState(null)
  const [documentos, setDocumentos] = useState([])

  useEffect(() => {
    api.listarOBuscarDocumentos(proyecto.id, "").then(setDocumentos).catch(() => setDocumentos([]))
  }, [proyecto.id])

  const modelo = modelos.find((m) => String(m.id) === String(idModelo)) || null

  async function abrirCorreccion(registro) {
    // El registro puede ser de una versión anterior del modelo, que no está
    // en el listado (solo trae la última de cada uno): se pide su versión.
    let suyo = modelos.find((m) => m.id === registro.id_modelo)
    if (!suyo) {
      const versiones = await api.listarVersionesModeloRegistro(proyecto.id, Number(idModelo))
      suyo = versiones.find((v) => v.id === registro.id_modelo) || modelo
    }
    setModeloDelRegistro(suyo)
    setRegistroEditando(registro)
    setModalAbierto(true)
  }

  useEffect(() => {
    if (!idModelo && modelos.length) setIdModelo(String(modelos[0].id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos])

  function cargar() {
    if (!idModelo) return Promise.resolve()
    setError(null)
    return api
      .listarRegistros(proyecto.id, {
        idModelo,
        desde: desde || undefined,
        hasta: hasta || undefined,
        conforme: conforme === TODOS ? undefined : conforme === "si",
      })
      .then(setRegistros)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idModelo, desde, hasta, conforme])

  async function guardar(datos, archivo, idsDocumentos) {
    const fila = registroEditando
      ? await api.corregirRegistro(proyecto.id, registroEditando.id, datos)
      : await api.crearRegistro(proyecto.id, { ...datos, id_modelo: Number(idModelo), id_documentos: idsDocumentos })
    if (registroEditando) {
      const antes = (registroEditando.documentos || []).map((d) => d.id)
      for (const id of idsDocumentos.filter((id) => !antes.includes(id))) {
        await api.vincularDocumentoRegistro(proyecto.id, fila.id, id)
      }
      for (const id of antes.filter((id) => !idsDocumentos.includes(id))) {
        await api.desvincularDocumentoRegistro(proyecto.id, fila.id, id)
      }
    }
    // Si el archivo falla, el registro ya está guardado: al recargar se ve
    // sin archivo y el error sale en el modal, que sigue abierto.
    if (archivo) await api.subirArchivoOriginalRegistro(proyecto.id, fila.id, archivo)
    await cargar()
  }

  async function descargarOriginal(registro) {
    try {
      const { blob, nombreFichero } = await api.descargarArchivoOriginalRegistroBlob(proyecto.id, registro.id)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = nombreFichero
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar(registro) {
    if (!window.confirm(`¿Eliminar el registro #${registro.id}? Si el dato está mal, mejor corrígelo.`)) return
    try {
      await api.eliminarRegistro(proyecto.id, registro.id)
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!modelos.length) {
    return (
      <Text c="dimmed">
        Todavía no hay ningún modelo de registro. Créalo en la pestaña "Modelos", o pídeselo a tu IA en
        conversación: ella te pregunta qué anotas y lo monta.
      </Text>
    )
  }

  return (
    <>
      <Group mb="md" align="flex-end">
        <Select
          label="Modelo" w={260} allowDeselect={false}
          data={modelos.map((m) => ({ value: String(m.id), label: `${m.titulo} (v${m.version})` }))}
          value={idModelo}
          onChange={setIdModelo}
        />
        <TextInput label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.currentTarget.value)} />
        <TextInput label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.currentTarget.value)} />
        <Select
          label="Conformidad" w={170} allowDeselect={false}
          data={[
            { value: TODOS, label: "Todos" },
            { value: "si", label: "Solo conformes" },
            { value: "no", label: "Solo no conformes" },
          ]}
          value={conforme}
          onChange={setConforme}
        />
        {puedeEscribir && modelo?.activo && (
          <Button
            leftSection={<IconPlus size={15} stroke={2.2} />}
            onClick={() => {
              setRegistroEditando(null)
              setModalAbierto(true)
            }}
          >
            Nuevo registro
          </Button>
        )}
      </Group>

      {modelo && !modelo.activo && (
        <Alert color="yellow" mb="md">
          Este modelo está retirado: se pueden consultar sus registros, pero no anotar nuevos.
        </Alert>
      )}
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {!registros ? (
        <Text>Cargando...</Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflowX: "auto" }}>
          <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={150}>Fecha</Table.Th>
                {campos(modelo).map(([nombre]) => (
                  <Table.Th key={nombre}>{nombre}</Table.Th>
                ))}
                <Table.Th w={130}>Conformidad</Table.Th>
                <Table.Th>Documentos</Table.Th>
                <Table.Th w={160}>Anotado por</Table.Th>
                {puedeEscribir && <Table.Th w={80} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {registros.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text fz="13.5px">{formatearFecha(r.fecha)}</Text>
                    <Group gap="6">
                      {r.hora && (
                        <Text fz="11.5px" c="dimmed">
                          {String(r.hora).slice(0, 5)}
                        </Text>
                      )}
                      <Text fz="11.5px" c="dimmed">
                        v{r.version_modelo}
                      </Text>
                      {r.archivo_original_nombre && (
                        <Tooltip label={`Descargar ${r.archivo_original_nombre}`}>
                          <ActionIcon
                            variant="subtle" color="gray" size="xs" aria-label="Descargar archivo original"
                            onClick={() => descargarOriginal(r)}
                          >
                            <IconPaperclip size={13} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  {campos(modelo).map(([nombre]) => (
                    <Table.Td key={nombre}>
                      <Text fz="13.5px">{comoTexto(r.valores[nombre])}</Text>
                    </Table.Td>
                  ))}
                  <Table.Td>
                    {r.conforme === null ? (
                      <Text fz="13px" c="dimmed">
                        —
                      </Text>
                    ) : (
                      <Tooltip label={r.observaciones || "Sin observaciones"}>
                        <Badge color={r.conforme ? "green" : "red"} variant="light">
                          {r.conforme ? "Conforme" : "No conforme"}
                        </Badge>
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="4">
                      {r.documentos.map((d) => (
                        <Badge key={d.id} variant="light" color="gray" radius="sm" tt="none" fw={500} title={d.tipo_documento}>
                          {d.nombre}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="13px" c="dimmed">
                      {r.creado_por}
                    </Text>
                  </Table.Td>
                  {puedeEscribir && (
                    <Table.Td>
                      <Group gap="4" wrap="nowrap">
                        <Tooltip label="Corregir">
                          <ActionIcon
                            variant="subtle" color="gray" aria-label="Corregir registro"
                            onClick={() => abrirCorreccion(r)}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Eliminar">
                          <ActionIcon variant="subtle" color="red" onClick={() => eliminar(r)} aria-label="Eliminar registro">
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
              {registros.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={campos(modelo).length + 5}>
                    <Text c="dimmed" py="md">
                      No hay registros con estos filtros.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <ModalRegistro
        opened={modalAbierto}
        modelo={registroEditando ? modeloDelRegistro || modelo : modelo}
        registro={registroEditando}
        documentos={documentos}
        onClose={() => setModalAbierto(false)}
        onGuardar={guardar}
      />
    </>
  )
}

function ModalModelo({ opened, modelo, onClose, onGuardar }) {
  const versionando = !!modelo?.tiene_registros
  const [datos, setDatos] = useState({ nombre: "", titulo: "", descripcion: "", periodicidad: null })
  const [esquema, setEsquema] = useState(ESQUEMA_DE_MUESTRA)
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!opened) return
    setDatos({
      nombre: modelo?.nombre || "",
      titulo: modelo?.titulo || "",
      descripcion: modelo?.descripcion || "",
      periodicidad: modelo?.periodicidad || null,
    })
    setEsquema(modelo ? JSON.stringify(modelo.esquema, null, 2) : ESQUEMA_DE_MUESTRA)
    setMotivo("")
    setError(null)
  }, [opened, modelo])

  async function guardar(evento) {
    evento.preventDefault()
    setError(null)
    let esquemaObjeto
    try {
      esquemaObjeto = JSON.parse(esquema)
    } catch (err) {
      setError(`El esquema no es JSON válido: ${err.message}`)
      return
    }
    setGuardando(true)
    try {
      await onGuardar({ ...datos, esquema: esquemaObjeto, motivo: motivo.trim() }, versionando)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={opened} onClose={onClose} size="lg"
      title={!modelo ? "Nuevo modelo de registro" : versionando ? `Nueva versión de "${modelo.nombre}"` : `Editar "${modelo.nombre}"`}
    >
      <Stack component="form" onSubmit={guardar}>
        {versionando && (
          <Alert color="blue">
            Este modelo ya tiene registros, así que no se toca: se crea la versión {modelo.version + 1} y la
            actual se retira. Los registros ya anotados se quedan como están, con su versión.
          </Alert>
        )}
        <Group grow align="flex-start">
          <TextInput
            label="Nombre" required placeholder="temperaturas_camaras"
            description={modelo ? "No se puede cambiar" : "Corto, sin espacios"}
            disabled={!!modelo}
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.currentTarget.value })}
          />
          <Select
            label="Periodicidad" data={PERIODICIDADES} clearable
            description="Cada cuánto se espera uno"
            value={datos.periodicidad}
            onChange={(v) => setDatos({ ...datos, periodicidad: v })}
          />
        </Group>
        <TextInput
          label="Título" required placeholder="Control diario de temperaturas"
          value={datos.titulo}
          onChange={(e) => setDatos({ ...datos, titulo: e.currentTarget.value })}
        />
        <Textarea
          label="Descripción" required autosize minRows={2}
          description="Qué se anota, cuándo y quién"
          value={datos.descripcion}
          onChange={(e) => setDatos({ ...datos, descripcion: e.currentTarget.value })}
        />
        <Textarea
          label="Esquema (JSON Schema)" required autosize minRows={8} maxRows={20}
          description="Qué campos lleva y cómo deben ser. Si prefieres no escribirlo a mano, pídeselo a tu IA en conversación."
          styles={{ input: { fontFamily: "monospace", fontSize: "12.5px" } }}
          value={esquema}
          onChange={(e) => setEsquema(e.currentTarget.value)}
        />
        {versionando && (
          <Textarea
            label="Motivo del cambio" required autosize minRows={2}
            placeholder="Se añade el termómetro usado, ahora hay dos"
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
          />
        )}

        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit" loading={guardando}
            disabled={!datos.nombre.trim() || !datos.titulo.trim() || !datos.descripcion.trim() || (versionando && !motivo.trim())}
          >
            {!modelo ? "Crear modelo" : versionando ? "Crear versión" : "Guardar"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function PestanaModelos({ proyecto, modelos, onCambio }) {
  const puedeEscribir = proyecto.es_admin || proyecto.puede_editar
  const [error, setError] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modeloEditando, setModeloEditando] = useState(null)
  const [versiones, setVersiones] = useState(null)

  async function guardar(datos, versionando) {
    if (!modeloEditando) {
      await api.crearModeloRegistro(proyecto.id, datos)
    } else if (versionando) {
      await api.nuevaVersionModeloRegistro(proyecto.id, modeloEditando.id, datos)
    } else {
      await api.corregirModeloRegistro(proyecto.id, modeloEditando.id, datos)
    }
    await onCambio()
  }

  async function cambiarActivo(modelo) {
    try {
      await api.cambiarActivoModeloRegistro(proyecto.id, modelo.id, !modelo.activo)
      await onCambio()
    } catch (err) {
      setError(err.message)
    }
  }

  async function verVersiones(modelo) {
    setError(null)
    try {
      setVersiones({ modelo, filas: await api.listarVersionesModeloRegistro(proyecto.id, modelo.id) })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {puedeEscribir && (
        <Group mb="md">
          <Button
            leftSection={<IconPlus size={15} stroke={2.2} />}
            onClick={() => {
              setModeloEditando(null)
              setModalAbierto(true)
            }}
          >
            Nuevo modelo
          </Button>
        </Group>
      )}
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
        <Table striped verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={200}>Nombre</Table.Th>
              <Table.Th>Título</Table.Th>
              <Table.Th w={130}>Campos</Table.Th>
              <Table.Th w={190}>Estado</Table.Th>
              {puedeEscribir && <Table.Th w={110} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {modelos.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>
                  <Text fz="13px" ff="monospace" style={{ wordBreak: "break-all" }}>
                    {m.nombre}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="13.5px">{m.titulo}</Text>
                  <Text fz="11.5px" c="dimmed" lineClamp={1}>
                    {m.descripcion}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="12.5px" c="dimmed">
                    {campos(m).map(([nombre]) => nombre).join(", ")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="6">
                    <Badge variant="light" color={m.activo ? "acento" : "gray"}>
                      v{m.version} {m.activo ? "vigente" : "retirada"}
                    </Badge>
                    {m.periodicidad && (
                      <Badge variant="light" color="gray">
                        {m.periodicidad}
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                {puedeEscribir && (
                  <Table.Td>
                    <Group gap="4" wrap="nowrap">
                      <Tooltip label="Ver versiones">
                        <ActionIcon variant="subtle" color="gray" onClick={() => verVersiones(m)} aria-label="Ver versiones">
                          <IconHistory size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={m.tiene_registros ? "Ya tiene registros: crear una versión nueva" : "Editar"}>
                        <ActionIcon
                          variant="subtle" color="gray" aria-label="Editar modelo"
                          onClick={() => {
                            setModeloEditando(m)
                            setModalAbierto(true)
                          }}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={m.activo ? "Retirar" : "Volver a activar"}>
                        <Anchor component="button" type="button" size="sm" onClick={() => cambiarActivo(m)}>
                          {m.activo ? "Retirar" : "Activar"}
                        </Anchor>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {modelos.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" py="md">
                    Todavía no hay ningún modelo. Puedes crearlo aquí o pedírselo a tu IA en conversación.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <ModalModelo
        opened={modalAbierto}
        modelo={modeloEditando}
        onClose={() => setModalAbierto(false)}
        onGuardar={guardar}
      />

      <Modal
        opened={!!versiones} onClose={() => setVersiones(null)} size="lg"
        title={versiones ? `Versiones de "${versiones.modelo.nombre}"` : ""}
      >
        <Stack gap="sm">
          {versiones?.filas.map((v) => (
            <Paper key={v.id} withBorder radius="md" p="12">
              <Group justify="space-between">
                <Badge variant="light" color={v.activo ? "acento" : "gray"}>
                  v{v.version} {v.activo ? "vigente" : "retirada"}
                </Badge>
                <Text fz="12px" c="dimmed">
                  {formatearFecha(v.fecha_alta)}
                </Text>
              </Group>
              <Text fz="13px" mt="6">
                {v.motivo_version || "Primera versión"}
              </Text>
              <Text fz="12px" c="dimmed" mt="4">
                Campos: {campos(v).map(([nombre]) => nombre).join(", ")}
              </Text>
            </Paper>
          ))}
        </Stack>
      </Modal>
    </>
  )
}

export default function Registros({ proyecto, onVolver }) {
  const [modelos, setModelos] = useState(null)
  const [error, setError] = useState(null)

  function cargar() {
    setError(null)
    return api
      .listarModelosRegistro(proyecto.id)
      .then(setModelos)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    cargar()
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
      <Title order={2} mb="6">
        Registros de datos
      </Title>
      <Text c="dimmed" mb="lg" maw={680} fz="13.5px">
        Lo que se anota una y otra vez con la misma forma: temperaturas, partes de limpieza, resultados de
        un análisis. Cada tipo tiene un <b>modelo</b> que dice qué campos lleva y entre qué valores son
        correctos, y lo que anotas se comprueba contra él antes de guardarse. Un modelo que ya tiene
        registros no se cambia: se crea una versión nueva y la anterior se retira, para que siempre se sepa
        qué forma tenía el parte el día que se rellenó.
      </Text>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {!modelos ? (
        <Text>Cargando...</Text>
      ) : (
        <Tabs defaultValue="registros" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="registros">Anotaciones</Tabs.Tab>
            <Tabs.Tab value="modelos">Modelos ({modelos.length})</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="registros">
            <PestanaRegistros proyecto={proyecto} modelos={modelos.filter((m) => m.activo || m.tiene_registros)} />
          </Tabs.Panel>
          <Tabs.Panel value="modelos">
            <PestanaModelos proyecto={proyecto} modelos={modelos} onCambio={cargar} />
          </Tabs.Panel>
        </Tabs>
      )}
    </>
  )
}
