import { Group, Select, Text } from "@mantine/core"

// Cada empresa con su color de fondo, para ver de un vistazo en cuál se está
// contabilizando. Sale de su id: la misma empresa tiene siempre el mismo color.
const COLORES = ["blue", "orange", "teal", "grape", "red", "lime", "indigo", "yellow", "cyan", "pink", "green", "violet"]

export const colorEmpresa = (idEmpresa) => COLORES[Math.abs(Number(idEmpresa) || 0) % COLORES.length]

// Tono del color de la empresa, fuerte para que se note (más oscuro en modo oscuro)
const tono = (color, claro, oscuro) => `light-dark(var(--mantine-color-${color}-${claro}), var(--mantine-color-${color}-${oscuro}))`

// Fondo de la franja de arriba de la pantalla
export const fondoEmpresa = (idEmpresa) => idEmpresa == null ? undefined : tono(colorEmpresa(idEmpresa), 2, 9)

export default function SelectorEmpresa({ empresas, value, onChange, ...props }) {
  const color = value == null ? null : colorEmpresa(value)
  return (
    <Select
      aria-label="Empresa" w={480} maw="100%" searchable allowDeselect={false} value={value} onChange={onChange}
      data={empresas.map((e) => ({ value: String(e.id_empresa), label: `${e.nombre}${e.nif ? ` (${e.nif})` : ""}` }))}
      styles={color ? {
        input: {
          background: tono(color, 3, 8), fontWeight: 700,
          borderColor: `var(--mantine-color-${color}-filled)`, borderWidth: 2, borderLeftWidth: 10,
        },
      } : undefined}
      renderOption={({ option }) => (
        <Group gap="xs" wrap="nowrap">
          <span style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: `var(--mantine-color-${colorEmpresa(option.value)}-filled)` }} />
          <Text fz="sm">{option.label}</Text>
        </Group>
      )}
      {...props}
    />
  )
}
