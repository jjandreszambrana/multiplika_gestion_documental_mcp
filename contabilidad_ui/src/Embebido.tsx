import { Alert, Loader } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import '@mantine/dates/styles.css'
// Nombres de meses y días en español en todos los calendarios. Sin esto salen
// en inglés, que es el idioma que trae dayjs de serie.
import 'dayjs/locale/es'
import 'mantine-react-table/styles.css'
import { useEffect, useState } from 'react'
import { configurarCliente } from './api/cliente'
import { textoDeError } from './api/errores'
import { listarEmpresas, type Empresa } from './api/sesion'
import Estructura from './components/Estructura'

/** Lo que el panel anfitrión pone en cada llamada: su dirección, su sesión y la renovación del token. */
export interface SesionAnfitrion {
  base: () => string
  cabeceras: () => Record<string, string>
  capturarTokenRenovado: (respuesta: Response) => void
}

export interface PropsEmbebido {
  sesion: SesionAnfitrion
  idProyecto: number
  /** Número de la empresa en la GD: va en la dirección del proxy, que elige con qué acceso al SIF se habla. */
  idEmpresa?: number
  /** Id de la empresa en su SIF. */
  idObligado: number
  nombreEmpresa: string
  nif?: string | null
  /** Si no se pasa, se pregunta a `/contabilidad/sesion/empresas`. */
  nivel?: string
  ejercicio?: number
}

/**
 * Las pantallas de contabilidad dentro del panel de la GD: sin login, sin
 * `AppShell` y sin selector de empresa. Las llamadas van por el proxy de la GD,
 * que añade la empresa y la sesión del SIF del usuario.
 *
 * Se monta dentro del `MantineProvider` del panel; aquí solo se añade el
 * `DatesProvider` en español. No se importa `index.css`: su `height: 100%`
 * sobre html y body es de la app independiente.
 */
export default function Embebido({
  sesion,
  idProyecto,
  idEmpresa,
  idObligado,
  nombreEmpresa,
  nif = null,
  nivel,
  ejercicio,
}: PropsEmbebido) {
  // En el render y no en un efecto: los efectos de las pantallas corren antes
  // que los de este componente y sus primeras llamadas saldrían sin configurar.
  configurarCliente({
    prefijo: `${sesion.base()}/proyectos/${idProyecto}/contabilidad/sif/proxy/${idEmpresa ?? idObligado}`,
    cabeceras: sesion.cabeceras,
    trasRespuesta: sesion.capturarTokenRenovado,
  })

  const [nivelSif, setNivelSif] = useState<string | null>(nivel ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    if (nivel) {
      setNivelSif(nivel)
      return
    }
    setNivelSif(null)
    let vigente = true
    listarEmpresas()
      .then(({ empresas = [] }) => {
        if (!vigente) return
        const suya = empresas.find((e) => e.id_obligado === idObligado)
        if (suya) setNivelSif(suya.nivel)
        else setError('Tu usuario no tiene acceso a la contabilidad de esta empresa.')
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
    return () => {
      vigente = false
    }
  }, [nivel, idObligado, idProyecto])

  if (error) {
    return (
      <Alert color="red" title="No se pudo cargar la contabilidad de esta empresa">
        {error}
      </Alert>
    )
  }
  if (!nivelSif) return <Loader size="sm" />

  const empresa: Empresa = {
    id_obligado: idObligado,
    NombreRazon: nombreEmpresa,
    NIF: nif,
    nivel: nivelSif,
  }

  return (
    <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
      <Estructura
        key={`${idProyecto}.${idObligado}`}
        embebido
        empresa={empresa}
        nivel={nivelSif}
        usuario={null}
        alCambiarEmpresa={null}
        alSalir={null}
        alActivarEsta={null}
        ejercicioInicial={ejercicio}
      />
    </DatesProvider>
  )
}
