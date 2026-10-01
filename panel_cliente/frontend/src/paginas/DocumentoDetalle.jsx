import { useEffect, useState } from "react"
import { Alert, Anchor, Autocomplete, Badge, Box, Button, Checkbox, Group, Modal, Paper, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Title, useComputedColorScheme } from "@mantine/core"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import {
  IconActivity,
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconBell,
  IconCheck,
  IconCircleCheck,
  IconClockHour4,
  IconEyeOff,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconFileText,
  IconHistory,
  IconMessageCircle,
  IconNotebook,
  IconSend,
  IconShare,
  IconTrash,
} from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "../componentes/Markdown"
import { formatearFecha } from "../formato"
import HistorialEdicion from "../componentes/HistorialEdicion"
import NotasDocumento from "../componentes/NotasDocumento"
import GruposDocumento from "../componentes/GruposDocumento"
import EntidadesDocumento from "../componentes/EntidadesDocumento"
import ScriptsDocumento from "../componentes/ScriptsDocumento"
import RegistrosDocumento from "../componentes/RegistrosDocumento"
import EnviosDocumento from "../componentes/EnviosDocumento"
import CompartirDocumento from "../componentes/CompartirDocumento"
import ActividadDocumento from "../componentes/ActividadDocumento"
import ProgramacionesDocumento from "../componentes/ProgramacionesDocumento"
import NotasBlocVinculadas from "../componentes/NotasBlocVinculadas"

const CLAVE_PDF_METADATOS = "gd_pdf_incluir_metadatos"

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

export default function DocumentoDetalle({ proyecto, idDocumento, onVolver, onVerProgramacion, onVerNota, onNuevaNota }) {
  const [documento, setDocumento] = useState(null)
  const [error, setError] = useState(null)
  const [cambiandoArchivo, setCambiandoArchivo] = useState(false)
  const [modalBorrarAbierto, setModalBorrarAbierto] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const [descargandoOriginal, setDescargandoOriginal] = useState(false)
  const [modalPdfAbierto, setModalPdfAbierto] = useState(false)
  const [incluirMetadatosPdf, setIncluirMetadatosPdf] = useState(() => localStorage.getItem(CLAVE_PDF_METADATOS) === "1")
  const [editando, setEditando] = useState(false)
  const [textoEditado, setTextoEditado] = useState("")
  const [tipoDocumentoEditado, setTipoDocumentoEditado] = useState("")
  const [ambitoEditado, setAmbitoEditado] = useState("")
  const [fechaCaducidadEditada, setFechaCaducidadEditada] = useState("")
  const [idEstiloEditado, setIdEstiloEditado] = useState(null)
  const [tiposDocumento, setTiposDocumento] = useState([])
  const [estilos, setEstilos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [historialVersion, setHistorialVersion] = useState(0)
  const [vista, setVista] = useState("documento")
  const [notas, setNotas] = useState(null)
  const incidenciasAbiertas = notas?.filter((n) => n.tipo === "incidencia" && n.estado === "abierta").length || 0
  const esquemaColor = useComputedColorScheme("light")

  useEffect(() => {
    cargarDocumento()
  }, [proyecto.id, idDocumento])

  useEffect(() => {
    api.listarTiposDocumento(proyecto.id)
      .then((tipos) => setTiposDocumento(tipos.map((t) => t.nombre)))
      .catch(() => setTiposDocumento([]))
    api.listarEstilos(proyecto.id)
      .then(setEstilos)
      .catch(() => setEstilos([]))
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

  async function alternarReservado() {
    setError(null)
    try {
      const actualizado = await api.cambiarReservadoDocumento(proyecto.id, idDocumento, !documento.reservado)
      setDocumento({ ...documento, ...actualizado })
    } catch (err) {
      setError(err.message)
    }
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

  async function borrarDocumento() {
    setBorrando(true)
    setError(null)
    try {
      await api.eliminarDocumento(proyecto.id, idDocumento)
      onVolver()
    } catch (err) {
      setError(err.message)
      setModalBorrarAbierto(false)
    } finally {
      setBorrando(false)
    }
  }

  function cambiarIncluirMetadatosPdf(valor) {
    setIncluirMetadatosPdf(valor)
    localStorage.setItem(CLAVE_PDF_METADATOS, valor ? "1" : "0")
  }

  async function descargarPdf() {
    setDescargandoPdf(true)
    setError(null)
    try {
      const blob = await api.descargarDocumentoPdfBlob(proyecto.id, idDocumento, incluirMetadatosPdf)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = `${documento.nombre}.pdf`
      enlace.click()
      URL.revokeObjectURL(url)
      setModalPdfAbierto(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setDescargandoPdf(false)
    }
  }

  async function descargarOriginal() {
    setDescargandoOriginal(true)
    setError(null)
    try {
      const { blob, nombreFichero } = await api.descargarArchivoOriginalBlob(proyecto.id, idDocumento, documento.id_version)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = nombreFichero
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDescargandoOriginal(false)
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
    setIdEstiloEditado(documento.id_estilo ? String(documento.id_estilo) : null)
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
      await api.asignarEstiloDocumento(proyecto.id, idDocumento, idEstiloEditado ? Number(idEstiloEditado) : null)
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
                  leftSection={<IconDownload size={15} stroke={1.8} />}
                  onClick={() => setModalPdfAbierto(true)}
                >
                  PDF...
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
                {proyecto.puede_editar && documento.archivado && (
                  <Button
                    variant="default"
                    color="red"
                    onClick={() => setModalBorrarAbierto(true)}
                    leftSection={<IconTrash size={15} stroke={1.8} />}
                  >
                    Borrar
                  </Button>
                )}
                {proyecto.puede_editar && (
                  <Button
                    variant={documento.reservado ? "light" : "default"}
                    color={documento.reservado ? "orange" : undefined}
                    onClick={alternarReservado}
                    leftSection={<IconEyeOff size={15} stroke={1.8} />}
                    title="Un documento reservado no se comparte con las gestiones documentales enlazadas a esta"
                  >
                    {documento.reservado ? "Reservado" : "Reservar"}
                  </Button>
                )}
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
          {!editando && <ScriptsDocumento proyecto={proyecto} idDocumento={idDocumento} />}
          {!editando && <RegistrosDocumento proyecto={proyecto} idDocumento={idDocumento} />}

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
              <SimpleGrid cols={4} spacing="md">
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
                <Select
                  label="Estilo de informe"
                  placeholder="Sin estilo"
                  clearable
                  data={estilos.map((e) => ({ value: String(e.id), label: e.nombre_tipo }))}
                  value={idEstiloEditado}
                  onChange={setIdEstiloEditado}
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
                  value="notas"
                  leftSection={<IconMessageCircle size={15} stroke={1.8} />}
                  rightSection={
                    notas?.length > 0 ? (
                      <Badge size="sm" circle variant="light" color={incidenciasAbiertas > 0 ? "red" : "gray"}>
                        {incidenciasAbiertas > 0 ? incidenciasAbiertas : notas.length}
                      </Badge>
                    ) : null
                  }
                >
                  Comentarios e incidencias
                </Tabs.Tab>
                <Tabs.Tab value="enviar" leftSection={<IconSend size={15} stroke={1.8} />}>
                  Enviar
                </Tabs.Tab>
                <Tabs.Tab value="compartir" leftSection={<IconShare size={15} stroke={1.8} />}>
                  Compartir
                </Tabs.Tab>
                <Tabs.Tab value="avisos" leftSection={<IconBell size={15} stroke={1.8} />}>
                  Avisos
                </Tabs.Tab>
                <Tabs.Tab value="bloc" leftSection={<IconNotebook size={15} stroke={1.8} />}>
                  Bloc de notas
                </Tabs.Tab>
                {/* Invitado no ve la actividad (ver listar_actividad en servidor.py);
                    soporte sí — llega con es_admin */}
                {(proyecto.puede_editar || proyecto.es_admin) && (
                  <Tabs.Tab value="actividad" leftSection={<IconActivity size={15} stroke={1.8} />}>
                    Actividad
                  </Tabs.Tab>
                )}
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
                    <CampoMeta
                      etiqueta="Estilo de informe"
                      valor={estilos.find((e) => e.id === documento.id_estilo)?.nombre_tipo || "—"}
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
                  {documento.archivo_original_nombre && (
                    <Group mt="8" pt="8" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                      <Text size="12.5px" c="dimmed">
                        Archivo original
                      </Text>
                      <Anchor
                        component="button"
                        type="button"
                        size="13px"
                        onClick={descargarOriginal}
                        disabled={descargandoOriginal}
                      >
                        {documento.archivo_original_nombre}
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

              <Tabs.Panel value="notas" pt="lg">
                <NotasDocumento
                  proyecto={proyecto}
                  idDocumento={idDocumento}
                  idVersion={documento.id_version}
                  onCargado={setNotas}
                  mostrarTitulo={false}
                />
              </Tabs.Panel>

              <Tabs.Panel value="enviar" pt="lg">
                <EnviosDocumento proyecto={proyecto} idDocumento={idDocumento} documento={documento} />
              </Tabs.Panel>

              <Tabs.Panel value="compartir" pt="lg">
                {vista === "compartir" && (
                  <CompartirDocumento proyecto={proyecto} idDocumento={idDocumento} documento={documento} />
                )}
              </Tabs.Panel>

              <Tabs.Panel value="avisos" pt="lg">
                {vista === "avisos" && (
                  <ProgramacionesDocumento proyecto={proyecto} idDocumento={idDocumento} onVerProgramacion={onVerProgramacion} />
                )}
              </Tabs.Panel>

              <Tabs.Panel value="bloc" pt="lg">
                {vista === "bloc" && (
                  <NotasBlocVinculadas
                    proyecto={proyecto} enlace={{ tipo: "documento", id: idDocumento }}
                    onVerNota={onVerNota} onNuevaNota={onNuevaNota}
                  />
                )}
              </Tabs.Panel>

              {(proyecto.puede_editar || proyecto.es_admin) && (
                <Tabs.Panel value="actividad" pt="lg">
                  {vista === "actividad" && <ActividadDocumento proyecto={proyecto} idDocumento={idDocumento} />}
                </Tabs.Panel>
              )}
            </Tabs>
          )}

          <Modal opened={modalPdfAbierto} onClose={() => setModalPdfAbierto(false)} title="Descargar PDF" size="sm">
            <Stack>
              <Checkbox
                label="Incluir los metadatos del documento en el pie de página"
                description="Nombre, tipo, ámbito y fecha, repetidos en cada hoja"
                checked={incluirMetadatosPdf}
                onChange={(e) => cambiarIncluirMetadatosPdf(e.currentTarget.checked)}
              />
              <Group justify="flex-end">
                <Button
                  loading={descargandoPdf}
                  leftSection={<IconDownload size={15} stroke={1.8} />}
                  onClick={descargarPdf}
                >
                  Descargar
                </Button>
              </Group>
            </Stack>
          </Modal>
          <Modal opened={modalBorrarAbierto} onClose={() => setModalBorrarAbierto(false)} title="Borrar documento" size="sm">
            <Stack>
              <Text size="sm">
                Se borrará «{documento.nombre}» para siempre, con todas sus versiones, el archivo original y sus notas.
                No se puede deshacer.
              </Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setModalBorrarAbierto(false)}>
                  Cancelar
                </Button>
                <Button color="red" loading={borrando} leftSection={<IconTrash size={15} stroke={1.8} />} onClick={borrarDocumento}>
                  Borrar para siempre
                </Button>
              </Group>
            </Stack>
          </Modal>
        </>
      )}
    </>
  )
}
