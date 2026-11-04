import { Alert, Box, Button, Checkbox, Group, Select, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { crearAlbaran, listarClientes, listarSeries, muestrasPorFacturar } from '../../api/laboratorio'
import { formatearFecha } from '../../lib/format'
import { importeLab, useCarga, CUERPO_SCROLL, PESTANA_FIJA } from './comun'

/** Muestras con informe y tarifa que aún no se han facturado: se eligen y se crea un albarán. */
export default function PestanaFacturar() {
  const [cliente, setCliente] = useState<string | null>(null)
  const [serie, setSerie] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<ReadonlySet<number>>(new Set())
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const clientes = useCarga(listarClientes, [])
  const series = useCarga(listarSeries, [])
  const pendientes = useCarga(() => muestrasPorFacturar(cliente ? Number(cliente) : undefined), [cliente])

  const filas = pendientes.datos ?? []
  const delElegido = new Set(filas.filter((m) => elegidas.has(m.id)).map((m) => m.id_receptor))
  const mezcla = delElegido.size > 1

  function alternar(id: number, marcada: boolean) {
    setElegidas((antes) => {
      const nuevas = new Set(antes)
      if (marcada) nuevas.add(id)
      else nuevas.delete(id)
      return nuevas
    })
  }

  async function crear() {
    if (!serie) return
    setCreando(true)
    setError(null)
    setHecho(null)
    try {
      const r = await crearAlbaran([...elegidas], Number(serie))
      setHecho(`Albarán creado con ${r.muestras} muestras, por ${importeLab(r.importe_neto)}. Se factura desde los albaranes, como siempre.`)
      setElegidas(new Set())
      pendientes.recargar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setCreando(false)
    }
  }

  return (
    <Stack gap="md" style={PESTANA_FIJA}>
      <Group align="flex-end" gap="md">
        <Select
          label="Cliente"
          data={clientes.datos ?? []}
          value={cliente}
          onChange={(v) => {
            setCliente(v)
            setElegidas(new Set())
          }}
          searchable
          clearable
          placeholder="Todos"
          w={300}
        />
        <Select label="Serie del albarán" data={series.datos ?? []} value={serie} onChange={setSerie} searchable w={260} />
        <Button onClick={() => void crear()} loading={creando} disabled={elegidas.size === 0 || mezcla || !serie}>
          {`Crear albarán${elegidas.size ? ` (${elegidas.size})` : ''}`}
        </Button>
      </Group>

      {mezcla && <Alert color="yellow">Un albarán es de un solo cliente: deja marcadas solo las muestras de uno.</Alert>}
      {hecho && <Alert color="teal" withCloseButton onClose={() => setHecho(null)}>{hecho}</Alert>}
      {(error || pendientes.error) && <Alert color="red">{error ?? pendientes.error}</Alert>}

      <Box style={CUERPO_SCROLL}>
          <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>Nº</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Referencia</Table.Th>
              <Table.Th>Informe</Table.Th>
              <Table.Th ta="right">Importe</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>
                  <Checkbox aria-label={`Elegir la muestra ${m.numero_entrada}`} checked={elegidas.has(m.id)} onChange={(e) => alternar(m.id, e.currentTarget.checked)} />
                </Table.Td>
                <Table.Td>{m.numero_entrada}</Table.Td>
                <Table.Td>{m.cliente_nombre}</Table.Td>
                <Table.Td>{m.referencia}</Table.Td>
                <Table.Td>{formatearFecha(m.fecha_informe)}</Table.Td>
                <Table.Td ta="right">{importeLab(m.importe_neto)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
      {!pendientes.cargando && filas.length === 0 && <Text c="dimmed">No hay muestras pendientes de facturar.</Text>}
    </Stack>
  )
}
