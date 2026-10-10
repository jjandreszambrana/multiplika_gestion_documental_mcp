import {
  Alert,
  Button,
  Checkbox,
  Group,
  Stack,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_PaginationState,
} from 'mantine-react-table'
import { useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { listarPlan, type CuentaPlan } from '../../api/plan'
import { alcanza } from '../../api/sesion'
import { expandirCuenta } from '../../lib/cuenta'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { opcionesDeTabla } from '../../components/tabla'
import { columnasDelPlan } from './columnas'
import DialogoAccionCuenta, { type Accion } from './DialogoAccionCuenta'
import DialogoEditarCuenta from './DialogoEditarCuenta'
import DialogoNuevaMayor from './DialogoNuevaMayor'
import DialogoNuevaSubcuenta from './DialogoNuevaSubcuenta'
import AvisoDeAuxiliares from './AvisoDeAuxiliares'

interface Props {
  ejercicio: number | null
  nivel: string
  /** Dígitos de una cuenta de apuntes. Viene de la configuración de la empresa. */
  ancho: number
}

const ESPERA_TECLEO_MS = 300
const FILAS_POR_PAGINA = 50

export default function PantallaPlan({ ejercicio, nivel, ancho }: Props) {
  const [texto, setTexto] = useState('')
  const [textoAplicado] = useDebouncedValue(texto, ESPERA_TECLEO_MS)
  const [soloAuxiliares, setSoloAuxiliares] = useState(false)
  const [incluirApartadas, setIncluirApartadas] = useState(false)
  const [paginacion, setPaginacion] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: FILAS_POR_PAGINA,
  })

  const [creandoSubcuenta, setCreandoSubcuenta] = useState(false)
  const [creandoMayor, setCreandoMayor] = useState(false)
  const [editando, setEditando] = useState<CuentaPlan | null>(null)
  const [aConfirmar, setAConfirmar] = useState<{ cuenta: CuentaPlan; accion: Accion } | null>(null)
  const [recarga, setRecarga] = useState(0)

  const [cuentas, setCuentas] = useState<CuentaPlan[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mantiene = alcanza(nivel, 'cierre')
  const plan = usePlanEnMemoria()

  // Al cambiar el filtro se vuelve a la primera página: si no, se pide un
  // offset que ya no existe y sale una tabla vacía sin motivo.
  function desdeLaPrimeraPagina() {
    setPaginacion((p) => ({ ...p, pageIndex: 0 }))
  }

  // Tras tocar el plan hay que rehacer las dos cosas: el listado que se ve y
  // la copia en memoria de la que salen los escalones al teclear una cuenta.
  function recargar() {
    setRecarga((n) => n + 1)
    plan.refrescar()
  }

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)

    listarPlan({
      ejercicio,
      texto: textoAplicado,
      soloAuxiliares,
      incluirApartadas,
      offset: paginacion.pageIndex * paginacion.pageSize,
      limit: paginacion.pageSize,
    })
      .then((respuesta) => {
        if (!vigente) return
        setCuentas(respuesta.cuentas ?? [])
        setTotal(respuesta.total)
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
  }, [
    ejercicio,
    textoAplicado,
    soloAuxiliares,
    incluirApartadas,
    paginacion.pageIndex,
    paginacion.pageSize,
    recarga,
  ])

  const columnas = useMemo(
    () =>
      columnasDelPlan(
        mantiene
          ? {
              alEditar: setEditando,
              alPedirAccion: (cuenta, accion) => setAConfirmar({ cuenta, accion }),
            }
          : null,
        ancho,
      ),
    [mantiene, ancho],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<CuentaPlan>(),
    columns: columnas,
    data: cuentas,
    localization: { noRecordsToDisplay: 'Ninguna cuenta coincide con la búsqueda' },
    manualPagination: true,
    rowCount: total,
    onPaginationChange: setPaginacion,
    state: { pagination: paginacion, isLoading: cargando, showAlertBanner: error !== null },
    mantineToolbarAlertBannerProps: error ? { color: 'red', children: error } : undefined,
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Plan contable</Title>
        <Group gap="sm">
          {mantiene && (
            <Button variant="default" onClick={() => setCreandoMayor(true)}>
              Nuevo grupo o cuenta de mayor…
            </Button>
          )}
          {alcanza(nivel, 'apuntes') && (
            <Button onClick={() => setCreandoSubcuenta(true)}>Nueva subcuenta…</Button>
          )}
        </Group>
      </Group>

      {ejercicio === null && (
        <Alert color="yellow">
          No hay ejercicio seleccionado: se muestra el plan de la configuración de la empresa.
        </Alert>
      )}

      <AvisoDeAuxiliares />

      <Group align="flex-end" gap="md">
        <TextInput
          label="Buscar por código o título"
          value={texto}
          onChange={(e) => {
            setTexto(e.currentTarget.value)
            desdeLaPrimeraPagina()
          }}
          onBlur={() => setTexto(expandirCuenta(texto, ancho))}
          description="El punto se rellena con ceros: 431.10 busca la 431000010"
          w={320}
          autoFocus
        />
        <Checkbox
          label="Solo subcuentas"
          checked={soloAuxiliares}
          onChange={(e) => {
            setSoloAuxiliares(e.currentTarget.checked)
            desdeLaPrimeraPagina()
          }}
          pb={8}
        />
        {mantiene && (
          <Checkbox
            label="Ver también las ocultas"
            checked={incluirApartadas}
            onChange={(e) => {
              setIncluirApartadas(e.currentTarget.checked)
              desdeLaPrimeraPagina()
            }}
            pb={8}
          />
        )}
      </Group>

      <MantineReactTable table={tabla} />

      <DialogoNuevaSubcuenta
        abierto={creandoSubcuenta}
        ejercicio={ejercicio}
        ancho={ancho}
        alCerrar={() => setCreandoSubcuenta(false)}
        alCreada={(cuenta) => {
          setCreandoSubcuenta(false)
          setTexto(cuenta.codigo)
          desdeLaPrimeraPagina()
          recargar()
        }}
      />

      <DialogoNuevaMayor
        abierto={creandoMayor}
        ejercicio={ejercicio}
        alCerrar={() => setCreandoMayor(false)}
        alCreada={(cuenta) => {
          setCreandoMayor(false)
          setTexto(cuenta.codigo)
          desdeLaPrimeraPagina()
          recargar()
        }}
      />

      <DialogoEditarCuenta
        cuenta={editando}
        ejercicio={ejercicio}
        alCerrar={() => setEditando(null)}
        alGuardada={() => {
          setEditando(null)
          recargar()
        }}
      />

      <DialogoAccionCuenta
        cuenta={aConfirmar?.cuenta ?? null}
        accion={aConfirmar?.accion ?? 'ocultar'}
        ejercicio={ejercicio}
        alCerrar={() => setAConfirmar(null)}
        alHecha={() => {
          setAConfirmar(null)
          recargar()
        }}
      />
    </Stack>
  )
}
