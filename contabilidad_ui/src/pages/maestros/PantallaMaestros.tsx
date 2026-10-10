import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { listarFichas, listarMaestros, type Ficha, type Maestro } from '../../api/maestros'
import { alcanza } from '../../api/sesion'
import { useCuadre } from '../../components/CuadreEnMemoria'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import CuentaDeFichaCelda from './CuentaDeFichaCelda'
import DialogoCrearCuentas from './DialogoCrearCuentas'
import DialogoCuentasDeFicha from './DialogoCuentasDeFicha'
import { accionDe, queEsDe } from './textos'

interface Props {
  nivel: string
  ancho: number
}

const ESPERA_TECLEO_MS = 300
const POR_PAGINA = 100

/**
 * Lo que se le dice al contable cuando la cuenta que acaba de escribir ha
 * quedado además asignada al cliente o al proveedor en la contabilidad. Es la
 * diferencia entre haber rellenado una ficha y haber dejado el tercero listo
 * para contabilizar, y conviene verla sin volver a abrir nada.
 */
function avisoDeAsignada(cuentas: string[], etiqueta: string): string | null {
  if (cuentas.length === 0) return null
  if (cuentas.length === 1) {
    return `La cuenta ${cuentas[0]} queda asignada a ${etiqueta}. Sus facturas se contabilizarán en ella.`
  }
  return `Las cuentas ${cuentas.join(' y ')} quedan asignadas a ${etiqueta}. Sus facturas se contabilizarán en ellas.`
}

/**
 * Las cuentas contables que llevan escritas las fichas de facturación: la de
 * gasto de cada proveedor, la de ventas de cada serie, las de cada tipo de IVA.
 * Sin ellas, sus facturas no se pueden contabilizar.
 */
export default function PantallaMaestros({ nivel, ancho }: Props) {
  const plan = usePlanEnMemoria()
  const cuadre = useCuadre()
  const [creandoCuentas, setCreandoCuentas] = useState(false)
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [elegido, setElegido] = useState<string | null>(null)
  const [errorMaestros, setErrorMaestros] = useState<string | null>(null)

  const [buscar, setBuscar] = useState('')
  const [buscarAplicado] = useDebouncedValue(buscar, ESPERA_TECLEO_MS)
  const [soloSinCuenta, setSoloSinCuenta] = useState(true)

  const [fichas, setFichas] = useState<Ficha[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<Ficha | null>(null)
  const [asignada, setAsignada] = useState<string | null>(null)

  const maestro = maestros.find((m) => m.familia === elegido) ?? null
  const campos = maestro?.campos ?? []
  const puedeEditar = alcanza(nivel, 'cierre')

  useEffect(() => {
    listarMaestros()
      .then((respuesta) => {
        const lista = respuesta.familias ?? []
        setMaestros(lista)
        setElegido((antes) => antes ?? lista[0]?.familia ?? null)
      })
      .catch((fallo: unknown) => setErrorMaestros(textoDeError(fallo)))
  }, [])

  useEffect(() => {
    if (elegido === null) return
    let vigente = true
    setCargando(true)
    setError(null)
    setAsignada(null)

    listarFichas({
      familia: elegido,
      buscar: buscarAplicado,
      soloSinCuenta,
      pagina: 1,
      porPagina: POR_PAGINA,
    })
      .then((respuesta) => {
        if (!vigente) return
        setFichas(respuesta.fichas ?? [])
        setTotal(respuesta.total)
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
  }, [elegido, buscarAplicado, soloSinCuenta])

  const columnas = useMemo<MRT_ColumnDef<Ficha>[]>(() => {
    const fijas: MRT_ColumnDef<Ficha>[] = [
      {
        accessorKey: 'etiqueta',
        header: maestro?.titulo ?? 'Ficha',
        grow: true,
        mantineTableBodyCellProps: CELDA_QUE_CRECE,
        Cell: ({ row }) => (
          <Stack gap={0}>
            <Text fz="sm">{row.original.etiqueta}</Text>
            {row.original.detalle !== '' && (
              <Text fz="xs" c="dimmed">
                {row.original.referencia !== '' && `${row.original.referencia} · `}
                {row.original.detalle}
              </Text>
            )}
          </Stack>
        ),
      },
    ]

    const deCuentas: MRT_ColumnDef<Ficha>[] = campos.map((campo) => ({
      id: campo.campo,
      header: campo.titulo,
      size: 200,
      grow: false,
      Cell: ({ row }) => {
        const cuenta = (row.original.cuentas ?? []).find((c) => c.campo === campo.campo)
        return cuenta ? <CuentaDeFichaCelda cuenta={cuenta} /> : null
      },
    }))

    if (!puedeEditar) return [...fijas, ...deCuentas]

    return [
      ...fijas,
      ...deCuentas,
      {
        id: 'acciones',
        header: '',
        size: 90,
        grow: false,
        Cell: ({ row }) => (
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => {
              setAsignada(null)
              setEditando(row.original)
            }}
          >
            {accionDe(elegido ?? '')}
          </Button>
        ),
      },
    ]
  }, [campos, maestro, puedeEditar, elegido])

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<Ficha>(),
    columns: columnas,
    data: fichas,
    localization: {
      noRecordsToDisplay: soloSinCuenta
        ? 'Todas las fichas tienen sus cuentas asignadas'
        : 'Ninguna ficha coincide con la búsqueda',
    },
    state: { isLoading: cargando, showAlertBanner: error !== null },
    mantineToolbarAlertBannerProps: error ? { color: 'red', children: error } : undefined,
  })

  return (
    <Stack gap="md">
      {errorMaestros && (
        <Alert color="red" title="No se pudo cargar">
          {errorMaestros}
        </Alert>
      )}

      {asignada && (
        <Alert color="green" p="xs" withCloseButton onClose={() => setAsignada(null)}>
          <Text size="sm">{asignada}</Text>
        </Alert>
      )}

      <Text size="sm" c="dimmed">
        Para contabilizar correctamente los movimientos de gestión, las cuentas contables deben
        estar asignadas y sincronizadas. Puede gestionarlo desde aquí
      </Text>

      {(cuadre.revision?.cuantas_faltan ?? 0) > 0 && (
        <Alert color="yellow" p="xs">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              {cuadre.revision?.cuantas_faltan} cuentas relacionadas con la facturación no existen
              en el plan contable. Es necesario crearlas para que se puedan contabilizar.
            </Text>
            {puedeEditar && (
              <Button size="xs" onClick={() => setCreandoCuentas(true)}>
                Actualizar…
              </Button>
            )}
          </Group>
        </Alert>
      )}

      {maestros.length === 0 && !errorMaestros && <Loader size="sm" />}

      {maestros.length > 0 && (
        <>
          <Group align="flex-end" gap="md">
            <Select
              label="Fichas de"
              data={maestros.map((m) => ({ value: m.familia, label: m.titulo }))}
              value={elegido}
              onChange={setElegido}
              allowDeselect={false}
              w={240}
            />
            <TextInput
              label="Buscar"
              placeholder="Nombre, código o NIF"
              value={buscar}
              onChange={(e) => setBuscar(e.currentTarget.value)}
              w={280}
            />
            <Checkbox
              label="Solo las que tienen alguna cuenta sin asignar"
              checked={soloSinCuenta}
              onChange={(e) => setSoloSinCuenta(e.currentTarget.checked)}
              pb={8}
            />
          </Group>

          {maestro && (
            <Alert color={campos.some((c) => c.usa_el_motor) ? 'blue' : 'gray'} p="xs">
              <Text size="sm">{queEsDe(maestro.familia, maestro.que_es)}</Text>
              {!campos.some((c) => c.usa_el_motor) && (
                <Text size="sm" mt={4}>
                  Estas cuentas todavía no intervienen en la contabilización: asignarlas no modifica
                  ningún asiento.
                </Text>
              )}
            </Alert>
          )}

          <Text size="sm">
            {total} fichas{soloSinCuenta && ' con alguna cuenta sin asignar'}.
            {total > POR_PAGINA && ` Se muestran las ${POR_PAGINA} primeras.`}
          </Text>

          <MantineReactTable table={tabla} />
        </>
      )}

      <DialogoCrearCuentas
        abierto={creandoCuentas}
        maestros={cuadre.revision?.familias ?? []}
        alCerrar={() => setCreandoCuentas(false)}
        alCreadas={() => {
          setCreandoCuentas(false)
          cuadre.refrescar()
          plan.refrescar()
        }}
      />

      <DialogoCuentasDeFicha
        idMaestro={elegido ?? ''}
        campos={campos}
        ficha={editando}
        ancho={ancho}
        alCerrar={() => setEditando(null)}
        alGuardada={(guardada, enlazadas) => {
          setEditando(null)
          setFichas((antes) => antes.map((f) => (f.id_ficha === guardada.id_ficha ? guardada : f)))
          setAsignada(avisoDeAsignada(enlazadas, guardada.etiqueta))
          // Puede haber dado de alta cuentas nuevas en el plan.
          plan.refrescar()
        }}
      />
    </Stack>
  )
}
