import { useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Paper, Text, Textarea, TextInput, Title } from "@mantine/core"
import { CodeHighlight } from "@mantine/code-highlight"
import { IconArrowLeft, IconArchive, IconArchiveOff } from "@tabler/icons-react"
import { api } from "../api"
import { formatearFecha } from "../formato"

export default function ScriptDetalle({ proyecto, script, onVolver, onCambiado }) {
  const [datos, setDatos] = useState(script)
  const [editando, setEditando] = useState(false)
  const [valoresEdicion, setValoresEdicion] = useState(script)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await api.actualizarScript(proyecto.id, script.id, {
        titulo: valoresEdicion.titulo,
        descripcion: valoresEdicion.descripcion,
        lenguaje: valoresEdicion.lenguaje,
        etiquetas: valoresEdicion.etiquetas,
      })
      setDatos(actualizado)
      setEditando(false)
      onCambiado?.(actualizado)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function alternarArchivado() {
    setError(null)
    try {
      const actualizado = datos.archivado
        ? await api.desarchivarScript(proyecto.id, script.id)
        : await api.archivarScript(proyecto.id, script.id)
      setDatos(actualizado)
      onCambiado?.(actualizado)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Anchor
        component="button" type="button" onClick={onVolver} mb="lg"
        display="flex" style={{ alignItems: "center", gap: 6 }}
        underline="hover" c="dimmed" fz="13.5px" fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Scripts
      </Anchor>

      {!editando ? (
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Group gap="8" mb="6">
              <Title order={2}>{datos.titulo}</Title>
              <Badge color="gray" variant="light" tt="none" fw={500}>
                {datos.lenguaje}
              </Badge>
              {datos.archivado && (
                <Badge color="orange" variant="light" tt="none" fw={500}>
                  Archivado
                </Badge>
              )}
            </Group>
            <Text c="dimmed" fz="13.5px">
              Creado por {datos.creado_por} el {formatearFecha(datos.fecha_alta)} · usado {datos.veces_usado} veces
              {datos.fecha_ultimo_uso ? ` · último uso ${formatearFecha(datos.fecha_ultimo_uso)}` : ""}
            </Text>
          </div>
          {proyecto.puede_editar && (
            <Group gap="8" wrap="nowrap">
              <Button variant="default" onClick={() => { setValoresEdicion(datos); setEditando(true) }}>
                Editar
              </Button>
              <Button
                variant="subtle" color={datos.archivado ? "green" : "orange"}
                leftSection={datos.archivado ? <IconArchiveOff size={15} stroke={1.8} /> : <IconArchive size={15} stroke={1.8} />}
                onClick={alternarArchivado}
              >
                {datos.archivado ? "Desarchivar" : "Archivar"}
              </Button>
            </Group>
          )}
        </Group>
      ) : (
        <Paper withBorder radius="lg" p="16" mb="lg">
          <TextInput
            label="Título" mb="10" value={valoresEdicion.titulo || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, titulo: e.target.value })}
          />
          <Textarea
            label="Descripción" mb="10" minRows={3} autosize
            value={valoresEdicion.descripcion || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, descripcion: e.target.value })}
          />
          <TextInput
            label="Lenguaje" mb="10" value={valoresEdicion.lenguaje || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, lenguaje: e.target.value })}
          />
          <TextInput
            label="Etiquetas" mb="10" placeholder="separadas por comas"
            value={valoresEdicion.etiquetas || ""}
            onChange={(e) => setValoresEdicion({ ...valoresEdicion, etiquetas: e.target.value })}
          />
          <Group gap="8" mt="10">
            <Button onClick={guardar} loading={guardando}>
              Guardar
            </Button>
            <Button variant="subtle" color="gray" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </Group>
        </Paper>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {datos.etiquetas && (
        <Text c="dimmed" fz="13.5px" mb="md">
          Etiquetas: {datos.etiquetas}
        </Text>
      )}

      <Title order={4} fz="16px" mb="10">
        Código
      </Title>
      <Text c="dimmed" fz="13.5px" mb="10">
        Solo lectura — el código lo escribe y corrige tu IA, no se puede editar desde aquí.
      </Text>
      <CodeHighlight code={datos.codigo} language={datos.lenguaje} withCopyButton radius="lg" />
    </>
  )
}
