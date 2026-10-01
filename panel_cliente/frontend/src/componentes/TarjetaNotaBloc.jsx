import { Badge, Group, Paper, Text, Tooltip } from "@mantine/core"
import { IconLock, IconPinFilled, IconUsers, IconWorld } from "@tabler/icons-react"
import { formatearFecha } from "../formato"
import { BadgeSeguimiento } from "./Seguimiento"

export const VISIBILIDADES = {
  privada: { etiqueta: "Solo yo", icono: IconLock, ayuda: "Solo la ve quien la escribió" },
  personas: { etiqueta: "Algunas personas", icono: IconUsers, ayuda: "Quien la escribió y las personas elegidas" },
  todos: { etiqueta: "Todos", icono: IconWorld, ayuda: "Cualquiera del proyecto" },
}

// Distintivo de color de una nota (ver COLORES en _dep_bloc_notas.py)
export const COLORES = [
  { value: "red", label: "Rojo" },
  { value: "orange", label: "Naranja" },
  { value: "yellow", label: "Amarillo" },
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "grape", label: "Morado" },
  { value: "pink", label: "Rosa" },
  { value: "gray", label: "Gris" },
]

// Una nota del bloc en un listado: título, resumen, fecha y etiquetas.
export default function TarjetaNotaBloc({ nota, onClick, compacta = false }) {
  const visibilidad = VISIBILIDADES[nota.visibilidad] || VISIBILIDADES.todos
  const Icono = visibilidad.icono
  const resumen = nota.descripcion || nota.contenido

  return (
    <Paper
      withBorder radius="md" p={compacta ? "xs" : "sm"} onClick={onClick}
      style={{
        cursor: "pointer",
        borderLeft: nota.color ? `5px solid var(--mantine-color-${nota.color}-6)` : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Group gap="6" wrap="nowrap">
            {nota.fijada && <IconPinFilled size={14} color="var(--mantine-color-acento-6)" style={{ flexShrink: 0 }} />}
            <Text fw={500} size="sm" truncate>
              {nota.titulo}
            </Text>
          </Group>
          {resumen && !compacta && (
            <Text size="12.5px" c="dimmed" lineClamp={2} mt={2}>
              {resumen}
            </Text>
          )}
          {nota.etiquetas?.length > 0 && (
            <Group gap="4" mt="6">
              {nota.etiquetas.map((e) => (
                <Badge key={e} size="sm" variant="light" color="gray" tt="none" fw={500}>
                  {e}
                </Badge>
              ))}
            </Group>
          )}
        </div>
        <Group gap="6" wrap="nowrap" style={{ flexShrink: 0 }}>
          <BadgeSeguimiento seguimiento={nota.seguimiento} />
          <Text size="12px" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {formatearFecha(nota.fecha).slice(0, 16)}
          </Text>
          <Tooltip label={visibilidad.ayuda}>
            <Icono size={15} stroke={1.8} color="var(--mantine-color-dimmed)" />
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}
