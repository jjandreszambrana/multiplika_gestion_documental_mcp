import { Alert, Box, Badge, Button, Checkbox, Group, Pagination, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useState } from 'react'
import { crearLinea, crearMuestra, listarCatalogo, listarClientes, listarMuestras, obtenerMuestra, type DatosMuestra } from '../../api/laboratorio'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { formatearEntero, formatearFecha } from '../../lib/format'
import { FILAS_POR_PAGINA, importeLab, useCarga, CUERPO_SCROLL, PESTANA_FIJA } from './comun'
import DialogoDuplicar, { type OpcionesDuplicado } from './DialogoDuplicar'
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
  const [marcadas, setMarcadas] = useState<ReadonlySet<number>>(new Set())
  const [duplicando, setDuplicando] = useState(false)
  const [hecho, setHecho] = useState<string | null>(null)

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

  const registros = lista.datos?.registros ?? []
  const todasMarcadas = registros.length > 0 && registros.every((m) => marcadas.has(m.id))
  const marcar = (ids: number[], poner: boolean) =>
    setMarcadas((a) => {
      const n = new Set(a)
      ids.forEach((id) => (poner ? n.add(id) : n.delete(id)))
      return n
    })

  /** Copia los datos y los parámetros de cada muestra marcada, con las fechas elegidas; solo las fechas de toma y entrada se rellenan. */
  async function duplicar(opciones: OpcionesDuplicado) {
    let hechas = 0
    for (const id of [...marcadas]) {
      const o = await obtenerMuestra(id)
      const datos: DatosMuestra = {
        id_receptor: o.id_receptor,
        cliente_nif: o.cliente_nif,
        cliente_nombre: o.id_receptor ? null : o.cliente_nombre,
        cliente_direccion: o.cliente_direccion,
        cliente_localidad: o.cliente_localidad,
        cliente_codigo_postal: o.cliente_codigo_postal,
        cliente_provincia: o.cliente_provincia,
        fecha_toma: `${opciones.fecha_toma}T00:00:00`,
        fecha_entrada: `${opciones.fecha_entrada}T00:00:00`,
        fecha_prevista: null,
        fecha_informe: null,
        referencia: o.referencia,
        punto_toma: o.punto_toma,
        normativa: o.normativa,
        observaciones: o.observaciones,
        descripcion_servicio: o.descripcion_servicio,
        id_laboratorio_externo: o.id_laboratorio_externo,
        codigo_analisis_externo: o.codigo_analisis_externo,
        id_tarifa: o.id_tarifa,
        importe_neto: o.importe_neto === null || o.importe_neto === '' ? null : Number(o.importe_neto),
      }
      const copia = await crearMuestra(datos)
      for (const l of o.lineas) {
        await crearLinea(copia.id, {
          id_parametro: l.id_parametro,
          grupo: l.grupo,
          parametro: l.parametro,
          resultado: opciones.conservarResultados ? l.resultado : null,
          unidad: l.unidad,
          metodo: l.metodo,
          limite: l.limite,
          marca: l.marca,
        })
      }
      hechas += 1
    }
    setMarcadas(new Set())
    setHecho(
      `${hechas === 1 ? 'Se ha duplicado 1 muestra' : `Se han duplicado ${hechas} muestras`}, con sus parámetros y ${opciones.conservarResultados ? 'con' : 'sin'} resultados.`,
    )
    lista.recargar()
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
        <Button variant="light" onClick={() => setDuplicando(true)} disabled={marcadas.size === 0} ml="auto">
          {`Duplicar${marcadas.size ? ` (${marcadas.size})` : ''}`}
        </Button>
        <Button onClick={() => setNueva(true)}>Nueva muestra</Button>
      </Group>

      {lista.error && <Alert color="red">{lista.error}</Alert>}
      {hecho && <Alert color="teal" withCloseButton onClose={() => setHecho(null)}>{hecho}</Alert>}

      <Box style={CUERPO_SCROLL}>
          <Table stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>
              <Checkbox
                aria-label="Marcar todas las de esta página"
                checked={todasMarcadas}
                indeterminate={!todasMarcadas && registros.some((m) => marcadas.has(m.id))}
                onChange={(e) => marcar(registros.map((m) => m.id), e.currentTarget.checked)}
              />
            </Table.Th>
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
            {registros.map((m) => (
              <Table.Tr key={m.id} onClick={() => setAbierta(m.id)} style={{ cursor: 'pointer', backgroundColor: m.color_estado || undefined, color: m.color_estado ? '#212529' : undefined }}>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  aria-label={`Marcar la muestra ${m.numero_entrada}`}
                  checked={marcadas.has(m.id)}
                  onChange={(e) => marcar([m.id], e.currentTarget.checked)}
                />
              </Table.Td>
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

      {duplicando && (
        <DialogoDuplicar cantidad={marcadas.size} alDuplicar={duplicar} alCerrar={() => setDuplicando(false)} />
      )}
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
