import { Alert, Badge, Box, Button, Checkbox, Group, Modal, NumberInput, Select, Stack, Switch, Table, Tabs, Text } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  articuloContratos,
  contratosAFacturar,
  eliminarContrato,
  eliminarLineaContrato,
  type LineaContrato,
  facturarContratos,
  fijarArticuloContratos,
  listarArticulos,
  listarContratos,
  muestreoDelMes,
  type MuestreoDelMes,
  obtenerContrato,
  type ResultadoFacturarContratos,
} from '../../api/laboratorio'
import { formatearFecha } from '../../lib/format'
import { importeLab, useCarga, CUERPO_SCROLL, PESTANA_FIJA } from './comun'
import Confirmar from './Confirmar'
import FormularioContrato from './FormularioContrato'
import FormularioLineaContrato from './FormularioLineaContrato'
import FormularioMuestra from './FormularioMuestra'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const nombreMeses = (m: number[] | string) =>
  (Array.isArray(m) ? m : m.split(',').map(Number))
    .map((n) => MESES[n - 1]?.slice(0, 3))
    .join(', ')

/** Elige el año y el mes con los que se trabaja en «A facturar» y «Muestreo». */
function ElegirMes({ anio, mes, cambiar }: { anio: number; mes: number; cambiar: (a: number, m: number) => void }) {
  return (
    <Group gap="md" align="flex-end">
      <Select
        label="Mes"
        data={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
        value={String(mes)}
        onChange={(v) => v && cambiar(anio, Number(v))}
        allowDeselect={false}
        w={160}
      />
      <NumberInput label="Año" value={anio} onChange={(v) => Number(v) > 2000 && cambiar(Number(v), mes)} min={2000} max={2100} w={100} />
    </Group>
  )
}

function AFacturar({ anio, mes, cambiar }: { anio: number; mes: number; cambiar: (a: number, m: number) => void }) {
  const [elegidos, setElegidos] = useState<ReadonlySet<number>>(new Set())
  const [separar, setSeparar] = useState(false)
  const [facturando, setFacturando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoFacturarContratos | null>(null)

  const lista = useCarga(() => contratosAFacturar(anio, mes), [anio, mes])
  const filas = lista.datos ?? []
  const facturables = filas.filter((c) => c.puede_facturarse)

  function alternar(id: number, marcada: boolean) {
    setElegidos((a) => {
      const n = new Set(a)
      if (marcada) n.add(id)
      else n.delete(id)
      return n
    })
  }

  async function facturar() {
    setFacturando(true)
    setError(null)
    setResultado(null)
    try {
      setResultado(await facturarContratos(anio, mes, [...elegidos], separar))
      setElegidos(new Set())
      lista.recargar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setFacturando(false)
    }
  }

  return (
    <Stack gap="md" style={PESTANA_FIJA}>
      <Group align="flex-end" gap="md">
        <ElegirMes
          anio={anio}
          mes={mes}
          cambiar={(a, m) => {
            cambiar(a, m)
            setElegidos(new Set())
          }}
        />
        <Switch label="Una factura por línea" checked={separar} onChange={(e) => setSeparar(e.currentTarget.checked)} mb={6} />
        <Button onClick={() => void facturar()} loading={facturando} disabled={elegidos.size === 0}>
          {`Facturar${elegidos.size ? ` (${elegidos.size})` : ''}`}
        </Button>
        <Button
          variant="default"
          disabled={facturables.length === 0}
          onClick={() => setElegidos(elegidos.size === facturables.length ? new Set() : new Set(facturables.map((c) => c.id)))}
        >
          {elegidos.size === facturables.length && facturables.length > 0 ? 'Quitar todos' : 'Marcar todos'}
        </Button>
      </Group>

      {resultado && (
        <Alert color={resultado.errores.length ? 'yellow' : 'teal'} withCloseButton onClose={() => setResultado(null)}>
          {resultado.facturados.length > 0 && (
            <Text>
              {`Se han creado borradores de factura para ${resultado.facturados.length} contratos. Revísalos y apruébalos en los borradores de factura.`}
            </Text>
          )}
          {resultado.errores.map((e) => (
            <Text key={e.id_contrato}>{`Contrato ${e.id_contrato}: ${e.motivo}`}</Text>
          ))}
        </Alert>
      )}
      {(error || lista.error) && <Alert color="red">{error ?? lista.error}</Alert>}

      <Box style={CUERPO_SCROLL}>
        <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Contrato</Table.Th>
              <Table.Th ta="right">Importe</Table.Th>
              <Table.Th>Avisos</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>
                  {c.puede_facturarse && (
                    <Checkbox aria-label={`Elegir ${c.cliente_nombre ?? 'el contrato'}`} checked={elegidos.has(c.id)} onChange={(e) => alternar(c.id, e.currentTarget.checked)} />
                  )}
                </Table.Td>
                <Table.Td>{c.cliente_nombre}</Table.Td>
                <Table.Td>{c.descripcion}</Table.Td>
                <Table.Td ta="right">{importeLab(c.importe)}</Table.Td>
                <Table.Td>
                  {c.problemas.map((p) => (
                    <Text key={p} c="red" fz="sm">
                      {p}
                    </Text>
                  ))}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
      {!lista.cargando && filas.length === 0 && <Text c="dimmed">No hay contratos por facturar este mes.</Text>}
    </Stack>
  )
}

const escapar = (t: string | null) =>
  (t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

/** Abre el plan del mes en una hoja limpia y lanza la impresión: ahí se elige «Guardar como PDF». */
function imprimirMuestreo(anio: number, mes: number, filas: MuestreoDelMes[]): boolean {
  const ventana = window.open('', '_blank')
  if (!ventana) return false
  const titulo = `Qué toca muestrear en ${MESES[mes - 1]} de ${anio}`
  const cuerpo = filas
    .map(
      (f) =>
        `<tr><td>${escapar(f.cliente_nombre)}</td><td>${escapar(f.descripcion)}</td><td>${escapar(f.texto)}</td><td>${f.pendiente ? 'Pendiente' : `Tomadas: ${f.tomadas}`}</td></tr>`,
    )
    .join('')
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>body{font:12px/1.4 sans-serif;margin:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999;padding:5px 8px;text-align:left;vertical-align:top}th{background:#eee}tr{break-inside:avoid}</style></head>
<body><h1>${titulo}</h1><table><thead><tr><th>Cliente</th><th>Contrato</th><th>Qué se muestrea</th><th>Estado</th></tr></thead><tbody>${cuerpo}</tbody></table></body></html>`)
  ventana.document.close()
  ventana.focus()
  ventana.print()
  return true
}

function Muestreo({ anio, mes, cambiar }: { anio: number; mes: number; cambiar: (a: number, m: number) => void }) {
  const [tomando, setTomando] = useState<number | null>(null)
  const [hecho, setHecho] = useState(false)
  const [sinVentana, setSinVentana] = useState(false)
  const lista = useCarga(() => muestreoDelMes(anio, mes), [anio, mes])
  const filas = lista.datos ?? []

  return (
    <Stack gap="md" style={PESTANA_FIJA}>
      <Group align="flex-end" gap="md">
        <ElegirMes anio={anio} mes={mes} cambiar={cambiar} />
        <Button variant="default" disabled={filas.length === 0} onClick={() => setSinVentana(!imprimirMuestreo(anio, mes, filas))}>
          Sacar PDF
        </Button>
      </Group>
      {sinVentana && <Alert color="yellow" withCloseButton onClose={() => setSinVentana(false)}>El navegador ha bloqueado la ventana. Permite las ventanas emergentes para esta página.</Alert>}
      {hecho && <Alert color="teal" withCloseButton onClose={() => setHecho(false)}>Muestra creada.</Alert>}
      {lista.error && <Alert color="red">{lista.error}</Alert>}
      <Box style={CUERPO_SCROLL}>
        <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Contrato</Table.Th>
              <Table.Th>Qué se muestrea</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th w={140} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((f) => (
              <Table.Tr key={f.id_linea}>
                <Table.Td>{f.cliente_nombre}</Table.Td>
                <Table.Td>{f.descripcion}</Table.Td>
                <Table.Td>{f.texto}</Table.Td>
                <Table.Td>
                  {f.pendiente ? <Badge color="orange" variant="light">Pendiente</Badge> : <Badge color="teal" variant="light">{`Tomadas: ${f.tomadas}`}</Badge>}
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant="light" onClick={() => setTomando(f.id_linea)}>
                    Tomar muestra
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
      {!lista.cargando && filas.length === 0 && <Text c="dimmed">Este mes no toca muestrear nada.</Text>}
      {tomando !== null && (
        <FormularioMuestra
          muestra={null}
          idLineaContrato={tomando}
          alCerrar={() => setTomando(null)}
          alGuardada={() => {
            setTomando(null)
            setHecho(true)
            lista.recargar()
          }}
        />
      )}
    </Stack>
  )
}

function Listado() {
  const [estado, setEstado] = useState<string | null>('activo')
  const [abierto, setAbierto] = useState<number | null>(null)
  const [editando, setEditando] = useState<'nuevo' | 'editar' | null>(null)
  const [linea, setLinea] = useState<LineaContrato | 'nueva' | null>(null)
  const [borrar, setBorrar] = useState<'contrato' | LineaContrato | null>(null)
  const lista = useCarga(() => listarContratos({ estado: estado ?? undefined }), [estado])
  const ficha = useCarga(() => (abierto ? obtenerContrato(abierto) : Promise.resolve(null)), [abierto])
  const filas = lista.datos?.registros ?? []
  const c = ficha.datos

  return (
    <Stack gap="md" style={PESTANA_FIJA}>
      <Group align="flex-end" gap="md">
        <Select
          label="Estado"
          data={[
            { value: 'activo', label: 'Activos' },
            { value: 'inactivo', label: 'Inactivos (histórico)' },
          ]}
          value={estado}
          onChange={setEstado}
          clearable
          placeholder="Todos"
          w={220}
        />
        <Button onClick={() => setEditando('nuevo')}>Nuevo contrato</Button>
      </Group>
      {lista.error && <Alert color="red">{lista.error}</Alert>}
      <Box style={CUERPO_SCROLL}>
        <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Contrato</Table.Th>
              <Table.Th>Desde</Table.Th>
              <Table.Th>Hasta</Table.Th>
              <Table.Th ta="right">Importe</Table.Th>
              <Table.Th ta="right">Facturaciones</Table.Th>
              <Table.Th ta="right">Muestreos</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filas.map((f) => (
              <Table.Tr key={f.id} onClick={() => setAbierto(f.id)} style={{ cursor: 'pointer' }}>
                <Table.Td>{f.cliente_nombre}</Table.Td>
                <Table.Td>{f.descripcion}</Table.Td>
                <Table.Td>{formatearFecha(f.fecha_inicio)}</Table.Td>
                <Table.Td>{formatearFecha(f.fecha_fin)}</Table.Td>
                <Table.Td ta="right">{importeLab(f.importe)}</Table.Td>
                <Table.Td ta="right">{f.lineas_facturacion}</Table.Td>
                <Table.Td ta="right">{f.lineas_muestreo}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
      {!lista.cargando && filas.length === 0 && <Text c="dimmed">No hay contratos.</Text>}

      <Modal opened={abierto !== null} onClose={() => setAbierto(null)} size="xl" title={c ? `${c.cliente_nombre ?? ''} · ${c.descripcion ?? ''}` : 'Contrato'}>
        {ficha.error && <Alert color="red">{ficha.error}</Alert>}
        {c && (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge color={c.estado === 'activo' ? 'teal' : 'gray'} variant="light">
                {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
              </Badge>
              <Text fz="sm">{`Importe por facturación: ${importeLab(c.importe)}`}</Text>
            </Group>
            {c.observaciones && <Text fz="sm">{c.observaciones}</Text>}
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Línea</Table.Th>
                  <Table.Th>Meses</Table.Th>
                  <Table.Th>Detalle</Table.Th>
                  <Table.Th w={150} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {c.lineas.map((l) => (
                  <Table.Tr key={l.id} c={l.activo ? undefined : 'dimmed'}>
                    <Table.Td>{`${l.tipo === 'facturacion' ? 'Facturación' : 'Muestreo'}${l.descripcion ? ` · ${l.descripcion}` : ''}`}</Table.Td>
                    <Table.Td>{nombreMeses(l.meses)}</Table.Td>
                    <Table.Td>{l.tipo === 'facturacion' ? importeLab(l.importe ?? null) : l.texto}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Button size="compact-xs" variant="subtle" onClick={() => setLinea(l)}>
                          Editar
                        </Button>
                        <Button size="compact-xs" variant="subtle" color="red" onClick={() => setBorrar(l)}>
                          Quitar
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => setLinea('nueva')}>
                Añadir línea
              </Button>
              <Button size="xs" variant="default" onClick={() => setEditando('editar')}>
                Editar contrato
              </Button>
              <Button size="xs" variant="subtle" color="red" onClick={() => setBorrar('contrato')}>
                Eliminar contrato
              </Button>
            </Group>
            <Text fw={500}>Meses ya facturados</Text>
            <Text fz="sm" c="dimmed">
              {c.facturaciones.length === 0 ? 'Ninguno todavía.' : [...new Set(c.facturaciones.map((f) => f.anio_mes))].sort().reverse().join(' · ')}
            </Text>
          </Stack>
        )}
      </Modal>

      {editando && (
        <FormularioContrato
          contrato={editando === 'editar' ? c : null}
          alCerrar={() => setEditando(null)}
          alGuardado={(id) => {
            setEditando(null)
            lista.recargar()
            setAbierto(id)
            ficha.recargar()
          }}
        />
      )}
      {linea && abierto !== null && (
        <FormularioLineaContrato
          idContrato={abierto}
          linea={linea === 'nueva' ? null : linea}
          alCerrar={() => setLinea(null)}
          alGuardada={() => {
            setLinea(null)
            lista.recargar()
            ficha.recargar()
          }}
        />
      )}
      {borrar && abierto !== null && (
        <Confirmar
          titulo={borrar === 'contrato' ? 'Eliminar el contrato' : 'Quitar la línea'}
          texto={
            borrar === 'contrato'
              ? 'Solo se puede eliminar si nunca se ha facturado; si no, se deja como inactivo para conservar el histórico.'
              : 'La línea se quita del contrato. Los meses ya facturados se conservan.'
          }
          etiqueta={borrar === 'contrato' ? 'Eliminar' : 'Quitar'}
          alConfirmar={async () => {
            if (borrar === 'contrato') {
              await eliminarContrato(abierto)
              setAbierto(null)
            } else await eliminarLineaContrato(borrar.id)
            lista.recargar()
            ficha.recargar()
          }}
          alCerrar={() => setBorrar(null)}
        />
      )}
    </Stack>
  )
}

/** Artículo con que se facturan los contratos que no traen uno propio. */
function Ajuste() {
  const articulos = useCarga(listarArticulos, [])
  const actual = useCarga(articuloContratos, [])
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function cambiar(v: string | null) {
    setError(null)
    setGuardado(false)
    try {
      await fijarArticuloContratos(v ? Number(v) : null)
      actual.recargar()
      setGuardado(true)
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }

  return (
    <Stack gap="xs" maw={500}>
      <Select
        label="Artículo con que se facturan los contratos"
        description="Se usa cuando ni el contrato ni la línea traen uno. Sin él no se puede facturar."
        data={articulos.datos ?? []}
        value={actual.datos ?? null}
        onChange={(v) => void cambiar(v)}
        searchable
        clearable
      />
      {guardado && <Text c="teal" fz="sm">Guardado.</Text>}
      {(error || actual.error) && <Alert color="red">{error ?? actual.error}</Alert>}
    </Stack>
  )
}

/** Contratos del laboratorio: facturar el mes, plan de muestreo, listado y el artículo por defecto. */
export default function PestanaContratos() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const cambiar = (a: number, m: number) => {
    setAnio(a)
    setMes(m)
  }

  return (
    <Tabs defaultValue="facturar" keepMounted={false} style={{ ...PESTANA_FIJA, display: 'flex', flexDirection: 'column' }}>
      <Tabs.List mb="md">
        <Tabs.Tab value="facturar">A facturar este mes</Tabs.Tab>
        <Tabs.Tab value="muestreo">Qué toca muestrear</Tabs.Tab>
        <Tabs.Tab value="contratos">Contratos</Tabs.Tab>
        <Tabs.Tab value="ajuste">Ajuste</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="facturar" style={{ ...PESTANA_FIJA, display: 'flex', flexDirection: 'column' }}>
        <AFacturar anio={anio} mes={mes} cambiar={cambiar} />
      </Tabs.Panel>
      <Tabs.Panel value="muestreo" style={{ ...PESTANA_FIJA, display: 'flex', flexDirection: 'column' }}>
        <Muestreo anio={anio} mes={mes} cambiar={cambiar} />
      </Tabs.Panel>
      <Tabs.Panel value="contratos" style={{ ...PESTANA_FIJA, display: 'flex', flexDirection: 'column' }}>
        <Listado />
      </Tabs.Panel>
      <Tabs.Panel value="ajuste">
        <Ajuste />
      </Tabs.Panel>
    </Tabs>
  )
}
