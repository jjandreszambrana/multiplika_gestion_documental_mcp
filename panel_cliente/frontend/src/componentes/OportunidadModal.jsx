import { useEffect, useState } from "react"
import {
  Alert, Anchor, Badge, Button, Divider, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea,
} from "@mantine/core"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha, formatearImporte } from "../formato"

const VACIA = {
  titulo: "", id_entidad: null, id_contacto: null, importe: "", id_etapa: null, fecha_prevista_cierre: "",
  id_usuario_responsable: null, origen: "", descripcion: "", proximo_paso: "", fecha_proximo_paso: "",
  motivo_perdida: "",
}

const texto = (v) => (v == null ? "" : String(v))
const id = (v) => (v == null ? null : String(v))

function desdeOportunidad(o) {
  return {
    titulo: o.titulo, id_entidad: id(o.id_entidad), id_contacto: id(o.id_contacto), importe: o.importe ?? "",
    id_etapa: id(o.id_etapa), fecha_prevista_cierre: texto(o.fecha_prevista_cierre),
    id_usuario_responsable: id(o.id_usuario_responsable), origen: texto(o.origen), descripcion: texto(o.descripcion),
    proximo_paso: texto(o.proximo_paso), fecha_proximo_paso: texto(o.fecha_proximo_paso), motivo_perdida: texto(o.motivo_perdida),
  }
}

// Lo que se manda al servidor: vacíos como null y los ids como número
function paraGuardar(v) {
  const numero = (x) => (x ? Number(x) : null)
  const vacio = (x) => (x === "" || x == null ? null : x)
  return {
    titulo: v.titulo, id_entidad: numero(v.id_entidad), id_contacto: numero(v.id_contacto),
    importe: v.importe === "" ? null : Number(v.importe), id_etapa: numero(v.id_etapa),
    fecha_prevista_cierre: vacio(v.fecha_prevista_cierre), id_usuario_responsable: numero(v.id_usuario_responsable),
    origen: vacio(v.origen), descripcion: vacio(v.descripcion), proximo_paso: vacio(v.proximo_paso),
    fecha_proximo_paso: vacio(v.fecha_proximo_paso), motivo_perdida: vacio(v.motivo_perdida),
  }
}

// Alta, ficha y edición de una oportunidad de venta. `idOportunidad` null =
// nueva (con `idEntidadInicial` si se abre desde la ficha de una entidad).
export default function OportunidadModal({
  opened, onClose, proyecto, idOportunidad, idEntidadInicial, etapas, onGuardada, onVerEntidad, onVerDocumento,
}) {
  const [valores, setValores] = useState(VACIA)
  const [oportunidad, setOportunidad] = useState(null)
  const [entidades, setEntidades] = useState([])
  const [contactos, setContactos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [idDocumento, setIdDocumento] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const soloLectura = !proyecto.puede_editar

  useEffect(() => {
    if (!opened) return
    setError(null)
    setOportunidad(null)
    setValores({ ...VACIA, id_entidad: id(idEntidadInicial) })
    api.listarEntidades(proyecto.id).then(setEntidades).catch(() => setEntidades([]))
    api.listarUsuariosProyecto(proyecto.id).then(setUsuarios).catch(() => setUsuarios([]))
    if (idOportunidad) {
      api.obtenerOportunidad(proyecto.id, idOportunidad).then((o) => {
        setOportunidad(o)
        setValores(desdeOportunidad(o))
      }).catch((err) => setError(err.message))
      api.listarOBuscarDocumentos(proyecto.id, "").then(setDocumentos).catch(() => setDocumentos([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, idOportunidad])

  useEffect(() => {
    if (!opened || !valores.id_entidad) {
      setContactos([])
      return
    }
    api.listarContactos(proyecto.id, valores.id_entidad).then(setContactos).catch(() => setContactos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, valores.id_entidad])

  const cambiar = (campo) => (valor) => setValores((v) => ({ ...v, [campo]: valor }))
  const cambiarTexto = (campo) => (e) => cambiar(campo)(e.currentTarget.value)
  const etapa = etapas.find((e) => String(e.id) === valores.id_etapa)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const datos = paraGuardar(valores)
      const guardada = idOportunidad
        ? await api.actualizarOportunidad(proyecto.id, idOportunidad, datos)
        : await api.crearOportunidad(proyecto.id, datos)
      onGuardada(guardada)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!confirm(`¿Borrar «${oportunidad.titulo}»? Si se perdió, mejor moverla a «Perdida»: así cuenta en los informes.`)) return
    try {
      await api.eliminarOportunidad(proyecto.id, idOportunidad)
      onGuardada(null)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  async function recargar() {
    setOportunidad(await api.obtenerOportunidad(proyecto.id, idOportunidad))
  }

  async function anadirDocumento() {
    try {
      await api.relacionarDocumentoOportunidad(proyecto.id, idOportunidad, Number(idDocumento))
      setIdDocumento(null)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function quitarDocumento(idDoc) {
    try {
      await api.quitarDocumentoOportunidad(proyecto.id, idOportunidad, idDoc)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const enlazados = new Set((oportunidad?.documentos || []).map((d) => d.id))

  return (
    <Modal opened={opened} onClose={onClose} size="lg" title={idOportunidad ? "Oportunidad" : "Nueva oportunidad"}>
      <Stack gap="sm">
        {error && <Alert color="red">{error}</Alert>}
        <TextInput label="Título" required placeholder="Reforma de oficinas" value={valores.titulo} onChange={cambiarTexto("titulo")} readOnly={soloLectura} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Entidad" required searchable placeholder="Cliente o posible cliente"
            data={entidades.map((e) => ({ value: String(e.id), label: e.nombre }))}
            value={valores.id_entidad} readOnly={soloLectura}
            onChange={(v) => setValores((x) => ({ ...x, id_entidad: v, id_contacto: null }))}
          />
          <Select
            label="Contacto" clearable placeholder={valores.id_entidad ? "Persona de contacto" : "Elige antes la entidad"}
            data={contactos.map((c) => ({ value: String(c.id), label: c.cargo ? `${c.nombre} (${c.cargo})` : c.nombre }))}
            value={valores.id_contacto} onChange={cambiar("id_contacto")} readOnly={soloLectura}
          />
          <NumberInput
            label="Importe (sin impuestos)" min={0} decimalScale={2} thousandSeparator="." decimalSeparator="," suffix=" €"
            value={valores.importe} onChange={cambiar("importe")} readOnly={soloLectura}
          />
          <Select
            label="Etapa" placeholder="La primera" allowDeselect={false}
            data={etapas.map((e) => ({ value: String(e.id), label: `${e.nombre} (${e.probabilidad} %)` }))}
            value={valores.id_etapa} onChange={cambiar("id_etapa")} readOnly={soloLectura}
          />
          <TextInput type="date" label="Cierre previsto" value={valores.fecha_prevista_cierre} onChange={cambiarTexto("fecha_prevista_cierre")} readOnly={soloLectura} />
          <Select
            label="Responsable" clearable placeholder="Nadie"
            data={usuarios.map((u) => ({ value: String(u.id), label: u.nombre }))}
            value={valores.id_usuario_responsable} onChange={cambiar("id_usuario_responsable")} readOnly={soloLectura}
          />
          <TextInput label="Próximo paso" placeholder="Llamar para cerrar la visita" value={valores.proximo_paso} onChange={cambiarTexto("proximo_paso")} readOnly={soloLectura} />
          <TextInput type="date" label="Fecha del próximo paso" value={valores.fecha_proximo_paso} onChange={cambiarTexto("fecha_proximo_paso")} readOnly={soloLectura} />
          <TextInput label="Origen" placeholder="Web, recomendación, feria..." value={valores.origen} onChange={cambiarTexto("origen")} readOnly={soloLectura} />
          {etapa?.tipo === "perdida" && (
            <TextInput label="Motivo de la pérdida" placeholder="Precio, plazo, se fue con otro..." value={valores.motivo_perdida} onChange={cambiarTexto("motivo_perdida")} readOnly={soloLectura} />
          )}
        </SimpleGrid>
        <Textarea label="Descripción" autosize minRows={2} value={valores.descripcion} onChange={cambiarTexto("descripcion")} readOnly={soloLectura} />
        <Text size="12px" c="dimmed">
          El día del próximo paso, y mientras no tenga ninguno, la oportunidad sale en el resumen de las 8:00 de su responsable.
        </Text>

        {oportunidad && (
          <>
            <Divider label="Documentos" labelPosition="left" />
            {oportunidad.documentos.length === 0 && <Text size="sm" c="dimmed">Ninguno: enlaza aquí el presupuesto o la propuesta.</Text>}
            {oportunidad.documentos.map((d) => (
              <Group key={d.id} justify="space-between" wrap="nowrap">
                <Anchor size="sm" onClick={() => { onClose(); onVerDocumento?.(d.id) }}>{d.nombre}</Anchor>
                {!soloLectura && (
                  <Anchor component="button" type="button" c="red" size="sm" onClick={() => quitarDocumento(d.id)}>Quitar</Anchor>
                )}
              </Group>
            ))}
            {!soloLectura && (
              <Group align="flex-end" gap="8">
                <Select
                  placeholder="Buscar documento..." searchable style={{ flex: 1 }} value={idDocumento} onChange={setIdDocumento}
                  data={documentos.filter((d) => !enlazados.has(d.id)).map((d) => ({ value: String(d.id), label: d.nombre }))}
                />
                <Button variant="default" onClick={anadirDocumento} disabled={!idDocumento} leftSection={<IconPlus size={15} />}>Enlazar</Button>
              </Group>
            )}
            <Divider label="Historial" labelPosition="left" />
            {oportunidad.cambios.map((c, i) => (
              <Text key={i} size="13px">
                <Badge variant="light" color="gray" tt="none" mr={6}>{c.nombre_etapa}</Badge>
                {formatearFecha(c.fecha).slice(0, 16)} · {c.quien}
              </Text>
            ))}
            <Text size="12px" c="dimmed">
              Creada por {oportunidad.creado_por}. Ponderado: {formatearImporte(oportunidad.importe_ponderado)}.{" "}
              {onVerEntidad && <Anchor size="12px" onClick={() => { onClose(); onVerEntidad(oportunidad.id_entidad) }}>Ver la ficha de {oportunidad.entidad}</Anchor>}
            </Text>
          </>
        )}

        {!soloLectura && (
          <Group justify="space-between" mt="xs">
            {oportunidad ? (
              <Button variant="subtle" color="red" leftSection={<IconTrash size={15} />} onClick={eliminar}>Borrar</Button>
            ) : <span />}
            <Group gap="8">
              <Button variant="subtle" color="gray" onClick={onClose}>Cancelar</Button>
              <Button onClick={guardar} loading={guardando} disabled={!valores.titulo.trim() || !valores.id_entidad}>Guardar</Button>
            </Group>
          </Group>
        )}
      </Stack>
    </Modal>
  )
}
