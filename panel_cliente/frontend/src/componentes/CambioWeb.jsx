import { useState } from "react"
import { Alert, Badge, Box, Button, Group, Modal, ScrollArea, Stack, Table, Text, TextInput } from "@mantine/core"
import { api } from "../api"
import { formatearFecha } from "../formato"
import { ESTADOS_CAMBIO } from "../webs"

const VIAS = { ia: "IA", chat: "chat del panel", panel: "panel", automatica: "automático" }

const NOMBRES_CAMPO = {
  titulo: "Título", contenido: "Contenido", extracto: "Extracto", estado: "Estado", slug: "Dirección (slug)",
  nombre_archivo: "Archivo", titulo_medio: "Título", texto_alternativo: "Texto alternativo",
  version: "Versión", nombre: "Copia", fecha: "Fecha de la copia",
}

function Valor({ valor }) {
  if (valor === null || valor === undefined || valor === "") return <Text c="dimmed" fz="13px">(vacío)</Text>
  const texto = typeof valor === "object" ? JSON.stringify(valor, null, 2) : String(valor)
  if (texto.length < 120 && !texto.includes("\n")) return <Text fz="13px">{texto}</Text>
  return (
    <ScrollArea.Autosize mah={220} type="auto">
      <Box component="pre" fz="12px" m={0} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace" }}>
        {texto}
      </Box>
    </ScrollArea.Autosize>
  )
}

export function EstadoCambio({ estado }) {
  const e = ESTADOS_CAMBIO[estado] || { etiqueta: estado, color: "gray" }
  return <Badge color={e.color} variant="light" radius="sm" tt="none" fw={500}>{e.etiqueta}</Badge>
}

// Vista previa de un cambio (el antes y el después) con lo que se puede
// hacer según su estado: aplicar o rechazar una propuesta, deshacer uno
// aplicado. Es el mismo freno para la IA y para el panel: el cambio ya está
// guardado como propuesta y aquí solo se decide.
export default function CambioWeb({ proyecto, cambio, nivel, onCerrar, onCambiado }) {
  const [trabajando, setTrabajando] = useState(null)
  const [error, setError] = useState(null)
  const [motivo, setMotivo] = useState("")
  const [confirmarDeshacer, setConfirmarDeshacer] = useState(false)

  if (!cambio) return null
  const antes = cambio.datos_antes || {}
  const despues = cambio.datos_despues || {}
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter(
    (c) => !["id_documento", "id_version", "tipo_mime"].includes(c),
  )
  const soloPanel = nivel === "proponer"

  async function hacer(accion) {
    setTrabajando(accion)
    setError(null)
    try {
      let resultado
      if (accion === "aplicar") resultado = await api.aplicarCambioWeb(proyecto.id, cambio.id)
      if (accion === "rechazar") resultado = await api.rechazarCambioWeb(proyecto.id, cambio.id, motivo)
      if (accion === "deshacer") resultado = await api.deshacerCambioWeb(proyecto.id, cambio.id)
      setConfirmarDeshacer(false)
      onCambiado(resultado)
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(null)
    }
  }

  return (
    <Modal opened onClose={onCerrar} size="xl" title={<Text fw={600}>Cambio n.º {cambio.id}</Text>}>
      <Stack gap="sm">
        <Group gap="xs">
          <EstadoCambio estado={cambio.estado} />
          {cambio.nombre_activo && <Text fz="13px" c="dimmed">{cambio.nombre_activo}</Text>}
        </Group>
        <Text fw={500}>{cambio.resumen}</Text>
        {cambio.motivo && <Text fz="13.5px">Motivo: {cambio.motivo}</Text>}
        <Text fz="12.5px" c="dimmed">
          Propuesto por {cambio.propuesto_por} ({VIAS[cambio.via_propuesta] || cambio.via_propuesta}) el {formatearFecha(cambio.fecha_propuesta)}
          {cambio.resuelto_por && ` · ${cambio.estado === "rechazado" ? "Rechazado" : "Resuelto"} por ${cambio.resuelto_por} (${VIAS[cambio.via_resolucion] || cambio.via_resolucion}) el ${formatearFecha(cambio.fecha_resolucion)}`}
          {cambio.deshecho_por && ` · Deshecho por ${cambio.deshecho_por} el ${formatearFecha(cambio.fecha_deshecho)}`}
        </Text>

        {cambio.detalle_purgado ? (
          <Alert color="gray">La copia de este cambio ya se borró por antigüedad: queda el resumen, pero no se puede deshacer.</Alert>
        ) : campos.length > 0 && (
          <Table withTableBorder verticalSpacing="xs" layout="fixed">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={150}>Campo</Table.Th>
                <Table.Th>Antes</Table.Th>
                <Table.Th>Después</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campos.map((c) => (
                <Table.Tr key={c}>
                  <Table.Td><Text fz="13px" fw={500}>{NOMBRES_CAMPO[c] || c}</Text></Table.Td>
                  <Table.Td>{cambio.datos_antes ? <Valor valor={antes[c]} /> : <Text c="dimmed" fz="13px">(no existía)</Text>}</Table.Td>
                  <Table.Td><Valor valor={despues[c]} /></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {cambio.resultado && (
          <Alert color={cambio.estado === "fallido" || cambio.resultado.includes("ATENCIÓN") ? "red" : cambio.estado === "caducado" ? "yellow" : "teal"}>
            {cambio.resultado}
          </Alert>
        )}
        {cambio.datos_aplicados?.enlace && (
          <Text fz="13px">
            Ver en la web: <a href={cambio.datos_aplicados.enlace} target="_blank" rel="noreferrer">{cambio.datos_aplicados.enlace}</a>
          </Text>
        )}
        {error && <Alert color="red">{error}</Alert>}

        {cambio.estado === "propuesto" && (
          <>
            {soloPanel && (
              <Text fz="12.5px" c="dimmed">Esta web está en nivel «Proponer»: los cambios solo se aprueban aquí.</Text>
            )}
            <Group justify="space-between" align="flex-end">
              <TextInput
                label="Motivo del rechazo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                style={{ flex: 1, maxWidth: 360 }}
              />
              <Group>
                <Button variant="default" onClick={() => hacer("rechazar")} loading={trabajando === "rechazar"} disabled={!!trabajando}>
                  Rechazar
                </Button>
                <Button onClick={() => hacer("aplicar")} loading={trabajando === "aplicar"} disabled={!!trabajando}>
                  Aplicar en la web
                </Button>
              </Group>
            </Group>
          </>
        )}
        {cambio.estado === "aplicado" && !cambio.detalle_purgado && (
          confirmarDeshacer ? (
            <Alert color="orange" title="¿Deshacer este cambio?">
              <Text fz="13.5px" mb="sm">
                La web volverá a como estaba antes. Si después alguien ha vuelto a tocar lo mismo, no se deshará, para no pisarlo.
              </Text>
              <Group>
                <Button color="orange" onClick={() => hacer("deshacer")} loading={trabajando === "deshacer"}>Sí, deshacer</Button>
                <Button variant="default" onClick={() => setConfirmarDeshacer(false)} disabled={!!trabajando}>No</Button>
              </Group>
            </Alert>
          ) : (
            <Group justify="flex-end">
              <Button variant="light" color="orange" onClick={() => setConfirmarDeshacer(true)}>Deshacer</Button>
            </Group>
          )
        )}
      </Stack>
    </Modal>
  )
}
