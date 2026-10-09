import { useEffect, useState } from "react"
import { ActionIcon, Alert, Anchor, Badge, Button, Group, Paper, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core"
import { IconArrowLeft, IconPlus, IconRefresh, IconShieldCheck } from "@tabler/icons-react"
import { api } from "../api"

function FilaTipo({ proyecto, tipo, onCambiado, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [formato, setFormato] = useState(tipo.formato_requerido || "")
  const [normativa, setNormativa] = useState(tipo.normativa_aplicable || "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [verRequisitos, setVerRequisitos] = useState(false)

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const actualizado = await api.actualizarTipoDocumento(proyecto.id, tipo.id, {
        formato_requerido: formato || null,
        normativa_aplicable: normativa || null,
      })
      onCambiado(actualizado)
      setEditando(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const tieneRequisitos = tipo.formato_requerido || tipo.normativa_aplicable

  return (
    <Paper withBorder radius="lg" p="16" mb="10">
      <Group justify="space-between">
        <Group gap="10">
          <Text fw={600} fz="14.5px">
            {tipo.nombre}
          </Text>
          {tieneRequisitos ? (
            <Badge color="acento" variant="light" leftSection={<IconShieldCheck size={12} />}>
              Con requisitos
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              Sin requisitos
            </Badge>
          )}
        </Group>
        {proyecto.es_admin && (
          <Group gap="xs">
            <Anchor component="button" type="button" size="sm" onClick={() => setEditando(!editando)}>
              {editando ? "Cancelar" : "Editar requisitos"}
            </Anchor>
            <Anchor component="button" type="button" size="sm" c="red" onClick={() => onEliminar(tipo)}>
              Eliminar del catálogo
            </Anchor>
          </Group>
        )}
      </Group>

      {!editando && tieneRequisitos && (
        <Anchor component="button" type="button" size="sm" mt="xs" onClick={() => setVerRequisitos(!verRequisitos)}>
          {verRequisitos ? "Ocultar requisitos" : "Ver requisitos"}
        </Anchor>
      )}

      {!editando && tieneRequisitos && verRequisitos && (
        <Stack gap={4} mt="xs">
          {tipo.formato_requerido && (
            <Text size="sm">
              <b>Formato:</b> {tipo.formato_requerido}
            </Text>
          )}
          {tipo.normativa_aplicable && (
            <Text size="sm">
              <b>Normativa:</b> {tipo.normativa_aplicable}
            </Text>
          )}
        </Stack>
      )}

      {editando && (
        <Stack mt="sm">
          {error && (
            <Alert color="red">{error}</Alert>
          )}
          <Textarea
            label="Formato requerido"
            placeholder='p.ej. "Debe incluir NIF, fecha, base imponible y desglose de IVA por tipo"'
            value={formato}
            onChange={(e) => setFormato(e.currentTarget.value)}
            autosize minRows={2}
          />
          <Textarea
            label="Normativa aplicable"
            placeholder="p.ej. Reglamento por el que se regulan las obligaciones de facturación"
            value={normativa}
            onChange={(e) => setNormativa(e.currentTarget.value)}
            autosize minRows={2}
          />
          <Button onClick={guardar} loading={guardando} size="sm">
            Guardar
          </Button>
        </Stack>
      )}
    </Paper>
  )
}

export default function TiposDocumento({ proyecto, onVolver }) {
  const [tipos, setTipos] = useState(null)
  const [error, setError] = useState(null)
  const [nombreNuevo, setNombreNuevo] = useState("")
  const [creando, setCreando] = useState(false)
  const [refrescando, setRefrescando] = useState(false)

  function recargar() {
    setRefrescando(true)
    return api
      .listarTiposDocumento(proyecto.id)
      .then(setTipos)
      .catch((err) => setError(err.message))
      .finally(() => setRefrescando(false))
  }

  useEffect(() => {
    recargar()
  }, [proyecto.id])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      await api.crearTipoDocumento(proyecto.id, nombreNuevo)
      setNombreNuevo("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(tipo) {
    if (!confirm(`¿Quitar "${tipo.nombre}" del catálogo de sugerencias?`)) return
    try {
      await api.eliminarTipoDocumento(proyecto.id, tipo.id)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Anchor
        component="button"
        type="button"
        onClick={onVolver}
        mb="lg"
        display="flex"
        style={{ alignItems: "center", gap: 6 }}
        underline="hover"
        c="dimmed"
        fz="13.5px"
        fw={500}
      >
        <IconArrowLeft size={15} stroke={2} />
        Documentos
      </Anchor>
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2} mb="6">
            Tipos de documento
          </Title>
          <Text c="dimmed" maw={620} fz="13.5px">
            Catálogo de sugerencias, no una lista cerrada: al guardar un documento se puede usar
            cualquier tipo, esté aquí o no. Si un tipo tiene formato o normativa definidos, la IA los
            tiene en cuenta y avisa en el documento si detecta que no los cumple.
          </Text>
        </div>
        <Tooltip label="Refrescar">
          <ActionIcon variant="subtle" color="gray" onClick={recargar} loading={refrescando}>
            <IconRefresh size={17} stroke={1.8} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {proyecto.es_admin && (
        <Group component="form" onSubmit={crear} mb="lg" maw={480}>
          <TextInput
            placeholder="Nuevo tipo de documento"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <Button type="submit" loading={creando} leftSection={<IconPlus size={15} stroke={2.2} />}>
            Añadir
          </Button>
        </Group>
      )}

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}
      {!tipos ? (
        <Text>Cargando...</Text>
      ) : tipos.length === 0 ? (
        <Text c="dimmed">Todavía no hay ningún tipo de documento en el catálogo.</Text>
      ) : (
        tipos.map((tipo) => (
          <FilaTipo
            key={tipo.id}
            proyecto={proyecto}
            tipo={tipo}
            onCambiado={(actualizado) => setTipos(tipos.map((t) => (t.id === tipo.id ? actualizado : t)))}
            onEliminar={eliminar}
          />
        ))
      )}
    </>
  )
}
