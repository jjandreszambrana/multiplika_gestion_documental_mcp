import { Component, useEffect, useState } from "react"
import { ActionIcon, Alert, Box, Button, Group, Loader, NavLink, Select, Stack, Text, Title, Tooltip } from "@mantine/core"
import { IconMenu2, IconMessageCircle } from "@tabler/icons-react"
import { api } from "../api"
import { ConexionErpContenido } from "../componentes/ConexionErp"
import MaestroSif from "../componentes/erp/MaestroSif"
import FacturasVenta from "../componentes/erp/facturas/FacturasVenta"
import FacturasCompra from "../componentes/erp/facturas/FacturasCompra"
import { MAESTROS } from "../componentes/erp/maestros"

// Mismo ancho que el menú de la contabilidad (contabilidad_ui, Estructura)
const ANCHO_MENU = 220

// ERP → Gestión SIF: los maestros de facturación del SIF, como la
// contabilidad: pantalla completa con su propio menú a la izquierda (el de la
// GD se esconde y se abre con el botón), con los accesos al SIF de cada
// usuario y en la empresa que elija. La conexión que alimenta el CRM va al final.
export default function Erp({ proyecto, onVerAccesos, onAlternarMenu, onAlternarChat }) {
  const [empresas, setEmpresas] = useState(null)
  const [error, setError] = useState(null)
  const [idEmpresa, setIdEmpresa] = useState(null)
  const [seccion, setSeccion] = useState("facturas_venta")

  useEffect(() => {
    api
      .empresasContables(proyecto.id)
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
  const maestro = MAESTROS.find((m) => m.id === seccion)

  const contenido = seccion === "conexion" ? (
    <ConexionErpContenido proyecto={proyecto} />
  ) : empresas === null ? (
    <Loader size="sm" />
  ) : !empresa ? (
    <Alert color="blue">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Text fz="sm">{error || "Ninguno de tus accesos al SIF funciona ahora mismo."}</Text>
        <Button size="xs" onClick={onVerAccesos}>Revisar mis accesos</Button>
      </Group>
    </Alert>
  ) : seccion === "facturas_compra" ? (
    <FacturasCompra key={empresa.id_empresa} proyecto={proyecto} empresa={empresa} />
  ) : seccion === "facturas_venta" ? (
    <FacturasVenta key={empresa.id_empresa} proyecto={proyecto} empresa={empresa} />
  ) : (
    <MaestroSif key={`${maestro.id}-${empresa.id_empresa}`} proyecto={proyecto} empresa={empresa} maestro={maestro} />
  )

  // Ocupa justo el alto de la ventana: la cabecera y el menú se quedan
  // quietos y solo se mueve la zona de contenido (ahí dentro, las listas
  // mueven solo sus filas y las fichas dejan fija su parte de arriba)
  return (
    <Stack gap="xs" h="calc(100dvh - 2 * var(--mantine-spacing-xs))">
      <Group justify="space-between" wrap="nowrap" gap="lg">
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label="Menú de la gestión documental">
            <ActionIcon variant="default" size="lg" aria-label="Abrir o cerrar el menú de la gestión documental" onClick={onAlternarMenu}>
              <IconMenu2 size={18} />
            </ActionIcon>
          </Tooltip>
          <Title order={4}>Gestión SIF</Title>
        </Group>
        {empresas?.length > 1 && seccion !== "conexion" ? (
          <Select
            aria-label="Empresa" w={480} maw="100%" searchable allowDeselect={false} value={idEmpresa} onChange={setIdEmpresa}
            data={empresas.map((e) => ({ value: String(e.id_empresa), label: `${e.nombre}${e.nif ? ` (${e.nif})` : ""}` }))}
          />
        ) : <span />}
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
          <TituloGrupo primero>Maestros</TituloGrupo>
          {MAESTROS.filter((m) => !m.oculto).map((m) => (
            <NavLink key={m.id} label={m.titulo} active={seccion === m.id} onClick={() => setSeccion(m.id)} />
          ))}
          <TituloGrupo>Gestión</TituloGrupo>
          <NavLink label="Facturas de venta" active={seccion === "facturas_venta"} onClick={() => setSeccion("facturas_venta")} />
          <NavLink label="Facturas de compra" active={seccion === "facturas_compra"} onClick={() => setSeccion("facturas_compra")} />
          {proyecto.puede_editar && (
            <>
              <TituloGrupo>Configuración</TituloGrupo>
              <NavLink label="Conexión con el CRM" active={seccion === "conexion"} onClick={() => setSeccion("conexion")} />
            </>
          )}
        </Box>
        <Box style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <SinRomper key={seccion}>{contenido}</SinRomper>
        </Box>
      </Group>
    </Stack>
  )
}

// Título de un grupo del menú, con el aspecto de los del menú de la GD
function TituloGrupo({ primero, children }) {
  return (
    <Text size="11px" fw={600} c="dimmed" tt="uppercase" px="8" mt={primero ? 6 : "md"} mb="4" style={{ letterSpacing: ".04em" }}>
      {children}
    </Text>
  )
}

// Si una pantalla falla al pintarse, un aviso en vez de la página en blanco
class SinRomper extends Component {
  state = { fallo: null }
  static getDerivedStateFromError(fallo) {
    return { fallo }
  }
  render() {
    if (!this.state.fallo) return this.props.children
    return (
      <Alert color="red" title="Esta pantalla ha fallado">
        {String(this.state.fallo?.message || this.state.fallo)}. Vuelve a entrar desde el menú de la izquierda.
      </Alert>
    )
  }
}
