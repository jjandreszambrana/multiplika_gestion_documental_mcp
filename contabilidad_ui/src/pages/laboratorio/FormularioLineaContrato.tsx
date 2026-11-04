import { Alert, Button, Group, Modal, MultiSelect, NumberInput, Select, Stack, Switch, Textarea, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import { crearLineaContrato, editarLineaContrato, listarArticulos, type LineaContrato } from '../../api/laboratorio'
import { useCarga } from './comun'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

interface Props {
  idContrato: number
  /** Nula para dar de alta. */
  linea: LineaContrato | null
  alCerrar: () => void
  alGuardada: () => void
}

/** Alta y edición de una línea de facturación o de muestreo de un contrato. */
export default function FormularioLineaContrato({ idContrato, linea, alCerrar, alGuardada }: Props) {
  const [tipo, setTipo] = useState<string>(linea?.tipo ?? 'facturacion')
  const [meses, setMeses] = useState<string[]>(
    (Array.isArray(linea?.meses) ? linea.meses : (linea?.meses ?? '').split(',').filter(Boolean).map(Number)).map(String),
  )
  const [descripcion, setDescripcion] = useState(linea?.descripcion ?? '')
  const [importe, setImporte] = useState<number | string>(linea?.importe === null || linea?.importe === undefined ? '' : Number(linea.importe))
  const [articulo, setArticulo] = useState<string | null>(linea?.id_articulo ? String(linea.id_articulo) : null)
  const [texto, setTexto] = useState(linea?.texto ?? '')
  const [activa, setActiva] = useState(linea ? !!linea.activo : true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const articulos = useCarga(listarArticulos, [])
  const facturacion = tipo === 'facturacion'

  async function guardar() {
    setGuardando(true)
    setError(null)
    const datos = {
      meses: meses.map(Number).sort((a, b) => a - b),
      descripcion: descripcion || null,
      activo: activa ? 1 : 0,
      ...(facturacion
        ? { importe: importe === '' ? null : Number(importe), id_articulo: articulo ? Number(articulo) : null }
        : { texto: texto || null }),
    }
    try {
      if (linea) await editarLineaContrato(linea.id, datos)
      else await crearLineaContrato(idContrato, { ...datos, tipo: tipo as 'facturacion' | 'muestreo' })
      alGuardada()
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal opened onClose={alCerrar} title={linea ? 'Editar línea' : 'Nueva línea'}>
      <Stack gap="sm">
        <Select
          label="Tipo"
          data={[
            { value: 'facturacion', label: 'Facturación' },
            { value: 'muestreo', label: 'Muestreo' },
          ]}
          value={tipo}
          onChange={(v) => v && setTipo(v)}
          allowDeselect={false}
          disabled={!!linea}
        />
        <MultiSelect label="Meses" data={MESES.map((m, i) => ({ value: String(i + 1), label: m }))} value={meses} onChange={setMeses} />
        <TextInput label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.currentTarget.value)} />
        {facturacion ? (
          <>
            <NumberInput label="Importe" description="Vacío = el del contrato" value={importe} onChange={setImporte} decimalScale={2} />
            <Select label="Artículo" description="Vacío = el del contrato" data={articulos.datos ?? []} value={articulo} onChange={setArticulo} searchable clearable />
          </>
        ) : (
          <Textarea label="Plan de muestreo" description="Qué muestras, cuántas y dónde" autosize minRows={2} value={texto} onChange={(e) => setTexto(e.currentTarget.value)} />
        )}
        <Switch label="Activa" checked={activa} onChange={(e) => setActiva(e.currentTarget.checked)} />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} loading={guardando} disabled={meses.length === 0}>
            Guardar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
