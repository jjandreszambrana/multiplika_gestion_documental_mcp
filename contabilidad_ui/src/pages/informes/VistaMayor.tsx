import { ActionIcon, Alert, Checkbox, Group, Loader, Stack, Text, Tooltip } from '@mantine/core'
import { IconFileSpreadsheet, IconPencil } from '@tabler/icons-react'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import { mayorEnExcel, mayorEntero, type ApunteMayor, type Mayor } from '../../api/informes'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import { CasillaFecha } from '../../components/CasillaFecha'
import { usePlanEnMemoria } from '../../components/PlanEnMemoria'
import { opcionesDeTabla } from '../../components/tabla'
import { guardarFichero, nombreDeFichero } from '../../lib/descarga'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import { formatearEntero, formatearImporte } from '../../lib/format'
import DialogoEditarCuenta from '../plan/DialogoEditarCuenta'
import { columnasDeMayor } from './columnasMayor'
import { sumarSeleccion } from './sumasMayor'

interface Props {
  ejercicio: number
  cuenta: string
  /**
   * Abre el borrador del que viene un apunte. Sin esto el número de asiento se
   * queda como texto, que es lo que interesa dentro del editor de asientos.
   */
  alEditarBorrador?: (idBorrador: number) => void
  /** Cambia para volver a pedir el mayor: lo que se corrigió ya no vale. */
  refresco?: number
  /** Pase del apunte desde el que se ha abierto: la tabla se desplaza hasta él y lo resalta. */
  pase?: number
  /**
   * Quién lo está mirando, para recordarle su periodo la próxima vez. **Sin
   * esto no se guarda nada**, que es lo que interesa cuando el mayor se abre en
   * un modal para un vistazo: ahí se entra siempre con el ejercicio entero, y
   * salir con un trimestre de hace meses puesto sin haberlo pedido sería
   * peligroso.
   */
  usuario?: string
}

/** Lo que se recuerda del filtro. Las fechas, como las manda la API. */
interface FiltroGuardado {
  desde: string
  hasta: string
  borradores: boolean
}

const PREFERENCIA = 'mayor.filtro'

/**
 * Los movimientos de una cuenta con su saldo, y las casillas para acotarlos.
 *
 * Vale igual en la pantalla de informes y en el modal que se abre desde una
 * línea del asiento. Entra con el **ejercicio entero**: acotar es cosa de
 * después, y lo primero que se quiere ver es todo.
 *
 * **El saldo lo calcula la API**, apunte a apunte y para el periodo entero: aquí
 * no se acumula ninguna columna. `saldo_anterior` es lo que la cuenta arrastraba
 * antes del primer apunte de la página, que es lo que hace que el saldo de una
 * página cualquiera signifique algo.
 */
export default function VistaMayor({
  ejercicio,
  cuenta,
  alEditarBorrador,
  refresco,
  usuario,
  pase,
}: Props) {
  const guardado =
    usuario === undefined ? null : leerPreferencia<FiltroGuardado>(usuario, PREFERENCIA)

  const [desde, setDesde] = useState<Date | null>(fechaDeApi(guardado?.desde))
  const [hasta, setHasta] = useState<Date | null>(fechaDeApi(guardado?.hasta))
  // Marcado de entrada: el diario ya enseña los borradores como uno más, y un
  // mayor que se los dejara fuera diría un saldo distinto del que se ve allí.
  const [borradores, setBorradores] = useState(guardado?.borradores ?? true)
  const [mayor, setMayor] = useState<Mayor | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({})
  const [bajando, setBajando] = useState(false)
  const plan = usePlanEnMemoria()
  const datosCuenta = plan.porCodigo.get(cuenta) ?? null
  const [editandoCuenta, setEditandoCuenta] = useState(false)

  const desdeApi = fechaParaApi(desde)
  const hastaApi = fechaParaApi(hasta)

  useEffect(() => {
    if (usuario === undefined) return
    guardarPreferencia(usuario, PREFERENCIA, { desde: desdeApi, hasta: hastaApi, borradores })
  }, [usuario, desdeApi, hastaApi, borradores])

  const cargar = useCallback(
    async (senal: AbortSignal) => {
      setCargando(true)
      setError(null)
      try {
        setMayor(
          await mayorEntero(
            {
              ejercicio,
              cuenta,
              desde: desdeApi,
              hasta: hastaApi,
              incluirBorradores: borradores,
            },
            senal,
          ),
        )
      } catch (fallo) {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setMayor(null)
      } finally {
        setCargando(false)
      }
    },
    [ejercicio, cuenta, desdeApi, hastaApi, borradores],
  )

  useEffect(() => {
    const corte = new AbortController()
    void cargar(corte.signal)
    return () => corte.abort()
    // `refresco` cambia al corregir un borrador desde aquí: lo que se acaba de
    // tocar ya no vale y hay que volver a pedirlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar, refresco])

  const columnas = useMemo(() => columnasDeMayor(alEditarBorrador), [alEditarBorrador])

  // Al abrir desde un apunte, la tabla baja hasta su línea (cuando ya hay filas pintadas).
  const hayFilas = mayor !== null && mayor.apuntes.some((f) => f.pase === pase)
  useEffect(() => {
    if (pase === undefined || !hayFilas) return
    const espera = window.setTimeout(() => {
      document.querySelector(`[data-pase="${pase}"]`)?.scrollIntoView({ block: 'center' })
    }, 350)
    return () => window.clearTimeout(espera)
  }, [pase, hayFilas])

  async function bajarExcel() {
    setError(null)
    setBajando(true)
    try {
      // El fichero lo arma la API: aquí no se formatea ningún importe ni
      // ninguna fecha, que es justo lo que se quería evitar al pedirlo.
      guardarFichero(
        await mayorEnExcel({
          ejercicio,
          cuenta,
          desde: desdeApi,
          hasta: hastaApi,
          incluirBorradores: borradores,
        }),
        nombreDeFichero(`mayor_${ejercicio}_${cuenta}`, 'xlsx'),
      )
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setBajando(false)
    }
  }

  const marcados = useMemo(
    () => (mayor?.apuntes ?? []).filter((fila) => seleccion[String(fila.pase)]),
    [mayor, seleccion],
  )
  const suma = useMemo(
    () => (marcados.length === 0 ? null : sumarSeleccion(marcados)),
    [marcados],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<ApunteMayor>(),
    columns: columnas,
    data: mayor?.apuntes ?? [],
    // Sin paginación: el mayor se recorre entero de arriba abajo, y pasar
    // páginas rompe justo eso. El scroll se queda en las filas.
    enablePagination: false,
    enableBottomToolbar: false,
    enableRowSelection: true,
    onRowSelectionChange: setSeleccion,
    getRowId: (fila) => String(fila.pase),
    // El mismo color que en el diario: los borradores en naranja, y lo marcado
    // en azul por encima, porque lo que se acaba de señalar tiene que verse
    // aunque sea un borrador.
    mantineTableBodyRowProps: ({ row }) => {
      const datos = { 'data-pase': row.original.pase }
      if (row.getIsSelected()) {
        return { ...datos, style: { backgroundColor: 'var(--mantine-color-blue-1)' } }
      }
      if (row.original.pase === pase) {
        return { ...datos, style: { backgroundColor: 'var(--mantine-color-yellow-2)' } }
      }
      return row.original.es_borrador
        ? { ...datos, style: { backgroundColor: 'var(--mantine-color-orange-0)' } }
        : datos
    },
    // Solo la primera vez: en una recarga las filas de antes se quedan puestas
    // hasta que llegan las nuevas, y así la tabla no parpadea ni pierde el
    // sitio por el que se iba.
    state: { isLoading: cargando && mayor === null, rowSelection: seleccion },
    localization: {
      noRecordsToDisplay: 'Esta cuenta no tiene movimientos en ese periodo.',
    },
  })

  return (
    <Stack gap="md">
      <Group gap="xs" align="center">
        <Text fw={600} ff="monospace">
          {cuenta}
        </Text>
        <Text fw={500}>{datosCuenta?.descripcion ?? ''}</Text>
        {datosCuenta !== null && (
          <Tooltip label="Cambiar el título de la cuenta" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Cambiar el título de la cuenta"
              onClick={() => setEditandoCuenta(true)}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <DialogoEditarCuenta
        cuenta={editandoCuenta ? datosCuenta : null}
        ejercicio={ejercicio}
        alCerrar={() => setEditandoCuenta(false)}
        alGuardada={() => {
          setEditandoCuenta(false)
          plan.refrescar()
        }}
      />
      <Group align="flex-end" gap="md">
        <CasillaFecha
          label="Desde"
          value={desde}
          onChange={(valor) => {
            setDesde(valor as Date | null)
          }}
          clearable
          w={150}
        />
        <CasillaFecha
          label="Hasta"
          value={hasta}
          onChange={(valor) => {
            setHasta(valor as Date | null)
          }}
          clearable
          w={150}
        />
        <Checkbox
          label="Incluir borradores"
          checked={borradores}
          onChange={(e) => {
            setBorradores(e.currentTarget.checked)
          }}
          pb={8}
        />
        {/* Sin el logotipo de Excel, que es marca de otro: la hoja de cálculo
            de Tabler en su verde, que es lo que todo el mundo reconoce. */}
        {/* Aquí y no en la pantalla, para que salga también cuando el mayor se
            abre en un modal desde el diario o desde una línea del asiento. */}
        <BotonDeAyuda clave="informes" />
        <Tooltip label="Descargar en Excel" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            color="green"
            aria-label="Descargar en Excel"
            loading={bajando}
            disabled={mayor === null || mayor.apuntes.length === 0}
            onClick={() => void bajarExcel()}
            mb={4}
          >
            <IconFileSpreadsheet size={20} color="var(--mantine-color-green-7)" />
          </ActionIcon>
        </Tooltip>
      </Group>

      {error && (
        <Alert color="red" role="alert" title="No se pudo cargar el mayor">
          {error}
        </Alert>
      )}

      {!error && <MantineReactTable table={tabla} />}

      {mayor !== null && !error && (
        <Group gap="xl" wrap="wrap">
          <Dato rotulo="Saldo anterior" valor={formatearImporte(mayor.saldo_anterior)} />
          <Dato rotulo="Saldo" valor={formatearImporte(mayor.saldo)} />
          {/* Solo cuando hay borradores: sin ellos es el mismo saldo de al lado
              y no dice nada. */}
          {mayor.apuntes_en_borrador > 0 && (
            <Dato rotulo="Saldo firme" valor={formatearImporte(mayor.saldo_firme)} />
          )}
          <Text size="sm" c="dimmed">
            {`${formatearEntero(mayor.total)} movimientos`}
          </Text>
          {/* Lo de la tabla sigue siendo lo de antes hasta que llegue lo nuevo:
              esto dice que se está pidiendo, sin vaciar nada. */}
          {cargando && <Loader size="xs" />}
        </Group>
      )}

      {suma !== null && (
        <Group gap="xl" wrap="wrap">
          <Text size="sm" c="dimmed">
            {`${formatearEntero(suma.apuntes)} marcados`}
          </Text>
          <Dato rotulo="Debe" valor={formatearImporte(suma.debe)} />
          <Dato rotulo="Haber" valor={formatearImporte(suma.haber)} />
          <Dato rotulo="Diferencia" valor={formatearImporte(suma.diferencia)} />
        </Group>
      )}
    </Stack>
  )
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Group gap={6}>
      <Text size="sm" c="dimmed">
        {rotulo}
      </Text>
      <Text size="sm" fw={600} ff="monospace">
        {valor}
      </Text>
    </Group>
  )
}
