import { useEffect, useState } from "react"
import { Alert, Anchor, Autocomplete, Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Tabs, Text, TextInput, Title, useComputedColorScheme } from "@mantine/core"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconClockHour4,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconFileText,
  IconHistory,
  IconMessageCircle,
  IconSend,
} from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import { formatearFecha } from "../formato"
import HistorialEdicion from "../componentes/HistorialEdicion"
import RegistrosDocumento from "../componentes/RegistrosDocumento"
import GruposDocumento from "../componentes/GruposDocumento"
import EntidadesDocumento from "../componentes/EntidadesDocumento"
import EnviosDocumento from "../componentes/EnviosDocumento"

function CampoMeta({ etiqueta, valor }) {
  return (
    <Group justify="space-between" py="7" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
      <Text size="12.5px" c="dimmed">
        {etiqueta}
      </Text>
      <Text size="13px" fw={500} ta="right">
        {valor}
      </Text>
    </Group>
  )
}

export default function DocumentoDetalle({ proyecto, idDocumento, onVolver }) {
  const [documento, setDocumento] = useState(null)
  const [error, setError] = useState(null)
  const [cambiandoArchivo, setCambiandoArchivo] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const [editando, setEditando] = useState(false)
  const [textoEditado, setTextoEditado] = useState("")
  const [tipoDocumentoEditado, setTipoDocumentoEditado] = useState("")
  const [ambitoEditado, setAmbitoEditado] = useState("")
  const [fechaCaducidadEditada, setFechaCaducidadEditada] = useState("")
  const [tiposDocumento, setTiposDocumento] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [historialVersion, setHistorialVersion] = useState(0)
  const [vista, setVista] = useState("documento")
  const [registros, setRegistros] = useState(null)
  const incidenciasAbiertas = registros?.filter((r) => r.tipo === "incidencia" && r.estado === "abierta").length || 0
  const esquemaColor = useComputedColorScheme("light")

  useEffect(() => {
    cargarDocumento()
  }, [proyecto.id, idDocumento])

  useEffect(() => {
    api.listarTiposDocumento(proyecto.id)
      .then((tipos) => setTiposDocumento(tipos.map((t) => t.nombre)))
      .catch(() => setTiposDocumento([]))
  }, [proyecto.id])

  function cargarDocumento() {
    return api
      .obtenerDocumento(proyecto.id, idDocumento)
      .then((d) => {
        setDocumento(d)
        setHistorialVersion((v) => v + 1)
      })
      .catch((err) => setError(err.message))
  }

  async function alternarArchivado() {
    setCambiandoArchivo(true)
    setError(null)
    try {
      const actualizado = documento.archivado
        ? await api.desarchivarDocumento(proyecto.id, idDocumento)
        : await api.archivarDocumento(proyecto.id, idDocumento)
      setDocumento({ ...documento, ...actualizado })
    } catch (err) {
      setError(err.message)
    } finally {
      setCambiandoArchivo(false)
    }
  }

  async function descargarPdf() {
    setDescargandoPdf(true)
    setError(null)
    try {
      const blob = await api.descargarDocumentoPdfBlob(proyecto.id, idDocumento)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = `${documento.nombre}.pdf`
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDescargandoPdf(false)
    }
  }

  function empezarEdicion() {
    // Si hay un borrador sin confirmar (de esta sesión o de otra
    // anterior, propia o de otro usuario), se retoma ese texto en vez
    // del confirmado — el aviso ya se muestra en la propia pantalla.
    setTextoEditado(documento.tmp ?? documento.markdown)
    setTipoDocumentoEditado(documento.tipo_documento || "")
    setAmbitoEditado(documento.ambito || "")
    setFechaCaducidadEditada(documento.fecha_caducidad || "")
    setEditando(true)
    setVista("documento")
  }

  async function guardarBorrador() {
    setGuardando(true)
    setError(null)
    try {
      await api.guardarBorradorDocumento(proyecto.id, idDocumento, documento.id_version, textoEditado)
      setDocumento({ ...documento, tmp: textoEditado })
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarEdicion() {
    setGuardando(true)
    setError(null)
    try {
      await api.guardarBorradorDocumento(proyecto.id, idDocumento, documento.id_version, textoEditado)
      await api.confirmarEdicionDocumento(proyecto.id, idDocumento, documento.id_version)
      await api.actualizarMetadatosDocumento(proyecto.id, idDocumento, {
        tipo_documento: tipoDocumentoEditado,
        ambito: ambitoEditado || null,
        fecha_caducidad: fechaCaducidadEditada || null,
      })
      setEditando(false)
      await cargarDocumento()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="lg" display="flex" style={{ alignItems: "center", gap: 6 }} underline="hover" c="dimmed" fz="13.5px" fw={500}>
        <IconArrowLeft size={15} stroke={2} />
        Documentos
      </Anchor>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!documento && !error && <Text>Cargando...</Text>}

      {documento && (
        <>
          {!editando && (
            <Group justify="space-between" align="flex-start" mb="lg" wrap="nowrap">
              <div>
                <Title order={2} ff="heading" fz="24px" mb="8">
                  {documento.nombre}
                </Title>
                <Group gap="8">
                  {documento.borrador && (
                    <Badge color="yellow" variant="light" leftSection={<IconClockHour4 size={12} />}>
                      Borrador
                    </Badge>
                  )}
                  {documento.incumplimientos && (
                    <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                      No cumple normativa
                    </Badge>
                  )}
                  {documento.revisado_manualmente && !documento.incumplimientos && (
                    <Badge color="green" variant="light" leftSection={<IconCircleCheck size={12} />}>
                      Revisado a mano
                    </Badge>
                  )}
                  {documento.archivado && (
                    <Badge color="gray" variant="light" leftSection={<IconArchive size={12} />}>
                      Archivado
                    </Badge>
                  )}
                </Group>
              </div>
              <Group gap="8" wrap="nowrap">
                <Button
                  variant="subtle"
                  color="gray"
                  loading={descargandoPdf}
                  leftSection={<IconDownload size={15} stroke={1.8} />}
                  onClick={descargarPdf}
                >
                  Descargar PDF
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconHistory size={15} stroke={1.8} />}
                  onClick={() => {
                    setMostrarHistorial(!mostrarHistorial)
                    setVista("documento")
                  }}
                >
                  Historial
                </Button>
                <Button
                  variant="default"
                  onClick={alternarArchivado}
                  loading={cambiandoArchivo}
                  leftSection={<IconArchive size={15} stroke={1.8} />}
                >
                  {documento.archivado ? "Desarchivar" : "Archivar"}
                </Button>
                {proyecto.puede_editar && (
                  <Button onClick={empezarEdicion} leftSection={<IconEdit size={15} stroke={1.8} />}>
                    Editar
                  </Button>
                )}
              </Group>
            </Group>
          )}

          {!editando && <GruposDocumento proyecto={proyecto} idDocumento={idDocumento} />}
          {!editando && <EntidadesDocumento proyecto={proyecto} idDocumento={idDocumento} />}

          {!editando && documento.incumplimientos && (
            <Alert color="red" mb="lg" radius="lg" icon={<IconAlertTriangle size={19} />} title="No cumple el formato/normativa de su tipo">
              {documento.incumplimientos}
            </Alert>
          )}

          {editando ? (
            <Stack>
              {documento.tmp && (
                <Alert color="yellow" radius="lg" icon={<IconClockHour4 size={19} />} title="Hay un borrador sin confirmar">
                  {documento.tmp_usuario && `De ${documento.tmp_usuario}`}
                  {documento.tmp_fecha && ` · ${formatearFecha(documento.tmp_fecha)}`} — se ha cargado aquí en vez del
                  texto confirmado. Confirma o descarta antes de seguir.
                </Alert>
              )}
              <SimpleGrid cols={3} spacing="md">
                <Autocomplete
                  label="Tipo de documento"
                  data={tiposDocumento}
                  value={tipoDocumentoEditado}
                  onChange={setTipoDocumentoEditado}
                />
                <TextInput
                  label="Ámbito"
                  placeholder="p.ej. nacional, autonómica..."
                  value={ambitoEditado}
                  onChange={(e) => setAmbitoEditado(e.currentTarget.value)}
                />
                <TextInput
                  type="date"
                  label="Fecha de caducidad"
                  value={fechaCaducidadEditada}
                  onChange={(e) => setFechaCaducidadEditada(e.currentTarget.value)}
                />
              </SimpleGrid>
              <Box data-color-mode={esquemaColor}>
                <MDEditor
                  value={textoEditado}
                  onChange={(valor) => setTextoEditado(valor || "")}
                  height={560}
                  preview="live"
                />
              </Box>
              <Group>
                <Button onClick={confirmarEdicion} loading={guardando} leftSection={<IconCheck size={15} stroke={2.2} />}>
                  Confirmar cambios
                </Button>
                <Button onClick={guardarBorrador} loading={guardando} variant="light" leftSection={<IconDeviceFloppy size={15} stroke={1.8} />}>
                  Guardar borrador
                </Button>
                <div style={{ flex: 1 }} />
                <Button onClick={() => setEditando(false)} variant="subtle" color="gray">
                  Cerrar sin confirmar
                </Button>
              </Group>
              <Text size="12px" c="dimmed">
                Guardar borrador no queda registrado en el historial — solo confirmar cierra la edición y deja constancia de
                quién y cuándo.
              </Text>
            </Stack>
          ) : (
            <Tabs value={vista} onChange={setVista}>
              <Tabs.List>
                <Tabs.Tab value="documento" leftSection={<IconFileText size={15} stroke={1.8} />}>
                  Documento
                </Tabs.Tab>
                <Tabs.Tab
                  value="registros"
                  leftSection={<IconMessageCircle size={15} stroke={1.8} />}
                  rightSection={
                    registros?.length > 0 ? (
                      <Badge size="sm" circle variant="light" color={incidenciasAbiertas > 0 ? "red" : "gray"}>
                        {incidenciasAbiertas > 0 ? incidenciasAbiertas : registros.length}
                      </Badge>
                    ) : null
                  }
                >
                  Comentarios e incidencias
                </Tabs.Tab>
                <Tabs.Tab value="enviar" leftSection={<IconSend size={15} stroke={1.8} />}>
                  Enviar
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="documento" pt="lg">
                <Paper withBorder radius="lg" p="20" mb="lg">
                  <SimpleGrid cols={2} spacing={48} verticalSpacing={0}>
                    <CampoMeta etiqueta="Tipo de documento" valor={documento.tipo_documento} />
                    <CampoMeta etiqueta="Ámbito" valor={documento.ambito || "—"} />
                    <CampoMeta etiqueta="Fecha del documento" valor={formatearFecha(documento.fecha_documento)} />
                    <CampoMeta etiqueta="Fecha de caducidad" valor={formatearFecha(documento.fecha_caducidad)} />
                    <CampoMeta etiqueta="Dado de alta el" valor={formatearFecha(documento.fecha_alta)} />
                    <CampoMeta etiqueta="Última versión el" valor={formatearFecha(documento.fecha_subida)} />
                    <CampoMeta etiqueta="Corregido a mano" valor={documento.revisado_manualmente ? "Sí" : "No"} />
                    <CampoMeta
                      etiqueta="Histórico buscable"
                      valor={documento.todas_versiones_buscables ? "Todas las versiones" : "Solo la última"}
                    />
                  </SimpleGrid>
                  {documento.url_origen && (
                    <Group mt="8" pt="8" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                      <Text size="12.5px" c="dimmed">
                        Fuente
                      </Text>
                      <Anchor href={documento.url_origen} target="_blank" rel="noopener noreferrer" size="13px">
                        {documento.url_origen}
                      </Anchor>
                    </Group>
                  )}
                </Paper>

                <Paper withBorder radius="lg" p="40" className="contenido-documento">
                  <Markdown>{documento.markdown}</Markdown>
                </Paper>

                {mostrarHistorial && (
                  <HistorialEdicion
                    key={historialVersion}
                    proyecto={proyecto}
                    idDocumento={idDocumento}
                    idVersion={documento.id_version}
                    onRevertido={cargarDocumento}
                  />
                )}
              </Tabs.Panel>

              <Tabs.Panel value="registros" pt="lg">
                <RegistrosDocumento
                  proyecto={proyecto}
                  idDocumento={idDocumento}
                  idVersion={documento.id_version}
                  onCargado={setRegistros}
                  mostrarTitulo={false}
                />
              </Tabs.Panel>

              <Tabs.Panel value="enviar" pt="lg">
                <EnviosDocumento proyecto={proyecto} idDocumento={idDocumento} documento={documento} />
              </Tabs.Panel>
            </Tabs>
          )}
        </>
      )}
    </>
  )
}
