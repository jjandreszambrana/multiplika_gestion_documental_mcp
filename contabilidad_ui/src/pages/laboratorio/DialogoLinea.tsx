import { Alert, Button, Group, Modal, Select, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  crearLinea,
  editarLinea,
  listarCatalogo,
  type DatosLinea,
  type LineaResultado,
  type Muestra,
} from '../../api/laboratorio'
import { useCarga } from './comun'

interface Props {
  idMuestra: number
  /** Nula para añadir una línea nueva. */
  linea: LineaResultado | null
  alCerrar: () => void
  alGuardada: (muestra: Muestra) => void
}

type Valores = Record<'grupo' | 'parametro' | 'resultado' | 'unidad' | 'metodo' | 'limite' | 'marca', string>

/** Un resultado de la muestra: del catálogo (rellena unidad, método y límite) o escrito a mano. */
export default function DialogoLinea({ idMuestra, linea, alCerrar, alGuardada }: Props) {
  const [idParametro, setIdParametro] = useState<string | null>(idTexto(linea?.id_parametro))
  const [v, setV] = useState<Valores>({
    grupo: linea?.grupo ?? '',
    parametro: linea?.parametro ?? '',
    resultado: linea?.resultado ?? '',
    unidad: linea?.unidad ?? '',
    metodo: linea?.metodo ?? '',
    limite: linea?.limite ?? '',
    marca: linea?.marca ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parametros = useCarga(() => listarCatalogo('parametros', { activo: 1 }), [])
  const grupos = useCarga(() => listarCatalogo('grupos_parametros'), [])
  const unidades = useCarga(() => listarCatalogo('unidades'), [])
  const metodos = useCarga(() => listarCatalogo('metodos'), [])

  function elegirParametro(id: string | null) {
    setIdParametro(id)
    const p = parametros.datos?.find((f) => String(f.id) === id)
    if (!p) return
    const nombre = (filas: typeof grupos.datos, clave: string, campo: string) =>
      String(filas?.find((f) => f.id === p[clave])?.[campo] ?? '')
    setV((a) => ({
      ...a,
      parametro: String(p.parametro),
      grupo: nombre(grupos.datos, 'id_grupo', 'grupo'),
      unidad: nombre(unidades.datos, 'id_unidad', 'unidad'),
      metodo: nombre(metodos.datos, 'id_metodo', 'codigo'),
      limite: String(p.limite_texto ?? ''),
    }))
  }

  const campo = (clave: keyof Valores, etiqueta: string) => (
    <TextInput
      label={etiqueta}
      value={v[clave]}
      onChange={(e) => setV((a) => ({ ...a, [clave]: e.currentTarget.value }))}
    />
  )

  async function guardar() {
    setGuardando(true)
    setError(null)
    // Lo vacío se manda como nulo al editar (para poder borrar un dato) y no se manda al crear.
    const datos: DatosLinea = { id_parametro: idParametro ? Number(idParametro) : null }
    for (const [clave, valor] of Object.entries(v)) {
      if (linea || valor.trim() !== '') (datos as Record<string, unknown>)[clave] = valor.trim() || null
    }
    try {
      alGuardada(linea ? await editarLinea(linea.id, datos) : await crearLinea(idMuestra, datos))
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal opened onClose={alCerrar} size="lg" title={linea ? 'Editar resultado' : 'Añadir resultado'}>
      <Stack gap="sm">
        <Select
          label="Parámetro del catálogo"
          description="Al elegirlo se rellenan el grupo, la unidad, el método y el límite. Si no está, escríbelo abajo a mano."
          data={(parametros.datos ?? []).map((p) => ({ value: String(p.id), label: String(p.parametro) }))}
          value={idParametro}
          onChange={elegirParametro}
          searchable
          clearable
        />
        <SimpleGrid cols={2}>
          {campo('parametro', 'Parámetro')}
          {campo('grupo', 'Grupo')}
        </SimpleGrid>
        <SimpleGrid cols={2}>
          {campo('resultado', 'Resultado')}
          {campo('marca', 'Marca (por ejemplo * o (1))')}
        </SimpleGrid>
        <SimpleGrid cols={3}>
          {campo('unidad', 'Unidad')}
          {campo('metodo', 'Método')}
          {campo('limite', 'Límite')}
        </SimpleGrid>
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

const idTexto = (v: number | null | undefined) => (v ? String(v) : null)
