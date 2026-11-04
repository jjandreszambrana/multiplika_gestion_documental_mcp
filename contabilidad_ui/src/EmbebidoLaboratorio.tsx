import { Alert, Loader } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import '@mantine/dates/styles.css'
import 'dayjs/locale/es'
import { useEffect, useState } from 'react'
import { textoDeError } from './api/errores'
import { configurarLaboratorio, estadoLaboratorio, type EstadoLaboratorio } from './api/laboratorio'
import type { SesionAnfitrion } from './Embebido'
import PantallaLaboratorio from './pages/laboratorio/PantallaLaboratorio'

export interface PropsEmbebidoLaboratorio {
  sesion: SesionAnfitrion
  idProyecto: number
  /** Número de la empresa en la GD: va en la dirección del proxy. */
  idEmpresa: number
  /** Pantalla que se enseña (la elige el menú del panel): muestras, facturar, catalogos o portal. */
  seccion: string
}

/**
 * El laboratorio dentro del panel de la GD. Es independiente de la
 * contabilidad: tiene su propio proxy y su propia conexión al SIF.
 */
export default function EmbebidoLaboratorio({ sesion, idProyecto, idEmpresa, seccion }: PropsEmbebidoLaboratorio) {
  // En el render y no en un efecto: los efectos de las pantallas corren antes.
  configurarLaboratorio({
    prefijo: `${sesion.base()}/proyectos/${idProyecto}/laboratorio/sif/proxy/${idEmpresa}`,
    cabeceras: sesion.cabeceras,
    trasRespuesta: sesion.capturarTokenRenovado,
  })

  const [estado, setEstado] = useState<EstadoLaboratorio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    estadoLaboratorio()
      .then(setEstado)
      .catch((f: unknown) => setError(textoDeError(f)))
  }, [vuelta])

  return (
    <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
      {error ? (
        <Alert color="red" title="No se pudo cargar el laboratorio">
          {error}
        </Alert>
      ) : estado === null ? (
        <Loader size="sm" />
      ) : estado === 'no' ? (
        <Alert color="yellow" title="Esta empresa no tiene el laboratorio">
          El laboratorio no está habilitado para esta empresa en el SIF. Pídeselo a quien administre el SIF.
        </Alert>
      ) : (
        <PantallaLaboratorio seccion={seccion} estado={estado} alActivado={() => setVuelta((n) => n + 1)} />
      )}
    </DatesProvider>
  )
}
