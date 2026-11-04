import { Alert, Badge, Button, ColorInput, Group, Modal, NumberInput, Select, Stack, Switch, Table, Text, Textarea, TextInput } from '@mantine/core'
import { Fragment, useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  crearEnCatalogo,
  editarEnCatalogo,
  eliminarDeCatalogo,
  listarArticulos,
  listarCatalogo,
  type FilaCatalogo,
  type Opcion,
} from '../../api/laboratorio'
import { CATALOGOS, type Catalogo, type CampoCatalogo, type Origen } from './catalogos'
import { importeLab, useCarga } from './comun'
import Confirmar from './Confirmar'

type Opciones = Record<string, Opcion[]>

/** Las opciones fijas (como el tipo de límite) viajan como texto; las demás son el id de otra fila. */
const esFija = (o: Origen | undefined) => typeof o === 'object' && 'fijas' in o

async function opcionesDe(origen: Origen): Promise<Opcion[]> {
  if (origen === 'articulos') return listarArticulos()
  if (esFija(origen)) return (origen as { fijas: readonly [string, string][] }).fijas.map(([value, label]) => ({ value, label }))
  const { catalogo, etiqueta } = origen as { catalogo: string; etiqueta: string }
  const filas = await listarCatalogo(catalogo)
  return filas.map((f) => ({ value: String(f.id), label: String(f[etiqueta] ?? '') }))
}

/** Las opciones de todos los campos de este catálogo que apuntan a otra cosa. */
async function opcionesDelCatalogo(c: Catalogo): Promise<Opciones> {
  const conOrigen = c.campos.filter((f) => f.origen)
  const listas = await Promise.all(conOrigen.map((f) => opcionesDe(f.origen!)))
  return Object.fromEntries(conOrigen.map((f, i) => [f.clave, listas[i]!]))
}

/** Cómo se ve un dato en la tabla. */
function textoDe(campo: CampoCatalogo, fila: FilaCatalogo, opciones: Opciones): string {
  const valor = fila[campo.clave]
  if (valor === null || valor === undefined || valor === '') return ''
  if (campo.tipo === 'si_no') return Number(valor) ? 'Sí' : 'No'
  if (campo.tipo === 'lista') return opciones[campo.clave]?.find((o) => o.value === String(valor))?.label ?? String(valor)
  if (campo.clave === 'precio') return importeLab(valor)
  return String(valor)
}

/** Los catálogos del laboratorio: un selector y la tabla del que se elija. */
export default function PestanaCatalogos() {
  const [idCatalogo, setIdCatalogo] = useState(CATALOGOS[0]!.id)
  const catalogo = CATALOGOS.find((c) => c.id === idCatalogo)!
  const [edicion, setEdicion] = useState<FilaCatalogo | 'nueva' | null>(null)

  const filas = useCarga(() => listarCatalogo(idCatalogo), [idCatalogo])
  const opciones = useCarga(() => opcionesDelCatalogo(catalogo), [idCatalogo])

  const columnas = catalogo.columnas.map((k) => catalogo.campos.find((c) => c.clave === k)!)

  return (
    <Stack gap="md">
      <Group align="flex-end">
        <Select
          label="Catálogo"
          data={CATALOGOS.map((c) => ({ value: c.id, label: c.etiqueta }))}
          value={idCatalogo}
          onChange={(v) => v && setIdCatalogo(v)}
          allowDeselect={false}
          w={260}
        />
        <Button onClick={() => setEdicion('nueva')} ml="auto">
          Añadir
        </Button>
      </Group>

      {(filas.error || opciones.error) && <Alert color="red">{filas.error ?? opciones.error}</Alert>}

      <Table highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr>
            {columnas.map((c) => (
              <Table.Th key={c.clave}>{c.etiqueta}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(filas.datos ?? []).map((f) => (
            <Table.Tr key={f.id} onClick={() => setEdicion(f)} style={{ cursor: 'pointer' }}>
              {columnas.map((c) => (
                <Table.Td key={c.clave}>
                  {c.clave === 'activo' && !Number(f.activo) ? (
                    <Badge color="gray">Sin uso</Badge>
                  ) : c.tipo === 'color' ? (
                    f[c.clave] ? <Badge style={{ backgroundColor: String(f[c.clave]), color: '#212529' }}>{String(f[c.clave])}</Badge> : null
                  ) : (
                    textoDe(c, f, opciones.datos ?? {})
                  )}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!filas.cargando && filas.datos?.length === 0 && <Text c="dimmed">Todavía no hay nada en este catálogo.</Text>}

      {edicion !== null && (
        <DialogoCatalogo
          key={edicion === 'nueva' ? 'nueva' : edicion.id}
          catalogo={catalogo}
          fila={edicion === 'nueva' ? null : edicion}
          opciones={opciones.datos ?? {}}
          alCerrar={() => setEdicion(null)}
          alGuardada={() => {
            setEdicion(null)
            filas.recargar()
          }}
        />
      )}
    </Stack>
  )
}

interface PropsDialogo {
  catalogo: Catalogo
  fila: FilaCatalogo | null
  opciones: Opciones
  alCerrar: () => void
  alGuardada: () => void
}

type Valor = string | number | boolean | null

function DialogoCatalogo({ catalogo, fila, opciones, alCerrar, alGuardada }: PropsDialogo) {
  const [v, setV] = useState<Record<string, Valor>>(() =>
    Object.fromEntries(
      catalogo.campos.map((c) => {
        const actual = fila?.[c.clave] ?? null
        if (c.tipo === 'si_no') return [c.clave, fila ? Boolean(Number(actual)) : c.clave === 'activo']
        return [c.clave, actual === null ? '' : c.tipo === 'lista' ? String(actual) : actual]
      }),
    ),
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrando, setBorrando] = useState(false)

  /** Vacío se manda como nulo al editar (para poder borrar el dato) y no se manda al crear. */
  function datos(): Record<string, unknown> {
    const salida: Record<string, unknown> = {}
    for (const c of catalogo.campos) {
      const valor = v[c.clave]
      if (c.tipo === 'si_no') salida[c.clave] = valor ? 1 : 0
      else if (valor === '' || valor === null) {
        if (fila) salida[c.clave] = null
      } else salida[c.clave] = c.tipo === 'lista' ? (esFija(c.origen) ? valor : Number(valor)) : valor
    }
    return salida
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      if (fila) await editarEnCatalogo(catalogo.id, fila.id, datos())
      else await crearEnCatalogo(catalogo.id, datos())
      alGuardada()
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  const falta = catalogo.campos.some((c) => c.obligatorio && (v[c.clave] === '' || v[c.clave] === null))

  return (
    <Modal opened onClose={alCerrar} title={`${fila ? 'Editar' : 'Añadir'} · ${catalogo.etiqueta}`}>
      <Stack gap="sm">
        {catalogo.campos.map((c) => (
          <Fragment key={c.clave}>
            {(() => {
          const comun = { label: c.etiqueta, withAsterisk: c.obligatorio }
          const cambiar = (valor: Valor) => setV((a) => ({ ...a, [c.clave]: valor }))
          if (c.tipo === 'si_no')
            return <Switch {...comun} checked={Boolean(v[c.clave])} onChange={(e) => cambiar(e.currentTarget.checked)} />
          if (c.tipo === 'lista')
            return <Select {...comun} data={opciones[c.clave] ?? []} value={(v[c.clave] as string) || null} onChange={cambiar} searchable clearable={!c.obligatorio} />
          if (c.tipo === 'color')
            return <ColorInput {...comun} format="hex" value={String(v[c.clave] ?? '')} onChange={cambiar} />
          if (c.tipo === 'area')
            return <Textarea {...comun} autosize minRows={2} value={String(v[c.clave] ?? '')} onChange={(e) => cambiar(e.currentTarget.value)} />
          if (c.tipo === 'entero' || c.tipo === 'numero')
            return (
              <NumberInput
                {...comun}
                allowDecimal={c.tipo === 'numero'}
                decimalSeparator=","
                value={v[c.clave] as number | string}
                onChange={cambiar}
              />
            )
          return <TextInput {...comun} value={String(v[c.clave] ?? '')} onChange={(e) => cambiar(e.currentTarget.value)} />
            })()}
          </Fragment>
        ))}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="space-between">
          {fila ? (
            <Button color="red" variant="light" onClick={() => setBorrando(true)}>
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} loading={guardando} disabled={falta}>
              Guardar
            </Button>
          </Group>
        </Group>
      </Stack>
      {fila && borrando && (
        <Confirmar
          titulo="Eliminar"
          texto="Se borra de este catálogo. Si ya se ha usado no se podrá: entonces, déjalo sin uso."
          etiqueta="Eliminar"
          alConfirmar={async () => {
            await eliminarDeCatalogo(catalogo.id, fila.id)
            alGuardada()
          }}
          alCerrar={() => setBorrando(false)}
        />
      )}
    </Modal>
  )
}
