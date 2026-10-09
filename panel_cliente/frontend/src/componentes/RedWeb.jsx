import { useEffect, useState } from "react"
import { Alert, Badge, Button, Group, List, Paper, Stack, Table, Text } from "@mantine/core"
import { IconPlus } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"
import EditorPublicacion from "./EditorPublicacion"
import { ESTADOS_PUBLICACION } from "../webs"

// Pasos para conectar la red, según la forma elegida (se enseñan aquí, al usarla)
function ComoConectar({ activo }) {
  if ((activo.modo_conexion || "intermediario") === "intermediario") {
    return (
      <List size="sm" type="ordered">
        <List.Item>Crea una cuenta en ayrshare.com (servicio de pago por perfil) y conecta allí esta red con su usuario.</List.Item>
        <List.Item>En Ayrshare → API Key, copia la clave.</List.Item>
        <List.Item>En la gestión documental, Administración → Credenciales: crea una con esa clave como valor (y, si tu plan es de empresa con varios perfiles, un campo «profile_key»).</List.Item>
        <List.Item>Elige esa credencial en «Datos y ajustes» de esta red y pulsa «Probar conexión».</List.Item>
      </List>
    )
  }
  return (
    <Stack gap={4}>
      <Text fz="13px">
        La conexión directa usa una aplicación de Meta del propio cliente. Para gestionar solo tus páginas suele bastar el modo de desarrollo; para
        otros usos Meta pide revisar la aplicación, y eso puede tardar semanas (o denegarse). Mientras, se puede usar el intermediario.
      </Text>
      <List size="sm" type="ordered">
        <List.Item>En developers.facebook.com, crea una aplicación de tipo «Empresa» y añade los productos de Facebook Login e Instagram.</List.Item>
        <List.Item>Pide los permisos de publicar en la página (pages_manage_posts, pages_read_engagement) y, para Instagram, instagram_content_publish.</List.Item>
        <List.Item>Genera un token de acceso de página de larga duración.</List.Item>
        <List.Item>Crea una credencial con ese token como valor y un campo «page_id» (Facebook) o «ig_user_id» (Instagram profesional).</List.Item>
        <List.Item>Elígela en «Datos y ajustes» y pulsa «Probar conexión».</List.Item>
      </List>
    </Stack>
  )
}

export default function RedWeb({ proyecto, activo, refresco, onPropuesta }) {
  const [publicaciones, setPublicaciones] = useState(null)
  const [abierta, setAbierta] = useState(null)

  function cargar() {
    api.listarPublicaciones(proyecto.id, { id_activo: activo.id }).then(setPublicaciones).catch(() => setPublicaciones([]))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto.id, activo.id, refresco])

  return (
    <Stack gap="md">
      {(!activo.nombre_credencial || activo.estado === "error") && (
        <Alert color="blue" title="Cómo conectar esta red"><ComoConectar activo={activo} /></Alert>
      )}
      <Group justify="space-between">
        <Text fz="13.5px" c="dimmed">Publicaciones en esta red. El calendario con todas está en «Webs y redes → Calendario».</Text>
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setAbierta({ id: null })}>Nueva publicación</Button>
      </Group>
      {publicaciones && publicaciones.length === 0 && <Text c="dimmed" fz="13.5px">Todavía ninguna.</Text>}
      {publicaciones && publicaciones.length > 0 && (
        <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
          <Table verticalSpacing="xs" fz="13px" highlightOnHover>
            <Table.Tbody>
              {publicaciones.map((p) => (
                <Table.Tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setAbierta({ id: p.id })}>
                  <Table.Td w={150}>{p.fecha_prevista ? formatearFecha(p.fecha_prevista) : "Sin fecha"}</Table.Td>
                  <Table.Td>{p.titulo}</Table.Td>
                  <Table.Td>{p.metricas?.[activo.id]?.me_gusta != null && `${p.metricas[activo.id].me_gusta} me gusta`}</Table.Td>
                  <Table.Td w={170}><Badge color={ESTADOS_PUBLICACION[p.estado]?.color} variant="light" tt="none">{ESTADOS_PUBLICACION[p.estado]?.etiqueta}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      {abierta && (
        <EditorPublicacion proyecto={proyecto} idPublicacion={abierta.id} idRedInicial={activo.id} onCerrar={() => setAbierta(null)}
          onCambiada={cargar} onPropuesta={(c) => { setAbierta(null); onPropuesta(c) }} />
      )}
    </Stack>
  )
}
