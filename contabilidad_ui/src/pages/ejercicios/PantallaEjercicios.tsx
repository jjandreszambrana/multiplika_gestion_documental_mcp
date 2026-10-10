import { Alert, Button, Group, Stack, Title } from '@mantine/core'
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table'
import { useMemo, useState } from 'react'
import { alcanza, type Ejercicio } from '../../api/sesion'
import { opcionesDeTabla } from '../../components/tabla'
import { columnasDeEjercicios } from './columnas'
import DialogoAbrirEjercicio from './DialogoAbrirEjercicio'
import DialogoBloqueo from './DialogoBloqueo'
import PanelPeriodos from './PanelPeriodos'

interface Props {
  /** La lista la pide el armazón al entrar: aquí no se vuelve a pedir. */
  ejercicios: Ejercicio[]
  nivel: string
  error: string | null
  /** Tras cualquier cambio, para que el selector de la cabecera se entere. */
  alRecargar: () => void
}

/**
 * Ejercicios de la empresa y sus periodos de liquidación.
 *
 * Cerrar el ejercicio y el asiento de apertura no están aquí todavía: son
 * irreversibles y van con su propia confirmación.
 */
export default function PantallaEjercicios({ ejercicios, nivel, error, alRecargar }: Props) {
  const [abriendo, setAbriendo] = useState(false)
  const [periodosDe, setPeriodosDe] = useState<number | null>(null)
  const [aBloquear, setABloquear] = useState<Ejercicio | null>(null)

  const mantiene = alcanza(nivel, 'cierre')

  const columnas = useMemo(
    () =>
      columnasDeEjercicios({
        alVerPeriodos: (e) => setPeriodosDe(e.ejercicio),
        alPedirBloqueo: mantiene ? setABloquear : null,
      }),
    [mantiene],
  )

  const tabla = useMantineReactTable({
    ...opcionesDeTabla<Ejercicio>(),
    columns: columnas,
    data: ejercicios,
    enablePagination: false,
    enableBottomToolbar: false,
    localization: {
      noRecordsToDisplay: 'Esta empresa no tiene ningún ejercicio.',
    },
    state: { showAlertBanner: error !== null },
    mantineToolbarAlertBannerProps: error ? { color: 'red', children: error } : undefined,
  })

  // Vienen del más reciente al más antiguo: el primero es el último abierto.
  const ultimo = ejercicios[0]?.ejercicio ?? null

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Ejercicios</Title>
        {mantiene && <Button onClick={() => setAbriendo(true)}>Abrir ejercicio…</Button>}
      </Group>

      {error && (
        <Alert color="red" title="No se pudo cargar la lista de ejercicios">
          {error}
        </Alert>
      )}

      <MantineReactTable table={tabla} />

      <DialogoAbrirEjercicio
        key={ultimo ?? 'sin-ejercicios'}
        abierto={abriendo}
        ultimoEjercicio={ultimo}
        alCerrar={() => setAbriendo(false)}
        alAbierto={() => {
          setAbriendo(false)
          alRecargar()
        }}
      />

      <DialogoBloqueo
        ejercicio={aBloquear}
        alCerrar={() => setABloquear(null)}
        alHecho={() => {
          setABloquear(null)
          alRecargar()
        }}
      />

      <PanelPeriodos
        ejercicio={periodosDe}
        puedeMantener={mantiene}
        alCerrar={() => setPeriodosDe(null)}
      />
    </Stack>
  )
}
