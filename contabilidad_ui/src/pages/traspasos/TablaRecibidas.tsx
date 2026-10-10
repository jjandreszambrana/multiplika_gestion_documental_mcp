import { Alert, Button, Group, Loader, Stack, Table, Text, Tooltip } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  listarFacturasSinAsiento,
  type EnlacePropuesto,
  type FacturaConCuentas,
} from '../../api/maestros'
import { alcanza } from '../../api/sesion'
import { aDecimal } from '../../lib/dinero'
import { formatearEntero, formatearFecha, formatearImporte } from '../../lib/format'
import DialogoDesdeFactura, { type FacturaConBien } from '../inmovilizado/DialogoDesdeFactura'
import DialogoCuentasDeFactura from './DialogoCuentasDeFactura'
import DialogoEnlazarTodo from './DialogoEnlazarTodo'
import { columnasDeCuentas, CeldaDeCuentas } from './cuentasEnColumnas'
import { partirEstado } from './estado'

/** Lo que se lee al posarse en la marca de traspaso. */
function porQueNoTraspasa(factura: {
  se_contabilizara: boolean
  motivo_frenada: string
}): string {
  if (factura.se_contabilizara) return 'Traspasa'
  return factura.motivo_frenada === '' ? 'No traspasa' : factura.motivo_frenada
}

interface Props {
  ejercicio: number
  periodo: string
  nivel: string
  ancho: number
  /** Para dar de alta una cuenta sin salir del diálogo del bien. */
  ejercicioDelPlan: number | null
  /** Cambia cuando el padre contabiliza, para volver a leer la lista. */
  refresco: number
  /** Cuántas de las que hay van a entrar si se contabiliza ahora. */
  alContar: (cuantas: number) => void
}

/**
 * Todas las facturas de compra que todavía no tienen asiento: las que van a
 * entrar y las que no. Cada fila dice en qué estado está en facturación, si
 * traspasa, y si le falta alguna cuenta.
 *
 * Es una sola tabla a propósito: tener aquí las que entran y en otra las que
 * no obliga a mirar en dos sitios para saber qué pasa con un mes.
 */
export default function TablaRecibidas({
  ejercicio,
  periodo,
  nivel,
  ancho,
  ejercicioDelPlan,
  refresco,
  alContar,
}: Props) {
  const [facturas, setFacturas] = useState<FacturaConCuentas[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<FacturaConCuentas | null>(null)
  const [enlazadas, setEnlazadas] = useState<string | null>(null)
  const [propuestos, setPropuestos] = useState<EnlacePropuesto[]>([])
  const [enlazandoTodo, setEnlazandoTodo] = useState(false)
  const [conBien, setConBien] = useState<FacturaConBien | null>(null)

  const traer = useCallback(() => {
    setCargando(true)
    listarFacturasSinAsiento({ ejercicio, periodo })
      .then((respuesta) => {
        setFacturas(respuesta.facturas ?? [])
        setPropuestos(respuesta.enlaces_propuestos ?? [])
        setError(null)
      })
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
      .finally(() => setCargando(false))
    // `refresco` no se usa dentro: está para volver a leer cuando el padre
    // contabiliza y las que entraron tienen que desaparecer de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicio, periodo, refresco])

  useEffect(traer, [traer])

  useEffect(() => {
    alContar(facturas.filter((f) => f.se_contabilizara).length)
  }, [facturas, alContar])

  if (error) {
    return (
      <Alert color="red" title="No se pudieron cargar las facturas pendientes" role="alert">
        {error}
      </Alert>
    )
  }

  if (cargando) return <Loader size="xs" />

  const columnas = columnasDeCuentas(facturas)

  return (
    <Stack gap="sm">
      {/* Lo que se puede enlazar de una vez, propuesto por el servidor sobre
          todo el filtro. Se propone; enlazar lo confirma el usuario. */}
      {propuestos.length > 0 && alcanza(nivel, 'cierre') && (
        <Alert color="blue">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              Hay {formatearEntero(propuestos.reduce((n, uno) => n + uno.cuantas, 0))} facturas
              que se pueden enlazar con su proveedor.
            </Text>
            <Button size="xs" variant="light" onClick={() => setEnlazandoTodo(true)}>
              Enlazar todo…
            </Button>
          </Group>
        </Alert>
      )}

      {enlazadas && (
        <Alert color="blue" withCloseButton onClose={() => setEnlazadas(null)}>
          {enlazadas}
        </Alert>
      )}

      {/* Mismo criterio que el resto de rejillas del programa: el scroll va en
          las filas y la cabecera se queda fija, para no perder de vista qué
          columna es cuál al bajar por un listado largo. */}
      <Table.ScrollContainer minWidth={1400} h="60vh" type="native">
        <Table withTableBorder striped fz="sm" stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={110}>Fecha</Table.Th>
              <Table.Th w={140}>Factura</Table.Th>
              <Table.Th>Proveedor</Table.Th>
              <Table.Th w={130}>Estado</Table.Th>
              <Table.Th w={80} ta="center">
                Traspaso
              </Table.Th>
              {columnas.map((columna) => (
                <Table.Th key={columna.columna} w={120}>
                  {columna.cabecera}
                </Table.Th>
              ))}
              <Table.Th w={120} ta="right">
                Total
              </Table.Th>
              <Table.Th w={150} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {facturas.map((factura) => (
              <Table.Tr key={factura.id_factura}>
                <Table.Td>{formatearFecha(factura.fecha_emision)}</Table.Td>
                <Table.Td>{factura.numero_factura}</Table.Td>
                {/* El NIF va debajo del nombre: se mira para desempatar dos
                    proveedores parecidos, no de corrido. */}
                <Table.Td>
                  {factura.proveedor}
                  <Text fz="xs" c="dimmed">
                    {factura.nif_proveedor}
                  </Text>
                </Table.Td>
                {/* El nombre del estado lo escribe el servidor: el vocabulario
                    es de facturación y cambia con ella. */}
                <Table.Td>
                  <Tooltip
                    label={partirEstado(factura.estado_nombre).explicacion}
                    disabled={partirEstado(factura.estado_nombre).explicacion === ''}
                    withArrow
                  >
                    <span>{partirEstado(factura.estado_nombre).nombre}</span>
                  </Tooltip>
                </Table.Td>
                {/* Si esa factura va a entrar en el traspaso o no. Lo decide el
                    servidor, porque depende del régimen de la empresa y no se
                    puede deducir del estado. */}
                {/* Cuando el traspaso ya la apartó, el motivo lo escribe el
                    servidor y se enseña tal cual: hay facturas que no entran
                    por lo que son, y ahí no hay ninguna cuenta que poner. */}
                <Table.Td ta="center">
                  <Tooltip label={porQueNoTraspasa(factura)} withArrow multiline maw={320}>
                    <span>{factura.se_contabilizara ? '✅' : '⛔'}</span>
                  </Tooltip>
                </Table.Td>
                {/* Una columna por cuenta, con la que se va a aplicar de
                    verdad: propia, heredada del proveedor o la de la
                    configuración. Lo resuelve el servidor. */}
                {columnas.map((columna) => (
                  <Table.Td key={columna.columna}>
                    <CeldaDeCuentas factura={factura} columna={columna.columna} />
                  </Table.Td>
                ))}
                <Table.Td ta="right" ff="monospace">
                  {formatearImporte(aDecimal(factura.importe_total))}
                </Table.Td>
                <Table.Td>
                  {alcanza(nivel, 'apuntes') && (
                    <Group gap="xs" wrap="nowrap">
                      <Button size="xs" variant="light" onClick={() => setEditando(factura)}>
                        Editar…
                      </Button>
                      {/* Lo dice la API con `pide_ficha_de_bien`, calculado con
                          la misma regla que el traspaso y antes de intentar
                          contabilizar. Aquí no se interpreta ningún motivo. */}
                      {factura.pide_ficha_de_bien && (
                        <Button
                          size="xs"
                          onClick={() =>
                            setConBien({
                              id_factura: factura.id_factura,
                              numero_factura: factura.numero_factura,
                              proveedor: factura.proveedor,
                              importe: formatearImporte(aDecimal(factura.importe_total)),
                              cuenta_de_inmovilizado: factura.cuenta_de_inmovilizado,
                            })
                          }
                        >
                          Crear la ficha del bien…
                        </Button>
                      )}
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Text size="sm" c="dimmed">
        {formatearEntero(facturas.length)} facturas
      </Text>

      <DialogoEnlazarTodo
        abierto={enlazandoTodo}
        propuestos={propuestos}
        facturaDe={(nif) =>
          facturas.find((f) => f.nif_proveedor === nif && f.id_emisor === null)?.id_factura ?? null
        }
        alCerrar={() => setEnlazandoTodo(false)}
        alHecho={(cuantas) => {
          setEnlazandoTodo(false)
          setEnlazadas(`Enlazadas ${formatearEntero(cuantas)} facturas.`)
          traer()
        }}
      />

      <DialogoDesdeFactura
        factura={conBien}
        ancho={ancho}
        ejercicio={ejercicioDelPlan}
        alCerrar={() => setConBien(null)}
        alHecho={(mensaje) => {
          setConBien(null)
          setEnlazadas(mensaje)
          traer()
        }}
      />

      <DialogoCuentasDeFactura
        factura={editando}
        ancho={ancho}
        puedeEnlazar={alcanza(nivel, 'cierre')}
        alEnlazado={(cuantas, proveedor) => {
          setEditando(null)
          setEnlazadas(`Enlazadas ${formatearEntero(cuantas)} facturas de ${proveedor}.`)
          traer()
        }}
        alCerrar={() => setEditando(null)}
        alGuardada={() => {
          setEditando(null)
          traer()
        }}
      />
    </Stack>
  )
}
