import { useEffect, useState } from "react"
import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core"

// Lo que comparten las pestañas de Cobros
export const HOY = () => new Date().toISOString().slice(0, 10)
export const TIPOS_SEPA = [5, 6]
export const registros = (r) => r?.registros || r?.reg || (Array.isArray(r) ? r : [])

// Clientes del SIF como opciones de un Select, y su nombre por id
export function useClientes(pedir) {
  const [clientes, setClientes] = useState([])
  useEffect(() => {
    pedir("/obligados/receptores/listar", { offset: 0, limit: 10000 })
      .then((r) => setClientes(r.registros.map((c) => ({ value: String(c.id), label: `${c.NombreRazon}${c.NIF ? ` (${c.NIF})` : ""}`, nombre: c.NombreRazon }))))
      .catch(() => setClientes([]))
  }, [pedir])
  return clientes
}

// Medios de pago activos; con `soloSepa`, los de domiciliación
export function useMedios(pedir, soloSepa = false) {
  const [medios, setMedios] = useState(null)
  useEffect(() => {
    pedir("/maestros/medios_pago/listar", { offset: 0, limit: 1000 })
      .then((r) => setMedios(r.registros
        .filter((m) => m.estado !== 0 && (!soloSepa || TIPOS_SEPA.includes(Number(m.id_tipo))))
        .map((m) => ({ value: String(m.id), label: `${m.descripcion}${soloSepa && m.iban ? ` · ${m.iban}` : ""}` }))))
      .catch(() => setMedios([]))
  }, [pedir, soloSepa])
  return medios
}

// Ventana de "¿seguro?" para una acción contra el SIF
export function Confirmar({ titulo, texto, detalle, boton, color, hacer, alCerrar, alHecho, children }) {
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const pulsar = () => {
    setTrabajando(true)
    setError(null)
    hacer().then(alHecho).catch((err) => setError(err.message)).finally(() => setTrabajando(false))
  }
  return (
    <Modal opened onClose={alCerrar} title={titulo}>
      <Stack gap="sm">
        {detalle && <Text fz="sm" c="dimmed">{detalle}</Text>}
        {texto && <Text>{texto}</Text>}
        {children}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>Cancelar</Button>
          <Button color={color} loading={trabajando} onClick={pulsar}>{boton}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
