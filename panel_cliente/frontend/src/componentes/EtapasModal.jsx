import { useEffect, useState } from "react"
import { ActionIcon, Alert, Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core"
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "@tabler/icons-react"
import { api } from "../api"

const TIPOS = [
  { value: "abierta", label: "Abierta" },
  { value: "ganada", label: "Ganada" },
  { value: "perdida", label: "Perdida" },
]

// Las columnas del embudo: nombre, probabilidad y tipo, en orden. Se
// guardan todas de una vez (lo que se quite se borra, si no tiene oportunidades).
export default function EtapasModal({ opened, onClose, proyecto, etapas, onGuardadas }) {
  const [filas, setFilas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (opened) {
      setFilas(etapas.map((e) => ({ ...e })))
      setError(null)
    }
  }, [opened, etapas])

  const cambiar = (i, campo, valor) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)))
  function mover(i, delta) {
    setFilas((f) => {
      const copia = [...f]
      const [fila] = copia.splice(i, 1)
      copia.splice(i + delta, 0, fila)
      return copia
    })
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const guardadas = await api.guardarEtapas(proyecto.id, filas.map((e) => ({
        id: e.id ?? null, nombre: e.nombre, probabilidad: Number(e.probabilidad) || 0, tipo: e.tipo,
      })))
      onGuardadas(guardadas)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} size="lg" title="Etapas del embudo">
      <Stack gap="xs">
        <Text size="13px" c="dimmed">
          La probabilidad es cuánto se espera ganar de lo que está en esa etapa: sirve para la previsión. Al pasar a una etapa
          ganada o perdida, la oportunidad se cierra. Una etapa con oportunidades no se puede quitar.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        {filas.map((e, i) => (
          <Group key={e.id ?? `nueva-${i}`} gap="6" wrap="nowrap" align="flex-end">
            <TextInput style={{ flex: 1 }} value={e.nombre} onChange={(ev) => cambiar(i, "nombre", ev.currentTarget.value)} placeholder="Nombre" />
            <NumberInput w={90} min={0} max={100} suffix=" %" value={e.probabilidad} onChange={(v) => cambiar(i, "probabilidad", v)} />
            <Select w={120} data={TIPOS} allowDeselect={false} value={e.tipo} onChange={(v) => cambiar(i, "tipo", v)} />
            <ActionIcon variant="subtle" color="gray" disabled={i === 0} onClick={() => mover(i, -1)}><IconArrowUp size={16} /></ActionIcon>
            <ActionIcon variant="subtle" color="gray" disabled={i === filas.length - 1} onClick={() => mover(i, 1)}><IconArrowDown size={16} /></ActionIcon>
            <ActionIcon
              variant="subtle" color="red" disabled={e.oportunidades > 0}
              title={e.oportunidades > 0 ? `Tiene ${e.oportunidades} oportunidad(es)` : "Quitar"}
              onClick={() => setFilas((f) => f.filter((_, j) => j !== i))}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
        <Group justify="space-between" mt="xs">
          <Button
            variant="default" leftSection={<IconPlus size={15} />}
            onClick={() => setFilas((f) => [...f, { id: null, nombre: "", probabilidad: 50, tipo: "abierta", oportunidades: 0 }])}
          >
            Añadir etapa
          </Button>
          <Group gap="8">
            <Button variant="subtle" color="gray" onClick={onClose}>Cancelar</Button>
            <Button onClick={guardar} loading={guardando}>Guardar</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  )
}
