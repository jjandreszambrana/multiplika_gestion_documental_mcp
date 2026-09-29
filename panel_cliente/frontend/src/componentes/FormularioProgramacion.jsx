import { useEffect, useState } from "react"
import {
  Alert, Button, Chip, Group, Modal, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Switch, Text, TextInput, Textarea,
} from "@mantine/core"
import { api } from "../api"

const TIPOS = [
  { value: "una_vez", label: "Una sola vez" },
  { value: "cada_dias", label: "Cada cierto número de días" },
  { value: "semanal", label: "Algunos días de la semana" },
  { value: "mensual", label: "Una vez al mes" },
  { value: "anual", label: "Una vez al año" },
]
const DIAS = ["L", "M", "X", "J", "V", "S", "D"]

function hoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function estadoInicial(programacion, idDocumentoInicial) {
  const regla = programacion?.regla
  return {
    titulo: programacion?.titulo || "",
    descripcion: programacion?.descripcion || "",
    tipo: regla?.tipo || "una_vez",
    fecha: regla?.fecha || hoy(),
    hora: regla?.hora || "09:00",
    cadaDias: regla?.cada_dias || 1,
    diasSemana: (regla?.dias_semana || []).map(String),
    hasta: regla?.hasta || "",
    idsUsuarios: (programacion?.destinatarios || []).map((d) => String(d.id)),
    idsDocumentos: programacion
      ? (programacion.documentos || []).map((d) => String(d.id))
      : idDocumentoInicial ? [String(idDocumentoInicial)] : [],
    avisarPorEmail: programacion ? programacion.avisar_por_email : true,
    requiereHecho: programacion?.requiere_hecho || false,
    // "" = sin límite: se recuerda hasta que alguien pulse Hecho
    maxRecordatorios: programacion?.max_recordatorios ?? 3,
    cadaDiasRecordatorio: programacion?.cada_dias_recordatorio || 1,
  }
}

// Alta y edición de una programación (aviso puntual o repetido).
export default function FormularioProgramacion({ opened, onClose, proyecto, programacion, idDocumentoInicial, onGuardado }) {
  const [datos, setDatos] = useState(() => estadoInicial(programacion, idDocumentoInicial))
  const [usuarios, setUsuarios] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!opened) return
    setDatos(estadoInicial(programacion, idDocumentoInicial))
    setError(null)
    api.listarUsuariosProyecto(proyecto.id).then(setUsuarios).catch(() => setUsuarios([]))
    api.listarOBuscarDocumentos(proyecto.id, "").then(setDocumentos).catch(() => setDocumentos([]))
  }, [opened, programacion, idDocumentoInicial, proyecto.id])

  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }))

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = {
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      regla: {
        tipo: datos.tipo, fecha: datos.fecha, hora: datos.hora,
        cada_dias: datos.tipo === "cada_dias" ? Number(datos.cadaDias) || 1 : null,
        dias_semana: datos.tipo === "semanal" ? datos.diasSemana.map(Number) : [],
        hasta: datos.tipo !== "una_vez" && datos.hasta ? datos.hasta : null,
      },
      ids_usuarios: datos.idsUsuarios.map(Number),
      ids_documentos: datos.idsDocumentos.map(Number),
      avisar_por_email: datos.avisarPorEmail,
      requiere_hecho: datos.requiereHecho,
      max_recordatorios: datos.maxRecordatorios === "" ? null : Number(datos.maxRecordatorios),
      cada_dias_recordatorio: Number(datos.cadaDiasRecordatorio) || 1,
    }
    // Al editar, la repetición solo se manda si cambió: si no, se recalcularía
    // la próxima fecha (y un aviso ya terminado daría "esa fecha ya pasó").
    if (programacion && JSON.stringify(cuerpo.regla) === JSON.stringify(programacion.regla)) delete cuerpo.regla
    try {
      const guardada = programacion
        ? await api.actualizarProgramacion(proyecto.id, programacion.id, cuerpo)
        : await api.crearProgramacion(proyecto.id, cuerpo)
      onGuardado(guardada)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const etiquetaFecha = {
    una_vez: "Día",
    cada_dias: "Desde el día",
    semanal: "Desde el día",
    mensual: "Primer aviso (se repite ese día de cada mes)",
    anual: "Primer aviso (se repite ese día cada año)",
  }[datos.tipo]

  return (
    <Modal opened={opened} onClose={onClose} title={programacion ? "Cambiar aviso" : "Nuevo aviso"} size="lg">
      <Stack component="form" onSubmit={guardar}>
        <TextInput
          label="Qué hay que recordar" required placeholder="Renovar el seguro de la furgoneta"
          value={datos.titulo} onChange={(e) => cambiar("titulo")(e.currentTarget.value)}
        />
        <Textarea
          label="Detalles" autosize minRows={2} placeholder="Opcional: lo que tiene que saber quien lo reciba"
          value={datos.descripcion} onChange={(e) => cambiar("descripcion")(e.currentTarget.value)}
        />

        <Select label="Cuándo" data={TIPOS} value={datos.tipo} onChange={(v) => cambiar("tipo")(v || "una_vez")} allowDeselect={false} />
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <TextInput
            type="date" label={etiquetaFecha} required
            value={datos.fecha} onChange={(e) => cambiar("fecha")(e.currentTarget.value)}
          />
          <TextInput
            type="time" label="Hora (de Madrid)" required
            value={datos.hora} onChange={(e) => cambiar("hora")(e.currentTarget.value)}
          />
        </SimpleGrid>
        {datos.tipo === "cada_dias" && (
          <NumberInput
            label="Cada cuántos días" min={1} max={365} description="1 = todos los días"
            value={datos.cadaDias} onChange={cambiar("cadaDias")}
          />
        )}
        {datos.tipo === "semanal" && (
          <div>
            <Text size="sm" fw={500} mb={6}>Qué días</Text>
            <Chip.Group multiple value={datos.diasSemana} onChange={cambiar("diasSemana")}>
              <Group gap={6}>
                {DIAS.map((letra, i) => (
                  <Chip key={letra} value={String(i + 1)} size="sm">{letra}</Chip>
                ))}
              </Group>
            </Chip.Group>
          </div>
        )}
        {datos.tipo !== "una_vez" && (
          <TextInput
            type="date" label="Hasta (opcional)" description="Último día en que puede avisar. Vacío = sin fin"
            value={datos.hasta} onChange={(e) => cambiar("hasta")(e.currentTarget.value)}
          />
        )}

        <MultiSelect
          label="A quién avisar" searchable
          placeholder={datos.idsUsuarios.length ? "" : "Si no eliges a nadie, te llega solo a ti"}
          data={usuarios.map((u) => ({ value: String(u.id), label: u.nombre }))}
          value={datos.idsUsuarios} onChange={cambiar("idsUsuarios")}
        />
        <MultiSelect
          label="Documentos relacionados (opcional)" searchable clearable
          data={documentos.map((d) => ({ value: String(d.id), label: `${d.nombre} (${d.tipo_documento})` }))}
          value={datos.idsDocumentos} onChange={cambiar("idsDocumentos")}
        />

        <Switch
          label="Avisar también por email" description="Sale desde la cuenta de correo del proyecto"
          checked={datos.avisarPorEmail} onChange={(e) => cambiar("avisarPorEmail")(e.currentTarget.checked)}
        />
        <Switch
          label='Hay que confirmarlo con "Hecho"'
          description="Se vuelve a recordar hasta que alguien pulse Hecho"
          checked={datos.requiereHecho} onChange={(e) => cambiar("requiereHecho")(e.currentTarget.checked)}
        />
        {datos.requiereHecho && (
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <NumberInput
              label="Recordar como mucho" suffix=" veces" min={0} max={365}
              description="Vacío = hasta que se pulse Hecho"
              value={datos.maxRecordatorios} onChange={cambiar("maxRecordatorios")}
            />
            <NumberInput
              label="Cada cuántos días" min={1} max={365}
              value={datos.cadaDiasRecordatorio} onChange={cambiar("cadaDiasRecordatorio")}
            />
          </SimpleGrid>
        )}

        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={guardando}>{programacion ? "Guardar cambios" : "Crear aviso"}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
