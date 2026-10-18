import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconFileSpreadsheet, IconRefresh } from '@tabler/icons-react'
import { CasillaFecha } from '../../components/CasillaFecha'
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_RowSelectionState,
  type MRT_VisibilityState,
} from 'mantine-react-table'
import { useEffect, useMemo, useRef, useState } from 'react'
import { totalesApuntes, type Apunte, type Totales } from '../../api/asientos'
import { diarioEnExcel } from '../../api/informes'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import { guardarFichero, nombreDeFichero } from '../../lib/descarga'
import { listarBorradores } from '../../api/borradores'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import { opcionesDeTabla } from '../../components/tabla'
import { formatearEntero } from '../../lib/format'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import { alcanza } from '../../api/sesion'
import { COLUMNAS_DE_FABRICA, columnasDelDiario, ordenarColumnas } from './columnas'
import DialogoFiltro from './DialogoFiltro'
import DialogoTraspaso from './DialogoTraspaso'
import EditorAsiento from './EditorAsiento'
import { filtroDeEntrada, normalizarFiltro, resumenDeFiltro, type Filtro } from './filtro'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import ListaBorradores from './ListaBorradores'
import PieDeTotales from './PieDeTotales'
import { asientoDe, seleccionPorAsiento } from './seleccion'
import { sumarSeleccion } from './sumas'
import { useApuntes } from './useApuntes'
import AvisoTrasConfirmar from '../inmovilizado/AvisoTrasConfirmar'
import ModalMayor from '../informes/ModalMayor'
import DialogoAsientoPredefinido from '../plantillas/DialogoAsientoPredefinido'

interface Props {
  ejercicio: number | null
  /** Último día del ejercicio (`aaaa-mm-dd`), por el que se abre si no es el actual. */
  cierre: string | null
  nivel: string
  /** Dígitos de una cuenta de apuntes, de la configuración de la empresa. */
  ancho: number
  /** Identifica a quién se le guardan las columnas en este equipo. */
  usuario: string
  /** Entrar con la lista de borradores abierta, como al llegar desde un traspaso. */
  conBorradoresAbiertos?: boolean
}

const PREFERENCIA_COLUMNAS = 'diario.columnas'
const PREFERENCIA_ORDEN = 'diario.orden'
// Una consulta por ejercicio: si se guardara una sola, al cambiar de ejercicio
// se arrastrarían fechas de otro año y la lista saldría vacía.
const PREFERENCIA_CONSULTA = 'diario.consulta'
const consultaDe = (ejercicio: number | null) =>
  `${PREFERENCIA_CONSULTA}.${ejercicio ?? 'todos'}`


// Solo para leer el orden de fábrica: los identificadores de las columnas no
// dependen de qué se haga al pinchar una cuenta.
const ORDEN_DE_FABRICA = columnasDelDiario(() => {}).map((c) => String(c.id ?? c.accessorKey))

export default function PantallaDiario({
  ejercicio,
  cierre,
  nivel,
  ancho,
  usuario,
  conBorradoresAbiertos = false,
}: Props) {
  const puedeApuntar = alcanza(nivel, 'apuntes')
  const [editando, setEditando] = useState(false)
  const [conPlantilla, setConPlantilla] = useState(false)
  /** El borrador que acaba de crear una plantilla, para ofrecer abrirlo. */
  const [borradorDePlantilla, setBorradorDePlantilla] = useState<number | null>(null)
  const [idBorrador, setIdBorrador] = useState<number | null>(null)
  const [viendoBorradores, setViendoBorradores] = useState(conBorradoresAbiertos)
  const [sinConfirmar, setSinConfirmar] = useState(0)
  const [recarga, setRecarga] = useState(0)
  const [confirmado, setConfirmado] = useState<string | null>(null)
  /** El que se acaba de meter en el libro, para preguntar por su ficha de bien. */
  const [asientoRecienConfirmado, setAsientoRecienConfirmado] = useState<number | null>(null)
  /** La cuenta cuyo mayor se está mirando, sin salir del diario. */
  const [mayorDe, setMayorDe] = useState('')
  const [bajandoExcel, setBajandoExcel] = useState(false)
  const [errorExcel, setErrorExcel] = useState<string | null>(null)
  const columnasTabla = useMemo(() => columnasDelDiario(setMayorDe), [])
  const porDefecto = useMemo(() => filtroDeEntrada(ejercicio, cierre), [ejercicio, cierre])
  const [filtrando, setFiltrando] = useState(false)
  const [traspasando, setTraspasando] = useState(false)
  // Marcar una línea marca su asiento entero, que es la unidad que se mira. Para
  // traspasar un trozo hace falta lo contrario, así que se puede cambiar de modo
  // con el interruptor, o invertirlo en un clic suelto con Ctrl.
  const [porAsiento, setPorAsiento] = useState(true)
  const conCtrl = useRef(false)
  const [filtro, setFiltro] = useState<Filtro>(() =>
    normalizarFiltro(
      leerPreferencia<unknown>(usuario, consultaDe(ejercicio)),
      filtroDeEntrada(ejercicio, cierre),
    ),
  )
  const [seleccion, setSeleccion] = useState<MRT_RowSelectionState>({})
  // La casilla de día solo enseña fecha cuando el rango es un único día: con un
  // rango de un mes, ninguna fecha suelta contaría la verdad.
  const diaDelFiltro = filtro.desde !== '' && filtro.desde === filtro.hasta ? filtro.desde : ''

  // Lo tecleado va aparte del filtro y NO pide nada mientras se escribe: se
  // aplica al salir del campo o con Enter. Media fecha ya es una fecha válida
  // -`03/09/20` es el año 2020-, así que aplicar letra a letra lanzaba una
  // descarga del diario por cada tecla.
  const [dia, setDia] = useState(diaDelFiltro)

  // El filtro también cambia desde el diálogo: la casilla tiene que seguirlo.
  useEffect(() => {
    setDia(diaDelFiltro)
  }, [diaDelFiltro])

  function aplicarDia() {
    if (dia === diaDelFiltro) return
    setFiltro((actual) => ({ ...actual, desde: dia, hasta: dia }))
  }

  const [columnas, setColumnas] = useState<MRT_VisibilityState>(
    () =>
      leerPreferencia<MRT_VisibilityState>(usuario, PREFERENCIA_COLUMNAS) ?? COLUMNAS_DE_FABRICA,
  )
  const [orden, setOrden] = useState<string[]>(() =>
    ordenarColumnas(leerPreferencia<string[]>(usuario, PREFERENCIA_ORDEN), ORDEN_DE_FABRICA),
  )

  const [totales, setTotales] = useState<Totales | null>(null)
  const [errorTotales, setErrorTotales] = useState<string | null>(null)

  // Cuántos asientos hay a medias, para el botón. Se vuelve a mirar al cerrar
  // el editor, que es lo único que cambia esa cuenta desde aquí.
  useEffect(() => {
    if (!puedeApuntar) return
    listarBorradores({ ejercicio, soloCuadrados: false, soloMios: false, offset: 0, limit: 1 })
      .then((pagina) => setSinConfirmar(pagina.total))
      .catch(() => setSinConfirmar(0))
  }, [ejercicio, puedeApuntar, recarga])

  useEffect(() => {
    guardarPreferencia(usuario, PREFERENCIA_COLUMNAS, columnas)
  }, [usuario, columnas])

  useEffect(() => {
    guardarPreferencia(usuario, PREFERENCIA_ORDEN, orden)
  }, [usuario, orden])

  // La consulta se recupera al volver a la pantalla y al volver a entrar.
  useEffect(() => {
    guardarPreferencia(usuario, consultaDe(ejercicio), filtro)
  }, [usuario, ejercicio, filtro])

  // Al cambiar el filtro se quita la selección: sumar filas que ya no se ven
  // daría un total que no corresponde con nada de la pantalla. Volver del
  // editor NO cuenta: ahí se sigue mirando el mismo asiento y perder lo marcado
  // obliga a buscarlo otra vez.
  useEffect(() => {
    setSeleccion({})
  }, [ejercicio, filtro])

  const { apuntes, total, cargando, error, refrescarAsiento } = useApuntes({
    ejercicio,
    filtro,
    recarga,
  })

  // Qué asiento hay que volver a dejar marcado cuando terminen de llegar los
  // apuntes. Se guarda el asiento y no las filas: al guardar un borrador, la
  // API reescribe sus líneas con claves nuevas y las de antes ya no existen.
  const [porMarcar, setPorMarcar] = useState<string | null>(null)

  useEffect(() => {
    if (cargando || porMarcar === null) return
    const suyas = apuntes.filter((a) => asientoDe(a) === porMarcar)
    setPorMarcar(null)
    if (suyas.length === 0) return
    setSeleccion(Object.fromEntries(suyas.map((a) => [a.clave, true])))
  }, [apuntes, cargando, porMarcar])

  async function bajarExcel() {
    setErrorExcel(null)
    setBajandoExcel(true)
    try {
      guardarFichero(
        await diarioEnExcel({ ...filtro, ejercicio, idBorrador: null }),
        nombreDeFichero(`libro_diario_${ejercicio ?? ''}`, 'xlsx'),
      )
    } catch (fallo) {
      setErrorExcel(textoDeError(fallo))
    } finally {
      setBajandoExcel(false)
    }
  }

  function marcar(filas: Apunte[]) {
    setSeleccion(Object.fromEntries(filas.map((a) => [a.clave, true])))
  }

  /** Cuando el asiento no estaba a la vista: se recarga y se marca al llegar. */
  function recargarYMarcar(grupo: string) {
    setPorMarcar(grupo)
    setRecarga((n) => n + 1)
  }

  // Tras recargar, lo marcado que ya no existe se suelta: un borrador cambia de
  // línea al confirmarse, y una clave huérfana no se puede ni desmarcar.
  useEffect(() => {
    if (cargando) return
    setSeleccion((anterior) => {
      const vivas = new Set(apuntes.map((a) => a.clave))
      const limpia = Object.fromEntries(
        Object.entries(anterior).filter(([clave]) => vivas.has(clave)),
      )
      return Object.keys(limpia).length === Object.keys(anterior).length ? anterior : limpia
    })
  }, [apuntes, cargando])


  // Las sumas de la consulta y del ejercicio, de fondo: no dependen de la
  // página y tardan más, así que no se hacen esperar al listado. Van con el
  // MISMO `incluir`, o las cifras no cuadrarían con lo que se está viendo.
  useEffect(() => {
    const corte = new AbortController()
    let vigente = true
    setTotales(null)
    setErrorTotales(null)

    totalesApuntes({ ...filtro, ejercicio, idBorrador: null }, corte.signal)
      .then((leidos) => vigente && setTotales(leidos))
      .catch(
        (fallo: unknown) =>
          vigente &&
          !esAbortada(fallo) &&
          setErrorTotales(`No se pudieron calcular las sumas: ${textoDeError(fallo)}`),
      )

    return () => {
      vigente = false
      corte.abort()
    }
  }, [ejercicio, filtro, recarga])

  // Lo único que se suma aquí: el total de una columna que se está viendo.
  const marcados = useMemo(() => apuntes.filter((a) => seleccion[a.clave]), [apuntes, seleccion])

  // El borrador marcado, si lo marcado es un solo borrador. Un asiento
  // confirmado no se abre en el editor: no se toca ni se corrige, se arregla
  // con un asiento nuevo.
  const borradorMarcado = useMemo(() => {
    if (marcados.length === 0 || !marcados.every((a) => a.es_borrador)) return null
    const ids = new Set(marcados.map((a) => a.id_borrador))
    return ids.size === 1 ? [...ids][0]! : null
  }, [marcados])
  const sumaDeLaSeleccion = useMemo(
    () => (marcados.length === 0 ? null : sumarSeleccion(marcados)),
    [marcados],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<Apunte>(),
    columns: columnasTabla,
    data: apuntes,
    // La clave es `clave`, no `pase`: un borrador no tiene pase hasta confirmarlo.
    getRowId: (fila) => fila.clave,
    // El color dice de un vistazo qué se está mirando: lo marcado en azul, y
    // los borradores en naranja. Marcado manda sobre borrador, porque lo que se
    // acaba de señalar tiene que verse aunque sea un borrador.
    mantineTableBodyRowProps: ({ row }) => {
      if (row.getIsSelected()) {
        return { style: { backgroundColor: 'var(--mantine-color-blue-1)' } }
      }
      return row.original.es_borrador
        ? { style: { backgroundColor: 'var(--mantine-color-orange-0)' } }
        : {}
    },
    renderTopToolbarCustomActions: () => (
      <Group gap="xs">
        {/* Se baja lo mismo que se está viendo: al fichero le van los mismos
            filtros que a la consulta que llena la tabla. */}
        <Tooltip label="Descargar en Excel" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Descargar en Excel"
            loading={bajandoExcel}
            disabled={apuntes.length === 0}
            onClick={() => void bajarExcel()}
          >
            <IconFileSpreadsheet size={20} color="var(--mantine-color-green-7)" />
          </ActionIcon>
        </Tooltip>
        {/* La pantalla se queda montada al ir a otro apartado: lo que se ve
            puede haberse quedado atrás. Vuelve a pedir con el mismo filtro los
            apuntes, las sumas y los asientos sin confirmar; las filas de antes
            siguen puestas hasta que llegan las nuevas, así que la tabla no se
            mueve, y lo marcado que siga existiendo se queda marcado. */}
        <Tooltip label="Recargar los apuntes" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Recargar los apuntes"
            loading={cargando}
            onClick={() => setRecarga((n) => n + 1)}
          >
            <IconRefresh size={20} />
          </ActionIcon>
        </Tooltip>
        <SegmentedControl
          size="xs"
          value={porAsiento ? 'asientos' : 'sueltos'}
          onChange={(valor) => setPorAsiento(valor === 'asientos')}
          data={[
            { value: 'asientos', label: 'Marcar asientos' },
            { value: 'sueltos', label: 'Marcar apuntes' },
          ]}
        />
        {puedeApuntar && borradorMarcado !== null && (
          <>
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                setIdBorrador(borradorMarcado)
                setConfirmado(null)
                setBorradorDePlantilla(null)
                setEditando(true)
              }}
            >
              Editar asiento…
            </Button>
            <Button size="xs" variant="default" onClick={() => setTraspasando(true)}>
              Traspasar a otro borrador…
            </Button>
          </>
        )}
      </Group>
    ),
    // La barra superior se enciende solo para el botón de columnas. La
    // búsqueda global se queda apagada a propósito: mientras entran las tandas
    // filtraría sobre lo que lleve cargado, y eso engaña sobre lo que hay.
    enableTopToolbar: true,
    enableHiding: true,
    enableColumnOrdering: true,
    enableGlobalFilter: false,
    enableFilters: false,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    localization: {
      noRecordsToDisplay: 'No hay apuntes con esos filtros',
      showHideColumns: 'Columnas',
      toggleVisibility: 'Columnas',
      showAll: 'Enseñarlas todas',
      showAllColumns: 'Enseñarlas todas',
      hideAll: 'Dejar solo las fijas',
      resetOrder: 'Dejarlo como estaba',
    },
    // Sin paginar: un asiento no puede quedar partido entre dos páginas. Las
    // filas se virtualizan, que es lo que sostiene un ejercicio entero a la vez.
    enablePagination: false,
    enableBottomToolbar: false,
    enableRowVirtualization: true,
    enableRowSelection: true,
    enableSelectAll: true,
    // Las casillas, pequeñas: la fila va apretada y un control más alto que
    // ella se recorta. El aviso de MRT sobre lo seleccionado se apaga porque
    // llega en inglés; lo seleccionado se lee en el pie, con sus sumas.
    mantineSelectCheckboxProps: {
      size: 'xs',
      // Ctrl -o Cmd- invierte el modo solo para este clic.
      onClick: (e) => {
        conCtrl.current = e.ctrlKey || e.metaKey
      },
    },
    positionToolbarAlertBanner: 'none',
    // Marcar una línea marca su asiento entero: es la unidad que se mira.
    onRowSelectionChange: (actualizar) => {
      const enteros = conCtrl.current ? !porAsiento : porAsiento
      conCtrl.current = false
      setSeleccion((anterior) => {
        const propuesta = typeof actualizar === 'function' ? actualizar(anterior) : actualizar
        return enteros ? seleccionPorAsiento(apuntes, anterior, propuesta) : propuesta
      })
    },
    onColumnVisibilityChange: setColumnas,
    onColumnOrderChange: setOrden,
    state: {
      rowSelection: seleccion,
      columnVisibility: columnas,
      columnOrder: orden,
      // Solo mientras no hay nada que enseñar: después van llegando tandas y
      // tapar lo que ya se ve sería peor que verlo crecer.
      isLoading: cargando && apuntes.length === 0,
    },
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="sm" align="center" wrap="nowrap">
          <Title order={3}>{ejercicio === null ? 'Diario' : `Diario · ${ejercicio}`}</Title>
          {/* La misma ayuda que el mayor: es una sola para todos los informes y
              tiene su apartado del diario, con los filtros y lo que baja al
              Excel. */}
          <BotonDeAyuda clave="informes" />
          <Button variant="default" size="xs" onClick={() => setFiltrando(true)}>
            Filtro…
          </Button>
          <CasillaFecha
            aria-label="Día"
            placeholder="Día"
            value={fechaDeApi(dia)}
            onChange={(valor) => setDia(fechaParaApi(valor))}
            onBlur={aplicarDia}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aplicarDia()
            }}
            // Elegir un día con el ratón no hace perder el foco: el calendario
            // se cierra, y ese es el momento de aplicarlo.
            alCerrarCalendario={aplicarDia}
            size="xs"
            w={130}
          />
          <Text size="sm" c="dimmed">
            {resumenDeFiltro(filtro)}
          </Text>
        </Group>
        {puedeApuntar && (
          <Group gap="sm">
            {sinConfirmar > 0 && (
              <Button variant="default" onClick={() => setViendoBorradores(true)}>
                Sin confirmar ({formatearEntero(sinConfirmar)})
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => {
                setConfirmado(null)
                setBorradorDePlantilla(null)
                setConPlantilla(true)
              }}
            >
              Asiento predefinido…
            </Button>
            <Button
              onClick={() => {
                setIdBorrador(null)
                setConfirmado(null)
                setBorradorDePlantilla(null)
                setEditando(true)
              }}
            >
              Asiento nuevo…
            </Button>
          </Group>
        )}
      </Group>

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {/* Aparte del error del listado: que falle la descarga no significa que
          lo que se está viendo esté mal. */}
      {errorExcel && (
        <Alert color="red" role="alert" withCloseButton onClose={() => setErrorExcel(null)}>
          {errorExcel}
        </Alert>
      )}

      {confirmado && (
        <Alert
          color="green"
          p="xs"
          withCloseButton
          onClose={() => {
            setConfirmado(null)
            setBorradorDePlantilla(null)
          }}
        >
          <Group gap="sm">
            <Text size="sm">{confirmado}</Text>
            {borradorDePlantilla !== null && (
              <Button
                size="compact-xs"
                variant="light"
                onClick={() => {
                  setIdBorrador(borradorDePlantilla)
                  setConfirmado(null)
                  setBorradorDePlantilla(null)
                  setEditando(true)
                }}
              >
                Abrir el borrador…
              </Button>
            )}
          </Group>
        </Alert>
      )}

      <Group gap="md" align="center">
        {/* El círculo girando mientras entran las tandas: el diario entero
            tarda, y sin él parece que la pantalla se ha quedado parada. */}
        {cargando && <Loader size="xs" />}
        <Text size="sm">
          {cargando && total > 0
            ? `Cargando ${formatearEntero(apuntes.length)} de ${formatearEntero(total)} apuntes…`
            : `${formatearEntero(total)} apuntes`}
        </Text>
        {marcados.length > 0 && (
          <Button size="compact-xs" variant="subtle" onClick={() => setSeleccion({})}>
            Quitar la selección
          </Button>
        )}
      </Group>

      <MantineReactTable table={tabla} />

      <PieDeTotales seleccion={sumaDeLaSeleccion} totales={totales} error={errorTotales} />

      {borradorMarcado !== null && (
        <DialogoTraspaso
          abierto={traspasando}
          ejercicio={ejercicio}
          origen={borradorMarcado}
          pases={marcados.map((a) => a.pase)}
          alCerrar={() => setTraspasando(false)}
          alTraspasado={(idDestino) => {
            setTraspasando(false)
            // Los dos borradores han cambiado: se recarga y se deja marcado el
            // de destino, que es donde ha ido a parar lo que se movía.
            setPorMarcar(`b${idDestino}`)
            setRecarga((n) => n + 1)
          }}
        />
      )}

      <DialogoFiltro
        abierto={filtrando}
        filtro={filtro}
        porDefecto={porDefecto}
        ancho={ancho}
        alAplicar={(elegido) => {
          setFiltro(elegido)
          setFiltrando(false)
        }}
      />

      <DialogoAsientoPredefinido
        abierto={conPlantilla}
        ancho={ancho}
        ejercicio={ejercicio}
        alCerrar={() => setConPlantilla(false)}
        alHecho={(hecho) => {
          setConPlantilla(false)
          setConfirmado(hecho.aviso)
          setBorradorDePlantilla(hecho.idBorrador)
          setRecarga((n) => n + 1)
        }}
      />

      <EditorAsiento
        abierto={editando}
        ejercicio={ejercicio}
        nivel={nivel}
        ancho={ancho}
        idBorrador={idBorrador}
        alCerrar={(huboCambios) => {
          const id = idBorrador
          setEditando(false)
          // Cerrar sin haber tocado nada no obliga a recargar: no ha cambiado
          // nada que enseñar.
          if (!huboCambios) return
          if (id === null) {
            setRecarga((n) => n + 1)
            return
          }
          // Se vuelve al mismo borrador: se piden solo sus líneas y se dejan
          // marcadas donde estaban, sin bajar el diario entero.
          // Se marcan las líneas que devuelve el refresco, no las que había:
          // al guardar un borrador la API las reescribe con claves nuevas, y
          // marcar las viejas dejaba la selección vacía en cuanto llegaban.
          refrescarAsiento(`b${id}`, { idBorrador: id })
            .then((nuevas) => (nuevas === null ? recargarYMarcar(`b${id}`) : marcar(nuevas)))
            .catch(() => recargarYMarcar(`b${id}`))
        }}
        alConfirmado={(confirmacion) => {
          const grupo = idBorrador === null ? null : `b${idBorrador}`
          setEditando(false)
          // Si el asiento ha metido algo en una cuenta de inmovilizado, se
          // pregunta por su ficha. Después de confirmar, nunca al teclear.
          setAsientoRecienConfirmado(confirmacion.asiento)
          setBorradorDePlantilla(null)
          setConfirmado(
            `Asiento ${confirmacion.asiento} registrado en el diario ${confirmacion.diario}.`,
          )
          // Si el borrador estaba a la vista, se cambian sus líneas por las del
          // asiento ya confirmado y se deja lo marcado donde estaba. Si no
          // estaba —era nuevo, o el filtro no lo alcanza—, se recarga.
          const yaEnElLibro = `a${ejercicio}.${confirmacion.asiento}`
          if (grupo === null) {
            recargarYMarcar(yaEnElLibro)
            return
          }
          refrescarAsiento(grupo, { asiento: confirmacion.asiento })
            .then((nuevas) => (nuevas === null ? recargarYMarcar(yaEnElLibro) : marcar(nuevas)))
            .catch(() => recargarYMarcar(yaEnElLibro))
        }}
      />

      {/* Se queda abierto debajo del editor, que se abre desde él: al cerrarlo
          se vuelve al mayor tal y como estaba. Va por debajo a propósito, con
          un z-index menor que el de un modal normal; esconderlo y volver a
          enseñarlo hacía la animación de apertura entera y saltaba todo. */}
      <ModalMayor
        cuenta={mayorDe}
        zIndex={150}
        ejercicio={ejercicio}
        alCerrar={() => setMayorDe('')}
        alEditarBorrador={
          puedeApuntar
            ? (id) => {
                setIdBorrador(id)
                setEditando(true)
              }
            : undefined
        }
      />

      <AvisoTrasConfirmar
        asiento={asientoRecienConfirmado}
        ejercicio={ejercicio}
        ancho={ancho}
        activo={puedeApuntar}
        alCerrar={() => setAsientoRecienConfirmado(null)}
      />

      <ListaBorradores
        abierto={viendoBorradores}
        ejercicio={ejercicio}
        alCerrar={() => setViendoBorradores(false)}
        alAbrir={(id) => {
          setViendoBorradores(false)
          setIdBorrador(id)
          setConfirmado(null)
          setBorradorDePlantilla(null)
          setEditando(true)
        }}
      />
    </Stack>
  )
}
