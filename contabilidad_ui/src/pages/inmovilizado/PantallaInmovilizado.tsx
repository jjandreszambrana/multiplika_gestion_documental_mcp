import { Alert, Button, Group, SegmentedControl, Stack, Title } from '@mantine/core'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import { listarBienes, type Bien } from '../../api/inmovilizado'
import { alcanza } from '../../api/sesion'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import { opcionesDeTabla } from '../../components/tabla'
import { columnasDeInmovilizado } from './columnas'
import DialogoBajaConAsiento from './DialogoBajaConAsiento'
import DialogoBien from './DialogoBien'
import DialogoCorregirValor from './DialogoCorregirValor'
import DialogoDejarDeAmortizar from './DialogoDejarDeAmortizar'
import DialogoDotar from './DialogoDotar'
import FichaBien from './FichaBien'

interface Props {
  /** El del selector de la cabecera: es el que se dota. */
  ejercicio: number | null
  nivel: string
  /** Dígitos de una cuenta en esta empresa, de la configuración. */
  ancho: number
}

/**
 * Los bienes de inmovilizado de la empresa.
 *
 * La API devuelve todos los bienes de una vez, sin paginar, y ya trae calculado
 * lo amortizado y lo que queda: aquí no se calcula ningún importe.
 *
 * Sin nivel `apuntes` no se ve ninguna acción: se esconde, no se apaga.
 */
export default function PantallaInmovilizado({ ejercicio, nivel, ancho }: Props) {
  const [soloActivos, setSoloActivos] = useState(true)
  const [bienes, setBienes] = useState<Bien[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fichaDe, setFichaDe] = useState<number | null>(null)
  const [dotando, setDotando] = useState(false)
  const [enFormulario, setEnFormulario] = useState<{
    bien: Bien | null
    mejoraDe: Bien | null
  } | null>(null)
  const [aDejarDeAmortizar, setADejarDeAmortizar] = useState<Bien | null>(null)
  const [aDarDeBaja, setADarDeBaja] = useState<Bien | null>(null)
  const [aCorregirValor, setACorregirValor] = useState<Bien | null>(null)
  const [recarga, setRecarga] = useState(0)

  const apunta = alcanza(nivel, 'apuntes')

  const cargar = useCallback(
    async (senal: AbortSignal) => {
      setError(null)
      setBienes(null)
      try {
        const { bienes: filas } = await listarBienes(soloActivos, senal)
        setBienes(filas)
      } catch (fallo) {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setBienes([])
      }
    },
    [soloActivos],
  )

  useEffect(() => {
    const corte = new AbortController()
    void cargar(corte.signal)
    return () => corte.abort()
  }, [cargar, recarga])

  /** Tras cualquier cambio, la lista se rehace: los totales han cambiado. */
  function rehacer() {
    setEnFormulario(null)
    setADejarDeAmortizar(null)
    setADarDeBaja(null)
    setACorregirValor(null)
    setDotando(false)
    setRecarga((n) => n + 1)
  }

  const columnas = useMemo(
    () =>
      columnasDeInmovilizado(
        apunta
          ? {
              alCorregir: (bien) => setEnFormulario({ bien, mejoraDe: null }),
              alCorregirValor: setACorregirValor,
              alAnadirMejora: (bien) => setEnFormulario({ bien: null, mejoraDe: bien }),
              alDejarDeAmortizar: setADejarDeAmortizar,
              alDarDeBaja: setADarDeBaja,
            }
          : null,
      ),
    [apunta],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<Bien>(),
    columns: columnas,
    data: bienes ?? [],
    enablePagination: false,
    enableBottomToolbar: false,
    // Las mejoras cuelgan de su bien en vez de ir sueltas: el inventario se lee
    // por bienes, y cada uno se abre para ver lo que se le ha ido metiendo.
    enableExpanding: true,
    getSubRows: (fila) => fila.mejoras,
    filterFromLeafRows: true,
    state: { isLoading: bienes === null },
    localization: {
      noRecordsToDisplay: 'Esta empresa no tiene ningún bien de inmovilizado.',
    },
    mantineTableBodyRowProps: ({ row }) => ({
      onClick: () => setFichaDe(row.original.id),
      style: { cursor: 'pointer' },
    }),
  })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Inmovilizado</Title>
          <BotonDeAyuda clave="amortizaciones" />
        </Group>
        <Group gap="sm">
          <SegmentedControl
            size="xs"
            value={soloActivos ? 'activos' : 'todos'}
            onChange={(valor) => setSoloActivos(valor === 'activos')}
            data={[
              { value: 'activos', label: 'Solo los que se amortizan' },
              { value: 'todos', label: 'Todos, incluidos los dados de baja' },
            ]}
          />
          {apunta && (
            <>
              <Button variant="default" onClick={() => setDotando(true)} disabled={ejercicio === null}>
                Dotar la amortización…
              </Button>
                  <Button onClick={() => setEnFormulario({ bien: null, mejoraDe: null })}>
                Nuevo bien…
              </Button>
            </>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" role="alert" title="No se pudo cargar el inmovilizado">
          {error}
        </Alert>
      )}

      <MantineReactTable table={tabla} />

      <FichaBien idInmovilizado={fichaDe} alCerrar={() => setFichaDe(null)} />

      {enFormulario !== null && (
        <DialogoBien
          // Recrea el formulario por bien, para que nazca con sus valores.
          key={enFormulario.bien?.id ?? `mejora-${enFormulario.mejoraDe?.id ?? 'nuevo'}`}
          abierto
          bien={enFormulario.bien}
          mejoraDe={enFormulario.mejoraDe}
          ancho={ancho}
          ejercicio={ejercicio}
          alCerrar={() => setEnFormulario(null)}
          alGuardado={rehacer}
        />
      )}

      <DialogoDejarDeAmortizar
        bien={aDejarDeAmortizar}
        alCerrar={() => setADejarDeAmortizar(null)}
        alHecho={rehacer}
      />

      <DialogoBajaConAsiento
        bien={aDarDeBaja}
        ancho={ancho}
        ejercicio={ejercicio}
        alCerrar={() => setADarDeBaja(null)}
        alHecho={rehacer}
      />

      <DialogoCorregirValor
        bien={aCorregirValor}
        alCerrar={() => setACorregirValor(null)}
        alHecho={rehacer}
      />

      <DialogoDotar
        abierto={dotando}
        ejercicio={ejercicio}
        alCerrar={() => setDotando(false)}
        alHecho={rehacer}
      />
    </Stack>
  )
}
