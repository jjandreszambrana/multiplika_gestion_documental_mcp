import { Alert, Badge, Button, Checkbox, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import {
  confirmarCierre,
  deshacerCierre,
  estadoDelCierre,
  impedimentosDelCierre,
  prepararCierre,
  type EstadoDelCierre,
  type Impedimentos,
  type VistaDelCierre,
} from '../../api/cierre'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import BloqueApertura from './BloqueApertura'
import ListaDeImpedimentos from './ListaDeImpedimentos'
import VistaPreviaCierre from './VistaPreviaCierre'

interface Props {
  ejercicio: number | null
}

/** Cómo se rotula cada punto del proceso. */
const PASOS: Record<string, { texto: string; color: string }> = {
  sin_empezar: { texto: 'Sin empezar', color: 'gray' },
  preparado: { texto: 'Preparado, pendiente de confirmar', color: 'yellow' },
  cerrado: { texto: 'Cerrado', color: 'green' },
}

const AVISO_PREPARADO =
  'Preparar no cierra el ejercicio: sigue admitiendo apuntes. Si se apunta algo después de ' +
  'preparar, hay que deshacer y volver a preparar.'

const AVISO_CONFIRMAR =
  'Al confirmar, los dos asientos entran en el libro y el ejercicio queda cerrado. Esto ya no ' +
  'se puede deshacer.'

/**
 * Regularizar, cerrar el ejercicio y abrir el siguiente. Nivel `cierre`.
 *
 * **Los dos asientos se preparan como borradores**, así que hasta que se
 * confirma se puede mirar lo que va a entrar y deshacerlo sin dejar rastro.
 *
 * Lo primero que se ve es lo que falta por hacer; solo después, qué va a pasar.
 */
export default function PantallaCierre({ ejercicio }: Props) {
  const [estado, setEstado] = useState<EstadoDelCierre | null>(null)
  const [impedimentos, setImpedimentos] = useState<Impedimentos | null>(null)
  const [vista, setVista] = useState<VistaDelCierre | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [recarga, setRecarga] = useState(0)
  /**
   * Contar los asientos a medias. Sin marcar por defecto: lo normal es cerrar
   * con el ejercicio ya resuelto, y esto es para mirar cómo quedaría antes.
   */
  const [conBorradores, setConBorradores] = useState(false)

  const cargar = useCallback(
    async (senal: AbortSignal) => {
      if (ejercicio === null) return
      setCargando(true)
      setError(null)
      try {
        const [comoEsta, queFalta] = await Promise.all([
          estadoDelCierre(ejercicio, senal),
          impedimentosDelCierre(ejercicio, conBorradores, senal),
        ])
        setEstado(comoEsta)
        setImpedimentos(queFalta)
        // Simular no se frena por lo que falte, así que se puede enseñar qué
        // pasaría aunque todavía no se pueda cerrar. Es lo que hace que la
        // pantalla sirva desde el primer momento y no solo al final.
        setVista(await prepararCierre(ejercicio, !comoEsta.preparado, conBorradores))
      } catch (fallo) {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
      } finally {
        setCargando(false)
      }
    },
    [ejercicio, conBorradores],
  )

  useEffect(() => {
    const corte = new AbortController()
    void cargar(corte.signal)
    return () => corte.abort()
  }, [cargar, recarga])

  async function hacer(que: 'preparar' | 'confirmar' | 'deshacer') {
    if (ejercicio === null) return
    setError(null)
    setTrabajando(true)
    try {
      if (que === 'preparar') setVista(await prepararCierre(ejercicio, false, conBorradores))
      else if (que === 'confirmar') await confirmarCierre(ejercicio)
      else await deshacerCierre(ejercicio)
      setRecarga((n) => n + 1)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  if (ejercicio === null) {
    return (
      <Alert color="yellow" title="Sin ejercicio">
        Elige un ejercicio en la cabecera para cerrarlo.
      </Alert>
    )
  }

  const paso = PASOS[estado?.paso ?? 'sin_empezar'] ?? PASOS.sin_empezar
  const puedeCerrar = impedimentos?.se_puede_cerrar === true

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Title order={3}>{`Cierre del ejercicio ${ejercicio}`}</Title>
        {estado !== null && (
          <Badge variant="light" color={paso?.color}>
            {paso?.texto}
          </Badge>
        )}
        {cargando && <Loader size="xs" />}
      </Group>

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {!estado?.cerrado && (
        <Checkbox
          label="Contar los asientos en borrador"
          checked={conBorradores}
          onChange={(e) => setConBorradores(e.currentTarget.checked)}
          disabled={estado?.preparado === true}
        />
      )}

      {impedimentos !== null && !estado?.cerrado && <ListaDeImpedimentos datos={impedimentos} />}

      {vista !== null && (
        <>
          <VistaPreviaCierre vista={vista} alVerBorrador={null} />
          {/* La escribe la API y se enseña tal cual: dice que lo que se está
              viendo no se puede cerrar tal cual. */}
          {vista.provisional && vista.nota !== '' && (
            <Alert color="yellow" role="status">
              {vista.nota}
            </Alert>
          )}
        </>
      )}

      {estado !== null && !estado.cerrado && (
        <Stack gap="sm">
          {estado.preparado && (
            <Alert color="yellow" role="status">
              {AVISO_PREPARADO}
            </Alert>
          )}

          <Group>
            {!estado.preparado && (
              <Button
                disabled={!puedeCerrar || vista?.provisional === true}
                loading={trabajando}
                onClick={() => void hacer('preparar')}
              >
                Preparar el cierre…
              </Button>
            )}
            {estado.preparado && (
              <>
                <Button
                  variant="default"
                  loading={trabajando}
                  onClick={() => void hacer('deshacer')}
                >
                  Deshacer…
                </Button>
                <Button color="red" loading={trabajando} onClick={() => void hacer('confirmar')}>
                  Confirmar el cierre…
                </Button>
              </>
            )}
          </Group>

          {estado.preparado && (
            <Text size="sm" c="dimmed">
              {AVISO_CONFIRMAR}
            </Text>
          )}
        </Stack>
      )}

      <BloqueApertura
        ejercicioCerrado={ejercicio}
        puedePrepararse={estado?.cerrado === true}
        alHecho={() => setRecarga((n) => n + 1)}
      />
    </Stack>
  )
}
