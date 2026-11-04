import { lazy, Suspense, useEffect, useState } from "react"
import { ActionIcon, Alert, Box, Button, Center, Group, Loader, NavLink, Stack, Text, Title, Tooltip } from "@mantine/core"
import { IconMenu2, IconMessageCircle } from "@tabler/icons-react"
import { api, sesionPanel } from "../api"
import SelectorEmpresa, { fondoEmpresa } from "../componentes/SelectorEmpresa"

// Carga diferida: las pantallas solo se descargan al abrir este apartado.
const EmbebidoLaboratorio = lazy(() => import("@contabilidad/EmbebidoLaboratorio.tsx"))

// Mismo ancho que el menú de la contabilidad
const ANCHO_MENU = 220

const OPCIONES = [
  { id: "muestras", titulo: "Muestras" },
  { id: "facturar", titulo: "Facturar" },
  { id: "catalogos", titulo: "Catálogos" },
  { id: "portal", titulo: "Portal de clientes" },
]

// Laboratorio: muestras, informes, facturación y portal de clientes, sobre el
// SIF de la empresa que se elija (con los accesos al SIF de cada usuario).
// Es independiente de la contabilidad. No tiene interruptor: sale si el SIF lo da en alguna empresa.
export default function Laboratorio({ proyecto, onVerAccesos, onAlternarMenu, onAlternarChat }) {
  const [empresas, setEmpresas] = useState(null)
  const [error, setError] = useState(null)
  const [idEmpresa, setIdEmpresa] = useState(null)
  const [seccion, setSeccion] = useState("muestras")

  useEffect(() => {
    api
      .empresasLaboratorio(proyecto.id)
      .then((r) => {
        setEmpresas(r.empresas)
        setIdEmpresa(r.empresas[0] ? String(r.empresas[0].id_empresa) : null)
      })
      .catch((err) => {
        setEmpresas([])
        setError(err.message)
      })
  }, [proyecto.id])

  const empresa = empresas?.find((e) => String(e.id_empresa) === idEmpresa)

  if (empresas === null) return <Loader size="sm" />
  if (!empresa) {
    return (
      <Alert color="blue">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text fz="sm">{error || "Ninguno de tus accesos al SIF funciona ahora mismo."}</Text>
          <Button size="xs" onClick={onVerAccesos}>Revisar mis accesos</Button>
        </Group>
      </Alert>
    )
  }

  // Pantalla completa, como la contabilidad: la cabecera y el menú se quedan
  // quietos (el de la GD se esconde y se abre con el botón) y solo se mueve
  // la tabla de la pantalla elegida.
  return (
    <Stack gap="xs" h="calc(100dvh - 2 * var(--mantine-spacing-xs))">
      <Group justify="space-between" wrap="nowrap" gap="lg" p={4} style={{ borderRadius: "var(--mantine-radius-sm)", background: fondoEmpresa(empresa.id_empresa) }}>
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label="Menú de la gestión documental">
            <ActionIcon variant="default" size="lg" aria-label="Abrir o cerrar el menú de la gestión documental" onClick={onAlternarMenu}>
              <IconMenu2 size={18} />
            </ActionIcon>
          </Tooltip>
          <Title order={4}>Laboratorio</Title>
        </Group>
        {empresas.length > 1 ? <SelectorEmpresa empresas={empresas} value={idEmpresa} onChange={setIdEmpresa} /> : <span />}
        {onAlternarChat && (
          <Tooltip label="Chat con la IA">
            <ActionIcon variant="light" size="lg" aria-label="Abrir o cerrar el chat con la IA" onClick={onAlternarChat}>
              <IconMessageCircle size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Group align="stretch" wrap="nowrap" gap="md" style={{ flex: 1, minHeight: 0 }}>
        <Box w={ANCHO_MENU} pr="xs" style={{ flexShrink: 0, overflowY: "auto", borderRight: "1px solid var(--mantine-color-default-border)" }}>
          {OPCIONES.map((o) => (
            <NavLink key={o.id} label={o.titulo} active={seccion === o.id} onClick={() => setSeccion(o.id)} />
          ))}
        </Box>
        <Box style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Suspense fallback={<Center py="xl"><Loader /></Center>}>
            <EmbebidoLaboratorio key={empresa.id_empresa} sesion={sesionPanel} idProyecto={proyecto.id} idEmpresa={empresa.id_empresa} seccion={seccion} />
          </Suspense>
        </Box>
      </Group>
    </Stack>
  )
}
