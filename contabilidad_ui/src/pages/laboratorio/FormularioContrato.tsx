import { Alert, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { crearContrato, editarContrato, listarArticulos, listarClientes, listarSeries, type Contrato, type DatosContrato } from '../../api/laboratorio'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { useCarga } from './comun'

interface Props {
  /** Nulo para dar de alta. */
  contrato: Contrato | null
  alCerrar: () => void
  /** Id del contrato guardado. */
  alGuardado: (id: number) => void
}

const t = (v: string | null | undefined) => v ?? ''
const id = (v: number | null | undefined) => (v ? String(v) : null)
const num = (v: string | null) => (v ? Number(v) : null)

/** Alta y edición de los datos de un contrato (las líneas se llevan desde su ficha). */
export default function FormularioContrato({ contrato, alCerrar, alGuardado }: Props) {
  const c = contrato
  const [cliente, setCliente] = useState<string | null>(id(c?.id_receptor))
  const [nombre, setNombre] = useState(c?.id_receptor ? '' : t(c?.cliente_nombre))
  const [nif, setNif] = useState(t(c?.cliente_nif))
  const [descripcion, setDescripcion] = useState(t(c?.descripcion))
  const [inicio, setInicio] = useState(t(c?.fecha_inicio).slice(0, 10))
  const [fin, setFin] = useState(t(c?.fecha_fin).slice(0, 10))
  const [importe, setImporte] = useState<number | string>(c?.importe === null || c?.importe === undefined ? '' : Number(c.importe))
  const [serie, setSerie] = useState<string | null>(id(c?.id_serie))
  const [articulo, setArticulo] = useState<string | null>(id(c?.id_articulo))
  const [activo, setActivo] = useState<string>(c?.estado ?? 'activo')
  const [observaciones, setObservaciones] = useState(t(c?.observaciones))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientes = useCarga(listarClientes, [])
  const series = useCarga(listarSeries, [])
  const articulos = useCarga(listarArticulos, [])

  async function guardar() {
    setGuardando(true)
    setError(null)
    const datos: DatosContrato = {
      id_receptor: num(cliente),
      descripcion: descripcion || null,
      fecha_inicio: inicio || null,
      fecha_fin: fin || null,
      importe: importe === '' ? null : Number(importe),
      id_serie: num(serie),
      id_articulo: num(articulo),
      estado: activo as 'activo' | 'inactivo',
      observaciones: observaciones || null,
    }
    if (!cliente) {
      datos.cliente_nombre = nombre || null
      datos.cliente_nif = nif || null
    }
    try {
      alGuardado(c ? (await editarContrato(c.id, datos)).id ?? c.id : (await crearContrato(datos)).id)
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal opened onClose={alCerrar} size="lg" title={c ? 'Editar contrato' : 'Nuevo contrato'}>
      <Stack gap="sm">
        <Select
          label="Cliente"
          data={clientes.datos ?? []}
          value={cliente}
          onChange={setCliente}
          searchable
          clearable
          description="Hace falta uno de la lista para poder facturar"
        />
        {!cliente && (
          <SimpleGrid cols={2}>
            <TextInput label="Nombre del cliente" value={nombre} onChange={(e) => setNombre(e.currentTarget.value)} />
            <TextInput label="NIF" value={nif} onChange={(e) => setNif(e.currentTarget.value)} />
          </SimpleGrid>
        )}
        <TextInput label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.currentTarget.value)} />
        <SimpleGrid cols={3}>
          <CasillaFecha label="Desde" value={fechaDeApi(inicio)} onChange={(f) => setInicio(fechaParaApi(f))} clearable />
          <CasillaFecha label="Hasta" description="Vacío = sin fin" value={fechaDeApi(fin)} onChange={(f) => setFin(fechaParaApi(f))} clearable />
          <NumberInput label="Importe por facturación" value={importe} onChange={setImporte} decimalScale={2} />
        </SimpleGrid>
        <SimpleGrid cols={2}>
          <Select label="Serie de factura" data={series.datos ?? []} value={serie} onChange={setSerie} searchable clearable />
          <Select label="Artículo por defecto" data={articulos.datos ?? []} value={articulo} onChange={setArticulo} searchable clearable />
        </SimpleGrid>
        <Select
          label="Estado"
          data={[
            { value: 'activo', label: 'Activo' },
            { value: 'inactivo', label: 'Inactivo (histórico)' },
          ]}
          value={activo}
          onChange={(v) => v && setActivo(v)}
          allowDeselect={false}
          w={220}
        />
        <Textarea label="Observaciones" autosize minRows={2} value={observaciones} onChange={(e) => setObservaciones(e.currentTarget.value)} />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} loading={guardando}>
            Guardar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
