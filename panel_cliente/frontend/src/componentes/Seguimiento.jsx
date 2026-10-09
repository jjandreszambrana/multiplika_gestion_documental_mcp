import { useEffect, useState } from "react"
import { Alert, Badge, Button, Group, Popover, Select, Stack, Text, TextInput, Tooltip, UnstyledButton } from "@mantine/core"
import { IconChevronDown } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

// Estado de seguimiento de una nota del bloc, un documento o una nota de
// un documento (ver docs/gestion-documental.md → "Seguimiento").
export const ESTADOS_SEGUIMIENTO = {
  pendiente: { etiqueta: "Pendiente", color: "orange" },
  en_curso: { etiqueta: "En curso", color: "blue" },
  realizado: { etiqueta: "Realizado", color: "green" },
  aplazado: { etiqueta: "Aplazado", color: "grape" },
}

export const TIPOS_SEGUIMIENTO = {
  nota_bloc: "Nota del bloc",
  documento: "Documento",
  nota_documento: "Nota de documento",
}

// Una sola petición por proyecto aunque haya muchos controles en pantalla
// (p.ej. uno por cada nota de un documento)
const usuariosPorProyecto = {}
function cargarUsuarios(idProyecto) {
  usuariosPorProyecto[idProyecto] ||= api.listarUsuariosProyecto(idProyecto).catch(() => {
    delete usuariosPorProyecto[idProyecto]
    return []
  })
  return usuariosPorProyecto[idProyecto]
}

// "2026-10-02T09:00:00" → "02/10/2026 09:00"
function fechaCorta(valor) {
  return formatearFecha(valor).slice(0, 16)
}

// Mañana a las 9:00, en el formato de un <input type="datetime-local">
function mananaALas9() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const dos = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T09:00`
}

// Solo lectura: el estado en una etiqueta de color (nada si no tiene)
export function BadgeSeguimiento({ seguimiento, size = "sm" }) {
  const estado = ESTADOS_SEGUIMIENTO[seguimiento?.estado]
  if (!estado) return null
  return (
    <Badge size={size} variant="light" color={estado.color} style={{ flexShrink: 0 }}>
      {estado.etiqueta}
      {seguimiento.estado === "aplazado" && seguimiento.aplazado_hasta ? ` hasta ${fechaCorta(seguimiento.aplazado_hasta).slice(0, 10)}` : ""}
    </Badge>
  )
}

// El estado, quién se encarga y, si está aplazado, hasta cuándo. Pulsando
// se cambia (salvo invitados). `seguimiento`: el que ya venga con el
// elemento (null = sin estado); si no se pasa, lo pide.
export default function ControlSeguimiento({ proyecto, tipo, idObjeto, seguimiento: inicial, size = "sm", onCambiado, refresco }) {
  const [seguimiento, setSeguimiento] = useState(inicial ?? null)
  const [usuarios, setUsuarios] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ estado: null, responsable: null, hasta: "" })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (inicial !== undefined) {
      setSeguimiento(inicial)
      return
    }
    api.obtenerSeguimiento(proyecto.id, tipo, idObjeto).then(setSeguimiento).catch(() => setSeguimiento(null))
  }, [proyecto.id, tipo, idObjeto, inicial, refresco])

  useEffect(() => {
    cargarUsuarios(proyecto.id).then(setUsuarios)
  }, [proyecto.id])

  function abrir() {
    setForm({
      estado: seguimiento?.estado || "",
      responsable: seguimiento?.id_usuario_responsable ? String(seguimiento.id_usuario_responsable) : "",
      hasta: seguimiento?.aplazado_hasta ? String(seguimiento.aplazado_hasta).slice(0, 16) : mananaALas9(),
    })
    setError(null)
    setAbierto(true)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await api.cambiarSeguimiento(proyecto.id, tipo, idObjeto, {
        estado: form.estado || null,
        id_usuario_responsable: form.responsable ? Number(form.responsable) : null,
        aplazado_hasta: form.estado === "aplazado" ? form.hasta : null,
      })
      setSeguimiento(nuevo)
      setAbierto(false)
      onCambiado?.(nuevo)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const estado = ESTADOS_SEGUIMIENTO[seguimiento?.estado]
  const idResponsable = seguimiento?.id_usuario_responsable
  const responsable = idResponsable
    ? seguimiento.responsable || usuarios.find((u) => u.id === idResponsable)?.nombre || `Usuario n.º ${idResponsable}`
    : null

  const etiqueta = (
    <Group gap="6" wrap="nowrap">
      <Badge
        size={size} variant={estado ? "light" : "outline"} color={estado ? estado.color : "gray"}
        rightSection={proyecto.puede_editar ? <IconChevronDown size={11} /> : null}
        style={{ cursor: proyecto.puede_editar ? "pointer" : undefined, flexShrink: 0 }}
      >
        {estado ? estado.etiqueta : "Sin estado"}
      </Badge>
      {estado && (responsable || seguimiento.estado === "aplazado") && (
        <Text size="12px" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {[
            seguimiento.estado === "aplazado" && seguimiento.aplazado_hasta ? `hasta ${fechaCorta(seguimiento.aplazado_hasta)}` : null,
            responsable,
          ].filter(Boolean).join(" · ")}
        </Text>
      )}
    </Group>
  )

  if (!proyecto.puede_editar) return etiqueta

  // comboboxProps withinPortal=false: si no, elegir una opción de un
  // desplegable cuenta como pulsar fuera y cierra la ventanita
  return (
    <Popover opened={abierto} onChange={setAbierto} width={290} position="bottom-start" shadow="md" withArrow trapFocus>
      <Popover.Target>
        <Tooltip label="Estado de seguimiento: pulsa para cambiarlo" disabled={abierto} openDelay={400}>
          <UnstyledButton
            onClick={(e) => {
              e.stopPropagation() // dentro de una tarjeta que se abre al pulsarla
              abierto ? setAbierto(false) : abrir()
            }}
          >
            {etiqueta}
          </UnstyledButton>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
        <Stack gap="xs">
          <Select
            label="Estado" allowDeselect={false} comboboxProps={{ withinPortal: false }}
            data={[{ value: "", label: "Sin estado (fuera del seguimiento)" },
              ...Object.entries(ESTADOS_SEGUIMIENTO).map(([value, e]) => ({ value, label: e.etiqueta }))]}
            value={form.estado} onChange={(v) => setForm((f) => ({ ...f, estado: v }))}
          />
          {form.estado && (
            <Select
              label="Quién se encarga" allowDeselect={false} comboboxProps={{ withinPortal: false }} searchable
              description="Le llega cada mañana en su resumen. Si no es nadie, les llega a todos."
              data={[{ value: "", label: "Nadie en concreto" },
                ...usuarios.filter((u) => u.puede_editar !== false || u.id === idResponsable)
                  .map((u) => ({ value: String(u.id), label: u.nombre }))]}
              value={form.responsable} onChange={(v) => setForm((f) => ({ ...f, responsable: v }))}
            />
          )}
          {form.estado === "aplazado" && (
            <TextInput
              type="datetime-local" label="Aplazado hasta" required
              description="Ese día te llega un aviso y vuelve a estar pendiente."
              value={form.hasta} onChange={(e) => setForm((f) => ({ ...f, hasta: e.currentTarget.value }))}
            />
          )}
          {error && <Alert color="red" p="xs">{error}</Alert>}
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button size="xs" onClick={guardar} loading={guardando} disabled={form.estado === "aplazado" && !form.hasta}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
