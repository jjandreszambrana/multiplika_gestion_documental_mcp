import { Anchor, Badge, Paper, Table, Text, Tooltip } from "@mantine/core"
import { formatearFecha } from "../formato"

const ORIGENES = {
  ia: { etiqueta: "IA", color: "violet", ayuda: "Desde Claude, ChatGPT u otra IA conectada con una API key" },
  chat: { etiqueta: "Chat", color: "blue", ayuda: "Desde el chat con la IA de este panel" },
  panel: { etiqueta: "Panel", color: "gray", ayuda: "Desde un botón de este panel" },
}

// Tabla del registro de actividad (gd_actividad) — la usan la pantalla
// "Actividad" y la pestaña del mismo nombre en la ficha de un documento.
export default function TablaActividad({ filas, onVerDocumento }) {
  return (
    <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
      <Table striped verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={170}>Cuándo</Table.Th>
            <Table.Th w={220}>Quién</Table.Th>
            <Table.Th>Qué hizo</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filas.map((f) => {
            const origen = ORIGENES[f.origen] || ORIGENES.panel
            const enlazable = onVerDocumento && f.tipo_objeto === "documento" && f.id_objeto
            return (
              <Table.Tr key={f.id}>
                <Table.Td>
                  <Text size="13px" c="dimmed">
                    {formatearFecha(f.fecha)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="13px" fw={500} span mr="6">
                    {f.quien}
                  </Text>
                  <Tooltip label={origen.ayuda}>
                    <Badge size="xs" variant="light" color={origen.color} radius="sm">
                      {origen.etiqueta}
                    </Badge>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  {enlazable ? (
                    <Anchor component="button" type="button" size="13.5px" ta="left" onClick={() => onVerDocumento(f.id_objeto)}>
                      {f.descripcion}
                    </Anchor>
                  ) : (
                    <Text size="13.5px">{f.descripcion}</Text>
                  )}
                  {f.detalle && (
                    <Text
                      component="details" size="12px" c="dimmed" mt="4"
                      style={{ cursor: "pointer", wordBreak: "break-word" }}
                    >
                      <summary>Detalle</summary>
                      <pre style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{detalleLegible(f.detalle)}</pre>
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  )
}

function detalleLegible(detalle) {
  try {
    return JSON.stringify(JSON.parse(detalle), null, 2)
  } catch {
    return detalle
  }
}
