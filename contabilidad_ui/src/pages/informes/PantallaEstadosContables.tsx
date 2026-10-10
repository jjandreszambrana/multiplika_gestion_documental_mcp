import { Alert, Group, Stack, Tabs, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { esAbortada } from '../../api/cliente'
import { textoDeError } from '../../api/errores'
import {
  balanceDeSituacion,
  estadosContablesEnExcel,
  estadosContablesEnPdf,
  perdidasYGanancias,
  type BalanceDeSituacion,
  type Detalle,
  type FiltroDeCorte,
  type PerdidasYGanancias,
} from '../../api/informes'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import { guardarFichero, nombreDeFichero } from '../../lib/descarga'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import { guardarPreferencia, leerPreferencia } from '../../lib/preferencias'
import BarraDeEstados from './BarraDeEstados'
import VistaBalanceSituacion from './VistaBalanceSituacion'
import VistaPerdidasYGanancias from './VistaPerdidasYGanancias'

interface Props {
  ejercicio: number | null
  usuario: string
}

/** Lo que se recuerda del filtro. La fecha, como la manda la API. */
interface FiltroGuardado {
  hasta: string
  borradores: boolean
  detalle: Detalle
}

const PREFERENCIA = 'estados_contables.filtro'

/**
 * Los dos estados contables en una sola pantalla, uno por pestaña.
 *
 * **Estuvieron separados hasta el 01/09/2026**, y se juntaron porque el Excel es
 * el mismo fichero para los dos: dos pantallas bajando lo mismo con nombres
 * distintos era una trampa. Ahora el filtro se pone una vez, las dos consultas
 * salen a la vez y hay una sola descarga.
 *
 * Ninguno de los dos se calcula aquí: los saldos, los totales y el resultado los
 * da la API, y en positivo.
 */
export default function PantallaEstadosContables({ ejercicio, usuario }: Props) {
  const guardado = leerPreferencia<FiltroGuardado>(usuario, PREFERENCIA)

  const [hasta, setHasta] = useState<Date | null>(fechaDeApi(guardado?.hasta))
  const [borradores, setBorradores] = useState(guardado?.borradores ?? false)
  const [detalle, setDetalle] = useState<Detalle>(guardado?.detalle ?? 'epigrafes')
  const [consulta, setConsulta] = useState<FiltroDeCorte | null>(null)
  const [balance, setBalance] = useState<BalanceDeSituacion | null>(null)
  const [cuenta, setCuenta] = useState<PerdidasYGanancias | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Cuál se está bajando, si es que hay alguna en marcha. */
  const [bajando, setBajando] = useState<'excel' | 'pdf' | null>(null)

  const cargar = useCallback(
    async (senal: AbortSignal) => {
      if (consulta === null) return
      setCargando(true)
      setError(null)
      try {
        // Las dos a la vez: es un solo filtro, y cambiar de pestaña no puede
        // quedarse esperando a una llamada que no se lanzó.
        const [uno, otro] = await Promise.all([
          balanceDeSituacion(consulta, senal),
          perdidasYGanancias(consulta, senal),
        ])
        setBalance(uno)
        setCuenta(otro)
      } catch (fallo) {
        if (esAbortada(fallo)) return
        setError(textoDeError(fallo))
        setBalance(null)
        setCuenta(null)
      } finally {
        setCargando(false)
      }
    },
    [consulta],
  )

  useEffect(() => {
    const corte = new AbortController()
    void cargar(corte.signal)
    return () => corte.abort()
  }, [cargar])

  function ver() {
    if (ejercicio === null) return
    const filtro = {
      ejercicio,
      hasta: fechaParaApi(hasta),
      incluirBorradores: borradores,
      detalle,
    }
    guardarPreferencia(usuario, PREFERENCIA, { hasta: filtro.hasta, borradores, detalle })
    setConsulta(filtro)
  }

  /**
   * Los dos ficheros dicen lo mismo y se piden igual: cambia el camino y la
   * extensión. El Excel es para trabajarlo; el PDF, para guardarlo y mandarlo.
   */
  async function bajar(que: 'excel' | 'pdf') {
    if (consulta === null) return
    setError(null)
    setBajando(que)
    try {
      const fichero =
        que === 'excel'
          ? await estadosContablesEnExcel(consulta)
          : await estadosContablesEnPdf(consulta)
      guardarFichero(fichero, nombreDeFichero('balance_pyg', que === 'excel' ? 'xlsx' : 'pdf'))
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setBajando(null)
    }
  }

  const hayDatos = balance !== null && cuenta !== null

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Title order={3}>Estados contables</Title>
        <BotonDeAyuda clave="informes" />
      </Group>

      <BarraDeEstados
        hasta={hasta}
        alCambiarHasta={setHasta}
        detalle={detalle}
        alCambiarDetalle={setDetalle}
        borradores={borradores}
        alCambiarBorradores={setBorradores}
        alVer={ejercicio === null ? null : ver}
        alBajar={hayDatos ? (que) => void bajar(que) : null}
        bajando={bajando}
        cargando={cargando}
      />

      {error && (
        <Alert color="red" role="alert" title="No se pudieron cargar los estados contables">
          {error}
        </Alert>
      )}

      {consulta === null && !error && (
        <Text size="sm" c="dimmed">
          Elige la fecha y pulsa Ver.
        </Text>
      )}

      {hayDatos && !error && (
        // Pestañas de verdad, no dos palabras subrayadas: el balance y la
        // cuenta de resultados son dos documentos distintos, y hay que ver de
        // un vistazo en cuál se está.
        <Tabs defaultValue="balance" keepMounted={false} variant="outline" radius="sm">
          <Tabs.List>
            <Tabs.Tab value="balance" fw={600} fz="sm" px="lg">
              Balance de situación
            </Tabs.Tab>
            <Tabs.Tab value="pyg" fw={600} fz="sm" px="lg">
              Pérdidas y ganancias
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="balance" pt="md">
            <VistaBalanceSituacion balance={balance} />
          </Tabs.Panel>

          <Tabs.Panel value="pyg" pt="md">
            <VistaPerdidasYGanancias cuenta={cuenta} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}
