import { Alert, Box, Badge, Button, Group, Pagination, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useState } from 'react'
import { listarCatalogo, listarClientes, listarMuestras } from '../../api/laboratorio'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { formatearEntero, formatearFecha } from '../../lib/format'
import { FILAS_POR_PAGINA, importeLab, useCarga, CUERPO_SCROLL, PESTANA_FIJA } from './comun'
import FichaMuestra from './FichaMuestra'
import FormularioMuestra from './FormularioMuestra'

/** Listado de muestras con filtros; al pulsar una fila se abre su ficha. */
export default function PestanaMuestras() {
  const [texto, setTexto] = useState('')
  const [textoFiltro] = useDebouncedValue(texto, 400)
  const [cliente, setCliente] = useState<string | null>(null)
  const [estado, setEstado] = useState<string | null>(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [nueva, setNueva] = useState(false)

  const clientes = useCarga(listarClientes, [])
  const estados = useCarga(() => listarCatalogo('estados'), [])

  const lista = useCarga(
    () =>
      listarMuestras({
        texto: textoFiltro || undefined,
        id_receptor: cliente ? Number(cliente) : undefined,
        id_estado: estado ? Number(estado) : undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        limite: FILAS_POR_PAGINA,
        desplazamiento: (pagina - 1) * FILAS_POR_PAGINA,
      }),
    [textoFiltro, cliente, estado, desde, hasta, pagina],
  )

  /** Cambiar un filtro vuelve a la primera página. */
  const filtrar = <T,>(poner: (v: T) => void) => (v: T) => {
    poner(v)
    setPagina(1)
  }

  const total = lista.datos?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA))

  return (
    <Stack gap="md" style={PESTANA_FIJA}>
      <Group align="flex-end" gap="md">
        <TextInput
          label="Buscar"
          placeholder="Número, cliente, referencia o punto de toma"
          value={texto}
          onChange={(e) => filtrar(setTexto)(e.currentTarget.value)}
          w={300}
        />
        <Select
          label="Cliente"
          data={clientes.datos ?? []}
          value={cliente}
          onChange={filtrar(setCliente)}
          searchable
          clearable
          placeholder="Todos"
          w={260}
        />
        <Select
          label="Estado"
          data={(estados.datos ?? []).map((e) => ({ value: String(e.id), label: String(e.denominacion) }))}
          value={estado}
          onChange={filtrar(setEstado)}
          clearable
          placeholder="Todos"
          w={160}
        />
        <CasillaFecha
          label="Toma desde"
          value={fechaDeApi(desde)}
          onChange={(f) => filtrar(setDesde)(fechaParaApi(f))}
          clearable
          w={150}
        />
        <CasillaFecha
          label="Toma hasta"
          value={fechaDeApi(hasta)}
          onChange={(f) => filtrar(setHasta)(fechaParaApi(f))}
          clearable
          w={150}
        />
        <Button onClick={() => setNueva(true)} ml="auto">
          Nueva muestra
        </Button>
      </Group>

      {lista.error && <Alert color="red">{lista.error}</Alert>}

      <Box style={CUERPO_SCROLL}>
          <Table stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nº</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Referencia</Table.Th>
              <Table.Th>Punto de toma</Table.Th>
              <Table.Th>Toma</Table.Th>
              <Table.Th>Informe</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th ta="right">Importe</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(lista.datos?.registros ?? []).map((m) => (
              <Table.Tr key={m.id} onClick={() => setAbierta(m.id)} style={{ cursor: 'pointer', backgroundColor: m.color_estado || undefined, color: m.color_estado ? '#212529' : undefined }}>
                <Table.Td>{m.numero_entrada}</Table.Td>
                <Table.Td>{m.cliente_nombre}</Table.Td>
                <Table.Td>{m.referencia}</Table.Td>
                <Table.Td>{m.punto_toma}</Table.Td>
                <Table.Td>{formatearFecha(m.fecha_toma)}</Table.Td>
                <Table.Td>{formatearFecha(m.fecha_informe)}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{m.estado}</Badge>
                </Table.Td>
                <Table.Td ta="right">{importeLab(m.importe_neto)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      {!lista.cargando && total === 0 && <Text c="dimmed">No hay muestras con esos filtros.</Text>}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">{`${formatearEntero(total)} muestras`}</Text>
        <Pagination value={pagina} onChange={setPagina} total={paginas} />
      </Group>

      {abierta !== null && (
        <FichaMuestra id={abierta} alCerrar={() => setAbierta(null)} alCambiar={lista.recargar} />
      )}
      {nueva && (
        <FormularioMuestra
          muestra={null}
          alCerrar={() => setNueva(false)}
          alGuardada={(m) => {
            setNueva(false)
            lista.recargar()
            setAbierta(m.id)
          }}
        />
      )}
    </Stack>
  )
}
