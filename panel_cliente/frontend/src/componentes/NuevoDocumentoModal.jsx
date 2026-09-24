import { useState } from "react"
import { Alert, Autocomplete, Box, Button, Checkbox, FileInput, Modal, SimpleGrid, Stack, Text, TextInput, useComputedColorScheme } from "@mantine/core"
import { IconCheck } from "@tabler/icons-react"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"

const VACIO = {
  nombre: "",
  tipoDocumento: "",
  fechaDocumento: "",
  fechaCaducidad: "",
  ambito: "",
  todasVersionesBuscables: false,
  markdown: "",
  archivoOriginal: null,
}

export default function NuevoDocumentoModal({ opened, onClose, tiposDocumento, onCrear }) {
  const [datos, setDatos] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const esquemaColor = useComputedColorScheme("light")

  function cerrar() {
    setDatos(VACIO)
    setError(null)
    onClose()
  }

  async function crear() {
    if (!datos.nombre || !datos.tipoDocumento || !datos.fechaDocumento || !datos.markdown) {
      setError("Faltan datos obligatorios: nombre, tipo, fecha del documento y el propio texto.")
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onCrear(datos)
      cerrar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={cerrar} title="Nuevo documento" size="xl">
      <Stack>
        <Text size="13px" c="dimmed">
          Pega o escribe aquí el texto ya convertido a markdown — esto no convierte fotos ni PDFs, eso lo sigue
          haciendo la IA en conversación. Si quieres, puedes adjuntar el PDF original tal cual, solo como
          referencia descargable junto al documento.
        </Text>

        <SimpleGrid cols={2} spacing="md">
          <TextInput
            label="Nombre / referencia"
            required
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.currentTarget.value })}
          />
          <Autocomplete
            label="Tipo de documento"
            required
            data={tiposDocumento}
            value={datos.tipoDocumento}
            onChange={(valor) => setDatos({ ...datos, tipoDocumento: valor })}
          />
          <TextInput
            type="date"
            label="Fecha del documento"
            required
            value={datos.fechaDocumento}
            onChange={(e) => setDatos({ ...datos, fechaDocumento: e.currentTarget.value })}
          />
          <TextInput
            type="date"
            label="Fecha de caducidad"
            value={datos.fechaCaducidad}
            onChange={(e) => setDatos({ ...datos, fechaCaducidad: e.currentTarget.value })}
          />
          <TextInput
            label="Ámbito"
            placeholder="p.ej. nacional, autonómica..."
            value={datos.ambito}
            onChange={(e) => setDatos({ ...datos, ambito: e.currentTarget.value })}
          />
          <FileInput
            label="PDF original (opcional, sin convertir)"
            placeholder="Adjuntar PDF"
            accept="application/pdf"
            clearable
            value={datos.archivoOriginal}
            onChange={(archivo) => setDatos({ ...datos, archivoOriginal: archivo })}
          />
        </SimpleGrid>

        <Checkbox
          label="Dejar buscable todo el histórico de este documento, no solo la última versión"
          checked={datos.todasVersionesBuscables}
          onChange={(e) => setDatos({ ...datos, todasVersionesBuscables: e.currentTarget.checked })}
        />

        <Box data-color-mode={esquemaColor}>
          <MDEditor
            value={datos.markdown}
            onChange={(valor) => setDatos({ ...datos, markdown: valor || "" })}
            height={360}
            preview="live"
          />
        </Box>

        {error && <Alert color="red">{error}</Alert>}

        <Button onClick={crear} loading={guardando} leftSection={<IconCheck size={15} stroke={2.2} />}>
          Crear documento
        </Button>
      </Stack>
    </Modal>
  )
}
