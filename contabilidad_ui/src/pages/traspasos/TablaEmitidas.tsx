import { Alert, Button, Group, Loader, Stack, Table, Text, Tooltip } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  listarFacturasEmitidasSinAsiento,
  listarMaestros,
  obtenerFicha,
  type CampoDeCuenta,
  type CuentaDeFicha,
  type EnlacePropuesto,
  type FacturaEmitidaConCuentas,
  type Ficha,
} from '../../api/maestros'
import { alcanza } from '../../api/sesion'
import { aDecimal } from '../../lib/dinero'
import { formatearEntero, formatearFecha, formatearImporte } from '../../lib/format'
import DialogoCuentasDeFicha from '../maestros/DialogoCuentasDeFicha'
import DialogoEnlazarCliente from './DialogoEnlazarCliente'
import DialogoEnlazarTodosLosClientes from './DialogoEnlazarTodosLosClientes'
import { CeldaDeCuentas, columnasDeCuentas } from './cuentasEnColumnas'
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
  /** Cambia cuando el padre contabiliza, para volver a leer la lista. */
  refresco: number
  /** Cuántas de las que hay van a entrar si se contabiliza ahora. */
  alContar: (cuantas: number) => void
}

/**
 * Todas las facturas de venta que todavía no tienen asiento, con las cuentas
 * que va a usar cada una: la del cliente, la de ventas de su serie, una por
 * cada tipo de IVA, el recargo y la retención.
 *
 * Aquí una cuenta no se pone en la factura: se pone en la ficha de donde sale.
 * Por eso el aviso de la que falta se pulsa y abre esa ficha, en vez de un
 * formulario propio como en las recibidas.
 */
export default function TablaEmitidas({
  ejercicio,
  periodo,
  nivel,
  ancho,
  refresco,
  alContar,
}: Props) {
  const [facturas, setFacturas] = useState<FacturaEmitidaConCuentas[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [arreglando, setArreglando] = useState<{ familia: string; ficha: Ficha } | null>(null)
  const [campos, setCampos] = useState<Record<string, CampoDeCuenta[]>>({})
  const [errorFicha, setErrorFicha] = useState<string | null>(null)
  const [enlazando, setEnlazando] = useState<FacturaEmitidaConCuentas | null>(null)
  const [enlazandoTodo, setEnlazandoTodo] = useState(false)
  const [enlazadas, setEnlazadas] = useState<string | null>(null)
  const [propuestos, setPropuestos] = useState<EnlacePropuesto[]>([])

  const traer = useCallback(() => {
    setCargando(true)
    listarFacturasEmitidasSinAsiento({ ejercicio, periodo })
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

  // Los campos de cada maestro no cambian por empresa: se piden una vez y
  // sirven para abrir la ficha que haga falta.
  useEffect(() => {
    listarMaestros()
      .then((respuesta) => {
        const porFamilia: Record<string, CampoDeCuenta[]> = {}
        for (const maestro of respuesta.familias ?? []) porFamilia[maestro.familia] = maestro.campos ?? []
        setCampos(porFamilia)
      })
      .catch((fallo: unknown) => setErrorFicha(textoDeError(fallo)))
  }, [])

  useEffect(() => {
    alContar(facturas.filter((f) => f.se_contabilizara).length)
  }, [facturas, alContar])

  /**
   * El aviso de una cuenta que falta lleva a donde se pone: la ficha de la que
   * sale, o el enlace del cliente cuando la factura no apunta a ninguna.
   */
  function arreglar(factura: FacturaEmitidaConCuentas, cuenta: CuentaDeFicha) {
    if (cuenta.familia === 'receptores' && (factura.id_receptor ?? null) === null) {
      setEnlazando(factura)
      return
    }
    if (cuenta.id_ficha === null || cuenta.id_ficha === undefined) return
    setErrorFicha(null)
    obtenerFicha(cuenta.familia, cuenta.id_ficha)
      .then((ficha) => setArreglando({ familia: cuenta.familia, ficha }))
      .catch((fallo: unknown) => setErrorFicha(textoDeError(fallo)))
  }

  if (error) {
    return (
      <Alert color="red" title="No se pudieron cargar las facturas pendientes" role="alert">
        {error}
      </Alert>
    )
  }

  if (cargando) return <Loader size="xs" />

  const columnas = columnasDeCuentas(facturas)
  const puedeArreglar = alcanza(nivel, 'cierre')

  return (
    <Stack gap="sm">
      {/* Lo que se puede enlazar de una vez, propuesto por el servidor sobre
          todo el filtro. Se propone; enlazar lo confirma el usuario. */}
      {propuestos.length > 0 && puedeArreglar && (
        <Alert color="blue">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              Hay {formatearEntero(propuestos.reduce((n, uno) => n + uno.cuantas, 0))} facturas
              que se pueden enlazar con su cliente.
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

      {errorFicha && (
        <Alert color="red" role="alert" withCloseButton onClose={() => setErrorFicha(null)}>
          {errorFicha}
        </Alert>
      )}

      {/* Mismo criterio que el resto de rejillas del programa: el scroll va en
          las filas y la cabecera se queda fija. */}
      <Table.ScrollContainer minWidth={1400} h="60vh" type="native">
        <Table withTableBorder striped fz="sm" stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={110}>Fecha</Table.Th>
              <Table.Th w={140}>Factura</Table.Th>
              <Table.Th>Cliente</Table.Th>
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
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {facturas.map((factura) => (
              <Table.Tr key={factura.id_factura}>
                <Table.Td>{formatearFecha(factura.fecha_emision)}</Table.Td>
                <Table.Td>{factura.numero_factura}</Table.Td>
                {/* El NIF va debajo del nombre: se mira para desempatar dos
                    clientes parecidos, no de corrido. */}
                <Table.Td>
                  {factura.cliente}
                  <Text fz="xs" c="dimmed">
                    {factura.nif_cliente}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Tooltip
                    label={partirEstado(factura.estado_nombre).explicacion}
                    disabled={partirEstado(factura.estado_nombre).explicacion === ''}
                    withArrow
                  >
                    <span>{partirEstado(factura.estado_nombre).nombre}</span>
                  </Tooltip>
                </Table.Td>
                {/* Cuando el traspaso ya la apartó, el motivo lo escribe el
                    servidor y se enseña tal cual: hay facturas que no entran
                    por lo que son, y ahí no hay ninguna cuenta que poner. */}
                <Table.Td ta="center">
                  <Tooltip label={porQueNoTraspasa(factura)} withArrow multiline maw={320}>
                    <span>{factura.se_contabilizara ? '✅' : '⛔'}</span>
                  </Tooltip>
                </Table.Td>
                {columnas.map((columna) => (
                  <Table.Td key={columna.columna}>
                    <CeldaDeCuentas
                      factura={factura}
                      columna={columna.columna}
                      alArreglar={
                        puedeArreglar ? (cuenta) => arreglar(factura, cuenta) : undefined
                      }
                    />
                  </Table.Td>
                ))}
                <Table.Td ta="right" ff="monospace">
                  {formatearImporte(aDecimal(factura.importe_total))}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Text size="sm" c="dimmed">
        {formatearEntero(facturas.length)} facturas
      </Text>

      <DialogoEnlazarTodosLosClientes
        abierto={enlazandoTodo}
        propuestos={propuestos}
        facturaDe={(nif) =>
          facturas.find((f) => f.nif_cliente === nif && (f.id_receptor ?? null) === null)?.id_factura ??
          null
        }
        alCerrar={() => setEnlazandoTodo(false)}
        alHecho={(cuantas) => {
          setEnlazandoTodo(false)
          setEnlazadas(`Enlazadas ${formatearEntero(cuantas)} facturas.`)
          traer()
        }}
      />

      <DialogoEnlazarCliente
        factura={enlazando}
        alCerrar={() => setEnlazando(null)}
        alEnlazado={(cuantas, cliente) => {
          setEnlazando(null)
          setEnlazadas(`Enlazadas ${formatearEntero(cuantas)} facturas de ${cliente}.`)
          traer()
        }}
      />

      <DialogoCuentasDeFicha
        idMaestro={arreglando?.familia ?? ''}
        campos={arreglando === null ? [] : (campos[arreglando.familia] ?? [])}
        ficha={arreglando?.ficha ?? null}
        ancho={ancho}
        alCerrar={() => setArreglando(null)}
        alGuardada={() => {
          setArreglando(null)
          traer()
        }}
      />
    </Stack>
  )
}
