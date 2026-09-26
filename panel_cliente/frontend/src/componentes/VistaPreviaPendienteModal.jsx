import { useEffect, useState } from "react"
import { Alert, Button, Divider, Group, Loader, Modal, Paper, ScrollArea, Text } from "@mantine/core"
import { IconSparkles } from "@tabler/icons-react"
import { api } from "../api"
import Markdown from "./Markdown"

// Vista previa de un documento pendiente: extracción de texto instantánea
// y sin IA (pdfplumber + OCR de respaldo, ver panel_cliente/extraccion_pdf.py
// del backend) — "puede verse un poco desestructurado" a propósito. El botón
// "Procesar con IA" es opcional, manda ESE texto a Claude para un borrador en
// markdown limpio. Nada de esto guarda todavía un documento definitivo — eso
// sigue siendo, en esta v1, solo por conversación con la IA.
export default function VistaPreviaPendienteModal({ opened, onClose, proyecto, pendiente }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState("")
  const [procesando, setProcesando] = useState(false)
  const [markdown, setMarkdown] = useState(null)

  useEffect(() => {
    if (!opened || !pendiente) return
    setTexto("")
    setMarkdown(null)
    setError(null)
    setCargando(true)
    api
      .vistaPreviaDocumentoPendiente(proyecto.id, pendiente.id)
      .then((resultado) => setTexto(resultado.texto))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [opened, pendiente, proyecto.id])

  async function procesarConIA() {
    setProcesando(true)
    setError(null)
    try {
      const resultado = await api.estructurarDocumentoPendiente(proyecto.id, pendiente.id, texto)
      setMarkdown(resultado.markdown)
    } catch (err) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={pendiente ? `Vista previa — ${pendiente.nombre_original}` : "Vista previa"}
      size="xl"
    >
      <Text size="sm" c="dimmed" mb="sm">
        Texto extraído automáticamente, sin IA todavía — puede verse un poco desestructurado. Si te
        sirve, pulsa "Procesar con IA" para ver un borrador limpio en markdown (no guarda nada todavía).
      </Text>

      {error && (
        <Alert color="red" mb="sm" onClose={() => setError(null)} withCloseButton>
          {error}
        </Alert>
      )}

      {cargando ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : (
        <>
          <ScrollArea h={320} mb="md" type="auto">
            <Paper withBorder p="sm">
              <Text component="pre" size="13px" style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0 }}>
                {texto || "(sin texto detectado)"}
              </Text>
            </Paper>
          </ScrollArea>

          <Button
            leftSection={<IconSparkles size={16} stroke={1.8} />}
            onClick={procesarConIA}
            loading={procesando}
            disabled={!texto}
            mb="md"
          >
            Procesar con IA
          </Button>

          {markdown && (
            <>
              <Divider label="Borrador estructurado por la IA" labelPosition="center" mb="sm" />
              <ScrollArea h={320} type="auto">
                <Paper withBorder radius="lg" p="lg" className="contenido-documento">
                  <Markdown>{markdown}</Markdown>
                </Paper>
              </ScrollArea>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
