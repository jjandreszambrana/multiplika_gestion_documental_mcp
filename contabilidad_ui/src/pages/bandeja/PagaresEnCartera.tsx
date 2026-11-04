import { Alert, Loader, Modal, Stack, Table, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { listarBandeja, MOVIMIENTOS, type MovimientoBandeja } from '../../api/bandeja'
import { textoDeError } from '../../api/errores'
import { formatearFecha } from '../../lib/format'

interface Props {
  abierto: boolean
  ejercicio: number
  alCerrar: () => void
}

const POR_PAGINA = 200
const dinero = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Todo lo que devuelve la bandeja para una fase, pasando las páginas que hagan falta. */
async function todosDeLaFase(ejercicio: number, fasePagare: string): Promise<MovimientoBandeja[]> {
  const juntos: MovimientoBandeja[] = []
  for (let pagina = 1; ; pagina++) {
    const lista = await listarBandeja({
      tipo: MOVIMIENTOS, ejercicio, estado: '', libro: '', periodo: '', buscar: '', fasePagare, pagina, porPagina: POR_PAGINA,
    })
    juntos.push(...(lista.movimientos ?? []))
    if (juntos.length >= lista.total || (lista.movimientos ?? []).length === 0) return juntos
  }
}

/**
 * Los efectos (pagaré, cheque, confirming) que el cliente ha entregado y aún no
 * se han cobrado en el banco, por cliente. Un efecto sigue «en cartera» mientras
 * no tenga su paso de negociado ([5.47] del canal): los dos pasos son documentos
 * distintos y se emparejan por el número que llevan tras `efc-` y `neg-`.
 * Solo consulta: no cambia nada.
 */
export default function PagaresEnCartera({ abierto, ejercicio, alCerrar }: Props) {
  const [filas, setFilas] = useState<MovimientoBandeja[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    setFilas(null)
    setError(null)
    Promise.all([todosDeLaFase(ejercicio, 'cartera'), todosDeLaFase(ejercicio, 'negociado')])
      .then(([cartera, negociado]) => {
        if (!vigente) return
        const cobrados = new Set(negociado.filter((m) => m.estado !== 'descartada').map((m) => m.id_origen.replace(/^neg-/, '')))
        setFilas(
          cartera.filter(
            (m) => ['pendiente', 'contabilizada'].includes(m.estado) && !cobrados.has(m.id_origen.replace(/^efc-/, '')),
          ),
        )
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
    return () => {
      vigente = false
    }
  }, [abierto, ejercicio])

  const clientes = new Map<string, MovimientoBandeja[]>()
  for (const m of filas ?? []) {
    const nombre = m.nombre_tercero || m.cuenta_tercero || 'Sin cliente'
    clientes.set(nombre, [...(clientes.get(nombre) ?? []), m])
  }
  const total = (filas ?? []).reduce((suma, m) => suma + Number(m.importe), 0)

  return (
    <Modal opened={abierto} onClose={alCerrar} size="xl" title={`Pagarés en cartera del ${ejercicio}`}>
      <Stack gap="sm">
        <Text fz="sm" c="dimmed">
          Efectos que el cliente ha entregado y que aún no se han cobrado en el banco (siguen en la 431 del cliente).
          Solo se miran los del ejercicio {ejercicio}.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        {!filas && !error && <Loader size="sm" />}
        {filas && filas.length === 0 && <Text>No hay ningún pagaré en cartera.</Text>}
        {filas && filas.length > 0 && (
          <Table.ScrollContainer minWidth={560}>
            <Table fz="sm" withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cliente / efecto</Table.Th>
                  <Table.Th>Medio</Table.Th>
                  <Table.Th>Cobro</Table.Th>
                  <Table.Th>Vence</Table.Th>
                  <Table.Th ta="right">Importe</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...clientes.entries()].map(([cliente, efectos]) => [
                  <Table.Tr key={cliente} bg="var(--mantine-color-default-hover)">
                    <Table.Td colSpan={4} fw={600}>
                      {cliente} · {efectos.length} {efectos.length === 1 ? 'efecto' : 'efectos'}
                    </Table.Td>
                    <Table.Td ta="right" fw={600}>
                      {dinero(efectos.reduce((s, m) => s + Number(m.importe), 0))}
                    </Table.Td>
                  </Table.Tr>,
                  ...efectos
                    .sort((a, b) => String(a.fecha_vencimiento ?? '').localeCompare(String(b.fecha_vencimiento ?? '')))
                    .map((m) => (
                      <Table.Tr key={m.id}>
                        <Table.Td pl="lg">{m.concepto}</Table.Td>
                        <Table.Td>{m.medio_pago}</Table.Td>
                        <Table.Td>{formatearFecha(m.fecha)}</Table.Td>
                        <Table.Td>{m.fecha_vencimiento ? formatearFecha(m.fecha_vencimiento) : '—'}</Table.Td>
                        <Table.Td ta="right">{dinero(Number(m.importe))}</Table.Td>
                      </Table.Tr>
                    )),
                ])}
                <Table.Tr>
                  <Table.Td colSpan={4} fw={700}>Total en cartera</Table.Td>
                  <Table.Td ta="right" fw={700}>{dinero(total)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </Modal>
  )
}
