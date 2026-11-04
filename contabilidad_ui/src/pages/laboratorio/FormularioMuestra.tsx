import { Alert, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  crearMuestra,
  editarMuestra,
  listarCatalogo,
  listarClientes,
  type DatosMuestra,
  type Muestra,
} from '../../api/laboratorio'
import { CasillaFecha } from '../../components/CasillaFecha'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { useCarga } from './comun'

interface Props {
  /** Nula para dar de alta. */
  muestra: Muestra | null
  /** Alta desde el plan de muestreo de un contrato. */
  idLineaContrato?: number
  alCerrar: () => void
  alGuardada: (muestra: Muestra) => void
}

/** Campos que la API guarda con hora (el resto va solo con fecha): a medianoche si solo se elige el día. */
const CON_HORA = ['fecha_toma', 'fecha_entrada'] as const

type Valores = Required<Omit<DatosMuestra, 'oculto' | 'id_linea_contrato' | 'fecha_informe' | 'id_laboratorio_externo' | 'id_tarifa' | 'id_receptor' | 'importe_neto'>> & {
  id_receptor: string | null
  id_tarifa: string | null
  id_laboratorio_externo: string | null
  importe_neto: number | string
}

const texto = (v: string | null | undefined) => v ?? ''
const idTexto = (v: number | null | undefined) => (v ? String(v) : null)

function inicialesDe(m: Muestra | null): Valores {
  return {
    id_receptor: idTexto(m?.id_receptor),
    cliente_nif: texto(m?.cliente_nif),
    cliente_nombre: m?.id_receptor ? '' : texto(m?.cliente_nombre),
    cliente_direccion: texto(m?.cliente_direccion),
    cliente_localidad: texto(m?.cliente_localidad),
    cliente_codigo_postal: texto(m?.cliente_codigo_postal),
    cliente_provincia: texto(m?.cliente_provincia),
    fecha_toma: texto(m?.fecha_toma).slice(0, 10),
    fecha_entrada: texto(m?.fecha_entrada).slice(0, 10),
    fecha_prevista: texto(m?.fecha_prevista).slice(0, 10),
    referencia: texto(m?.referencia),
    punto_toma: texto(m?.punto_toma),
    normativa: texto(m?.normativa),
    observaciones: texto(m?.observaciones),
    descripcion_servicio: texto(m?.descripcion_servicio),
    codigo_analisis_externo: texto(m?.codigo_analisis_externo),
    id_tarifa: idTexto(m?.id_tarifa),
    id_laboratorio_externo: idTexto(m?.id_laboratorio_externo),
    importe_neto: m?.importe_neto ?? '',
  }
}

/** Alta y edición de los datos de una muestra. Los resultados se ponen en su ficha. */
export default function FormularioMuestra({ muestra, idLineaContrato, alCerrar, alGuardada }: Props) {
  const inicial = inicialesDe(muestra)
  const [v, setV] = useState<Valores>(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientes = useCarga(listarClientes, [])
  const tarifas = useCarga(() => listarCatalogo('tarifas', { activo: 1 }), [])
  const externos = useCarga(() => listarCatalogo('laboratorios_externos', { activo: 1 }), [])

  const poner = <K extends keyof Valores>(clave: K) => (valor: Valores[K]) => setV((a) => ({ ...a, [clave]: valor }))
  const texto_ = (clave: keyof Valores) => ({
    value: String(v[clave] ?? ''),
    onChange: (e: { currentTarget: { value: string } }) => poner(clave)(e.currentTarget.value as never),
  })
  const fecha = (clave: 'fecha_toma' | 'fecha_entrada' | 'fecha_prevista') => ({
    value: fechaDeApi(v[clave]),
    onChange: (f: Date | null) => poner(clave)(fechaParaApi(f)),
    clearable: true,
  })

  /** Al editar solo viajan los campos que han cambiado: una fecha con hora no se pisa con la del día. */
  function cambios(): DatosMuestra {
    const dato: Record<string, unknown> = {}
    for (const clave of Object.keys(v) as (keyof Valores)[]) {
      if (muestra && v[clave] === inicial[clave]) continue
      const valor = v[clave]
      dato[clave] =
        valor === '' || valor === null
          ? null
          : clave.startsWith('id_')
            ? Number(valor)
            : clave === 'importe_neto'
              ? Number(valor)
              : (CON_HORA as readonly string[]).includes(clave)
                ? `${valor}T00:00:00`
                : valor
    }
    return dato as DatosMuestra
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const datos = cambios()
      alGuardada(muestra ? await editarMuestra(muestra.id, datos) : await crearMuestra(idLineaContrato ? { ...Object.fromEntries(Object.entries(datos).filter(([, x]) => x !== null)), id_linea_contrato: idLineaContrato } : datos))
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal opened onClose={alCerrar} size="xl" title={muestra ? `Muestra ${muestra.numero_entrada}` : 'Nueva muestra'}>
      <Stack gap="sm">
        {idLineaContrato ? (
          <Alert color="blue">El cliente y la descripción del servicio se rellenan solos con los del contrato.</Alert>
        ) : (
          <>
        <Select
          label="Cliente"
          data={clientes.datos ?? []}
          value={v.id_receptor}
          onChange={poner('id_receptor')}
          searchable
          clearable
          description="Elige uno de la lista o déjalo vacío y escríbelo a mano"
        />
        {!v.id_receptor && (
          <SimpleGrid cols={2}>
            <TextInput label="Nombre del cliente" {...texto_('cliente_nombre')} />
            <TextInput label="NIF" {...texto_('cliente_nif')} />
            <TextInput label="Dirección" {...texto_('cliente_direccion')} />
            <TextInput label="Localidad" {...texto_('cliente_localidad')} />
            <TextInput label="Código postal" {...texto_('cliente_codigo_postal')} />
            <TextInput label="Provincia" {...texto_('cliente_provincia')} />
          </SimpleGrid>
        )}
          </>
        )}
        <SimpleGrid cols={3}>
          <CasillaFecha label="Fecha de toma" {...fecha('fecha_toma')} />
          <CasillaFecha label="Fecha de entrada" {...fecha('fecha_entrada')} />
          <CasillaFecha label="Fecha prevista" {...fecha('fecha_prevista')} />
        </SimpleGrid>
        <SimpleGrid cols={2}>
          <TextInput label="Referencia" {...texto_('referencia')} />
          <TextInput label="Punto de toma" {...texto_('punto_toma')} />
        </SimpleGrid>
        <Textarea label="Normativa" autosize minRows={2} {...texto_('normativa')} />
        <Textarea label="Observaciones" autosize minRows={2} {...texto_('observaciones')} />
        {!idLineaContrato && <Textarea label="Descripción del servicio" autosize minRows={2} {...texto_('descripcion_servicio')} />}
        <SimpleGrid cols={3}>
          <Select
            label="Tarifa"
            data={(tarifas.datos ?? []).map((t) => ({ value: String(t.id), label: String(t.concepto) }))}
            value={v.id_tarifa}
            onChange={poner('id_tarifa')}
            clearable
          />
          <NumberInput
            label="Importe (€)"
            description="Si lo dejas vacío, se toma el precio de la tarifa"
            decimalScale={2}
            decimalSeparator=","
            thousandSeparator="."
            value={v.importe_neto}
            onChange={poner('importe_neto')}
          />
          <Select
            label="Laboratorio externo"
            data={(externos.datos ?? []).map((l) => ({ value: String(l.id), label: String(l.nombre) }))}
            value={v.id_laboratorio_externo}
            onChange={poner('id_laboratorio_externo')}
            clearable
          />
        </SimpleGrid>
        {v.id_laboratorio_externo && <TextInput label="Código del análisis externo" {...texto_('codigo_analisis_externo')} />}
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
