import {
  Alert,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import type Decimal from 'decimal.js'
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { diarioBEntero, equivalenciasEnteras } from '../../api/diarioB'
import { planEntero } from '../../api/plan'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import type { NivelDeBalance } from '../../api/informes'
import { CasillaFecha } from '../../components/CasillaFecha'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { CELDA_QUE_CRECE, opcionesDeTabla } from '../../components/tabla'
import { fechaParaApi } from '../../lib/fecha'
import { formatearEntero, formatearImporte } from '../../lib/format'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import DialogoAsignarEquivalencia from './DialogoAsignarEquivalencia'
import DialogoOpcionesSumas, {
  normalizarOpciones,
  type OpcionesSumas,
} from './DialogoOpcionesSumas'
import {
  busquedaInicial,
  claveSubcuenta,
  quitarSinSaldo,
  sumarDiarioB,
  type ImportesDiarioB,
  type SumaDeCuenta,
  type SumasDiarioB,
} from './sumasDiarioB'

interface Props {
  ejercicio: number | null
  /** Asignar equivalencias desde aquí pide nivel `cierre`, como en su pestaña. */
  nivel: string
  /** Usuario y empresa, para recordar las opciones. */
  quienGuarda: string
}

const PREFERENCIA_OPCIONES = 'diario_b.sumas.opciones'

/** Lo que se está viendo, que no cambia mientras se retoca el filtro. */
interface Consulta extends OpcionesSumas {
  ejercicio: number
  desde: string
  hasta: string
  cuentaDesde: string
  cuentaHasta: string
  ver: string
  nivel: NivelDeBalance
}

/** Los mismos que en sumas y saldos. Aquí entra por subcuenta, que es el detalle. */
const NIVELES = [
  { value: '1', label: 'Grupo' },
  { value: '2', label: 'Subgrupo' },
  { value: '3', label: 'Cuenta de mayor' },
  { value: '0', label: 'Subcuenta' },
]

const VER = [
  { value: 'todas', label: 'Todas' },
  { value: '1', label: 'Del libro' },
  { value: '0', label: 'Borradores' },
]

/** Los importes pegados a la derecha y en monospace, como en sumas y saldos. */
const A_LA_DERECHA = {
  mantineTableHeadCellProps: { style: { justifyContent: 'flex-end' } },
  mantineTableBodyCellProps: {
    fz: 'sm',
    py: 4,
    ff: 'monospace',
    style: { justifyContent: 'flex-end' },
  },
  mantineTableFooterCellProps: { ff: 'monospace', style: { justifyContent: 'flex-end' } },
} as const

function columnaDeImporte(
  id: keyof ImportesDiarioB,
  cabecera: string,
  total: ImportesDiarioB | null,
): MRT_ColumnDef<SumaDeCuenta> {
  return {
    id,
    header: cabecera,
    size: 130,
    grow: false,
    ...A_LA_DERECHA,
    Cell: ({ row }) => <ImporteOVacio valor={row.original[id]} />,
    Footer: () => (total ? <ImporteOVacio valor={total[id]} conCero /> : ''),
  }
}

/** En blanco si es cero; en rojo si es negativo, que solo pasa en el saldo inicial. */
function ImporteOVacio({ valor, conCero = false }: { valor: Decimal; conCero?: boolean }) {
  if (valor.isZero() && !conCero) return null
  return (
    <Text fz="sm" ff="monospace" c={valor.isNegative() && !valor.isZero() ? 'red' : undefined}>
      {formatearImporte(valor)}
    </Text>
  )
}

/**
 * La promesa sin que su fallo tumbe el resto: devuelve el error en vez de
 * lanzarlo. Lo que se corta al cambiar de consulta sí se sigue lanzando.
 */
function sinRomper<T>(promesa: Promise<T>): Promise<T | Error> {
  return promesa.catch((fallo: unknown) => {
    if (esAbortada(fallo)) throw fallo
    return fallo instanceof Error ? fallo : new Error(textoDeError(fallo))
  })
}

/**
 * Sumas y saldos del diario B, cuenta a cuenta. El SIF no lo da hecho, así que
 * se traen todas las líneas del filtro y se suman aquí (ver `sumarDiarioB`).
 */

export default function SumasSaldosDiarioB({ ejercicio, nivel: nivelDeAcceso, quienGuarda }: Props) {
  const puedeAsignar = alcanza(nivelDeAcceso, 'cierre')
  // La fila a la que se está asignando equivalencia; nula, diálogo cerrado.
  const [asignando, setAsignando] = useState<SumaDeCuenta | null>(null)
  const plan = usePlanEnMemoria()
  const [desde, setDesde] = useState<Date | null>(null)
  const [hasta, setHasta] = useState<Date | null>(null)
  const [cuentaDesde, setCuentaDesde] = useState('')
  const [cuentaHasta, setCuentaHasta] = useState('')
  const [ver, setVer] = useState('todas')
  const [nivel, setNivel] = useState<NivelDeBalance>(0)
  const [opciones, setOpciones] = useState<OpcionesSumas>(() =>
    normalizarOpciones(leerPreferencia<unknown>(quienGuarda, PREFERENCIA_OPCIONES)),
  )
  const [viendoOpciones, setViendoOpciones] = useState(false)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [sumas, setSumas] = useState<SumasDiarioB | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Si no se pudieron traer el plan o las equivalencias para las descripciones. */
  const [avisoDescripciones, setAvisoDescripciones] = useState<string | null>(null)

  useEffect(() => {
    if (consulta === null) return
    const corte = new AbortController()
    setCargando(true)
    setError(null)
    Promise.all([
      diarioBEntero(
        {
          ejercicio: consulta.ejercicio,
          asiento: null,
          cuenta: '',
          // El ejercicio entero: lo anterior a «desde» hace falta para el saldo
          // inicial, y las fechas se separan al sumar.
          fecha_desde: '',
          fecha_hasta: '',
          contabilizado: consulta.ver === 'todas' ? null : Number(consulta.ver),
        },
        corte.signal,
      ),
      // Siempre: de ellas salen la cuenta equivalente de cada fila y su título
      // de origen. Solo son imprescindibles para «Solo cuentas sin
      // equivalencia»; si no, que fallen deja el balance sin esas columnas.
      consulta.soloSinEquivalencia
        ? equivalenciasEnteras(corte.signal)
        : sinRomper(equivalenciasEnteras(corte.signal)),
      // El plan entero del SIF, para las descripciones. El de memoria deja fuera
      // las cuentas ocultas y retiradas. Si falla, el balance sale igual.
      sinRomper(planEntero(consulta.ejercicio)),
    ])
      .then(([lineas, equivalencias, planCompleto]) => {
        const fallos = [equivalencias, planCompleto].filter((x) => x instanceof Error)
        setAvisoDescripciones(fallos.length > 0 ? textoDeError(fallos[0]) : null)
        const cuentasPlan = Array.isArray(planCompleto) ? planCompleto : []
        const lista = Array.isArray(equivalencias) ? equivalencias : null
        const titulos = new Map(cuentasPlan.map((c) => [c.codigo, c.descripcion ?? '']))
        // El diario B puede traer las subcuentas con otra longitud que el plan
        // (10000001 frente a 100000001): se casan por cuenta de mayor + número.
        const porNumero = new Map(
          cuentasPlan
            .filter((c) => /^\d{6,}$/.test(c.codigo))
            .map((c) => [claveSubcuenta(c.codigo), c.descripcion ?? '']),
        )
        const tituloDelPlan = (codigo: string) =>
          titulos.get(codigo) ||
          (/^\d{6,}$/.test(codigo) ? porNumero.get(claveSubcuenta(codigo)) : undefined) ||
          // Sin el plan entero, al menos el que ya está en memoria.
          plan.porCodigo.get(codigo)?.descripcion
        setSumas(
          sumarDiarioB(lineas, {
            soloSinEquivalencia: consulta.soloSinEquivalencia ? lista : null,
            todasLasEquivalencias: lista,
            tituloDelPlan,
            nivel: consulta.nivel,
            desde: consulta.desde,
            hasta: consulta.hasta,
            cuentaDesde: consulta.cuentaDesde,
            cuentaHasta: consulta.cuentaHasta,
            sinRegularizacion: consulta.sinRegularizacion,
          }),
        )
        setCargando(false)
      })
      .catch((fallo: unknown) => {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setSumas(null)
        setCargando(false)
      })
    return () => corte.abort()
    // El plan no entra: si llega más tarde, los títulos se ponen al volver a pulsar Ver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta])

  function verSumas() {
    if (ejercicio === null) return
    setConsulta({
      ejercicio,
      desde: fechaParaApi(desde),
      hasta: fechaParaApi(hasta),
      cuentaDesde: cuentaDesde.trim(),
      cuentaHasta: cuentaHasta.trim(),
      ver,
      nivel,
      ...opciones,
    })
  }

  function aplicarOpciones(nuevas: OpcionesSumas) {
    setViendoOpciones(false)
    setOpciones(nuevas)
    guardarPreferencia(quienGuarda, PREFERENCIA_OPCIONES, nuevas)
    // Si ya hay algo calculado, se rehace con las opciones nuevas.
    setConsulta((actual) => (actual === null ? null : { ...actual, ...nuevas }))
  }

  // Ocultar las cuentas sin saldo solo quita filas: los totales siguen siendo
  // los de todas las líneas que entran, para que debe y haber cuadren.
  const filas = useMemo(
    () =>
      sumas && consulta?.ocultarSinSaldo ? quitarSinSaldo(sumas.cuentas) : (sumas?.cuentas ?? []),
    [sumas, consulta?.ocultarSinSaldo],
  )
  const ocultas = (sumas?.cuentas.length ?? 0) - filas.length

  const total = sumas?.total ?? null
  // Por subcuenta cada fila es una cuenta del diario B y lleva al lado su
  // equivalente; agrupando no hay equivalencia de fila.
  const porSubcuenta = consulta !== null && consulta.nivel === 0
  // Las del principio van en un grupo sin cabecera: así la fila de cabeceras
  // de grupo no deja en el pie una segunda fila vacía.
  const columnas = useMemo<MRT_ColumnDef<SumaDeCuenta>[]>(
    () => [
      {
        id: 'cuenta_y_descripcion',
        header: '',
        columns: [
          {
            accessorKey: 'cuenta',
            header: porSubcuenta ? 'Cuenta origen' : 'Cuenta',
            size: 130,
            grow: false,
            Cell: ({ row }) => (
              <Text fz="sm" ff="monospace" fw={500}>
                {row.original.cuenta}
              </Text>
            ),
            Footer: () => 'Totales',
          },
          {
            accessorKey: 'titulo',
            header: 'Descripción',
            grow: true,
            mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
          },
          // Siempre definidas y escondidas cuando no tocan: si se añadieran
          // después, la tabla las pondría al final, detrás de los importes.
          ...[
                {
                  id: 'equivalente',
                  header: 'Cuenta equivalente',
                  size: 140,
                  grow: false,
                  Cell: ({ row }: { row: { original: SumaDeCuenta } }) =>
                    row.original.equivalente !== '' ? (
                      <Text fz="sm" ff="monospace">
                        {row.original.equivalente}
                      </Text>
                    ) : puedeAsignar ? (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => setAsignando(row.original)}
                      >
                        Asignar…
                      </Button>
                    ) : null,
                } satisfies MRT_ColumnDef<SumaDeCuenta>,
                {
                  accessorKey: 'tituloEquivalente',
                  header: 'Descripción equivalente',
                  size: 220,
                  grow: false,
                  mantineTableBodyCellProps: { fz: 'sm', py: 4, ...CELDA_QUE_CRECE },
                } satisfies MRT_ColumnDef<SumaDeCuenta>,
              ],
        ],
      },
      {
        id: 'periodo',
        header: 'Periodo',
        mantineTableHeadCellProps: { style: { justifyContent: 'center' } },
        columns: [
          columnaDeImporte('inicial', 'Saldo inicial', total),
          columnaDeImporte('debe', 'Debe', total),
          columnaDeImporte('haber', 'Haber', total),
        ],
      },
      {
        id: 'acumulados',
        header: 'Acumulados',
        mantineTableHeadCellProps: { style: { justifyContent: 'center' } },
        columns: [
          columnaDeImporte('acumDebe', 'Debe', total),
          columnaDeImporte('acumHaber', 'Haber', total),
          columnaDeImporte('deudor', 'Saldo deudor', total),
          columnaDeImporte('acreedor', 'Saldo acreedor', total),
        ],
      },
    ],
    [total, porSubcuenta, puedeAsignar],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<SumaDeCuenta>(),
    columns: columnas,
    data: filas,
    getRowId: (fila) => fila.cuenta,
    enablePagination: false,
    enableBottomToolbar: false,
    enableStickyFooter: true,
    // Solo la primera vez: en una recarga las cuentas de antes se quedan puestas
    // hasta que llegan las nuevas, y así la tabla no parpadea.
    state: {
      isLoading: cargando && sumas === null,
      columnVisibility: { equivalente: porSubcuenta, tituloEquivalente: porSubcuenta },
    },
    localization: { noRecordsToDisplay: 'No hay movimientos con ese filtro.' },
  })

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="md" wrap="wrap">
        <Select
          label="Agrupar por"
          data={NIVELES}
          value={String(nivel)}
          onChange={(valor) => setNivel(Number(valor ?? 0) as NivelDeBalance)}
          allowDeselect={false}
          w={180}
        />
        <CasillaFecha
          label="Desde"
          value={desde}
          onChange={(valor) => setDesde(valor as Date | null)}
          clearable
          w={150}
        />
        <CasillaFecha
          label="Hasta"
          value={hasta}
          onChange={(valor) => setHasta(valor as Date | null)}
          clearable
          w={150}
        />
        <TextInput
          label="Cuenta desde"
          value={cuentaDesde}
          onChange={(e) => setCuentaDesde(e.currentTarget.value.replace(/\D/g, ''))}
          inputMode="numeric"
          w={120}
        />
        <TextInput
          label="Cuenta hasta"
          value={cuentaHasta}
          onChange={(e) => setCuentaHasta(e.currentTarget.value.replace(/\D/g, ''))}
          inputMode="numeric"
          w={120}
        />
        <Stack gap={2}>
          <Text fz="sm" fw={500}>
            Ver
          </Text>
          <SegmentedControl size="xs" value={ver} onChange={setVer} data={VER} />
        </Stack>
        <Button variant="default" onClick={() => setViendoOpciones(true)}>
          Opciones…
        </Button>
        <Button onClick={verSumas} disabled={ejercicio === null} loading={cargando}>
          Ver
        </Button>
      </Group>

      {error && (
        <Alert color="red" role="alert" title="No se pudieron calcular las sumas y saldos">
          {error}
        </Alert>
      )}

      {avisoDescripciones && !error && (
        <Alert color="yellow" role="alert">
          {`Puede faltar alguna descripción: ${avisoDescripciones}`}
        </Alert>
      )}

      {consulta === null && !error && (
        <Text size="sm" c="dimmed">
          {ejercicio === null
            ? 'Elige un ejercicio arriba.'
            : `Ejercicio ${ejercicio}. Elige el filtro y pulsa Ver.`}
        </Text>
      )}

      {consulta !== null && !error && <MantineReactTable table={tabla} />}

      {sumas !== null && !error && (
        <Group gap="xl" wrap="wrap">
          <Text size="sm" c="dimmed">
            {`${formatearEntero(filas.length)} cuentas`}
          </Text>
          {ocultas > 0 && (
            <Text size="xs" c="dimmed">
              {`${formatearEntero(ocultas)} cuentas sin saldo ocultas. Los totales las incluyen.`}
            </Text>
          )}
          {cargando && <Loader size="xs" />}
        </Group>
      )}

      {asignando !== null && (
        <DialogoAsignarEquivalencia
          ejercicio={ejercicio}
          origen={{ cuenta: asignando.original, titulo: asignando.titulo }}
          busqueda={busquedaInicial(asignando, plan.porCodigo.keys())}
          alCerrar={() => setAsignando(null)}
          alCrear={() => {
            setAsignando(null)
            // Se rehace el balance: la fila pasa a sumarse en su destino.
            setConsulta((actual) => (actual === null ? null : { ...actual }))
          }}
        />
      )}

      <DialogoOpcionesSumas
        abierto={viendoOpciones}
        opciones={opciones}
        alAplicar={aplicarOpciones}
      />
    </Stack>
  )
}
