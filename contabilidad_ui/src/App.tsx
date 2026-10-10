import { Alert, Button, Center, Container, Loader, Stack } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { ErrorApi, textoDeError } from './api/errores'
import {
  cerrarSesion,
  conmutar,
  listarEmpresas,
  puedeActivarContabilidad,
  usuarioActual,
  type Empresa,
  type Usuario,
} from './api/sesion'
import Estructura from './components/Estructura'
import PantallaActivar from './pages/empresa/PantallaActivar'
import SelectorEmpresa from './pages/empresa/SelectorEmpresa'
import PantallaLogin from './pages/login/PantallaLogin'

type Estado =
  | { fase: 'arrancando' }
  | { fase: 'login' }
  | { fase: 'eligiendo'; empresas: Empresa[] }
  | { fase: 'sin_contabilidad' }
  | { fase: 'activando'; hayEmpresas: boolean; idInicial?: number }
  | { fase: 'dentro'; empresa: Empresa; nivel: string; puedeConmutar: boolean }
  | { fase: 'error'; mensaje: string }

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: 'arrancando' })
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  /** Un 401 en cualquier punto significa lo mismo: se acabó la sesión. */
  const fallar = useCallback((fallo: unknown) => {
    if (fallo instanceof ErrorApi && fallo.esSinSesion) {
      setEstado({ fase: 'login' })
      return
    }
    setEstado({ fase: 'error', mensaje: textoDeError(fallo) })
  }, [])

  const elegir = useCallback(
    async (empresa: Empresa) => {
      try {
        const { nivel } = await conmutar(empresa.id_obligado)
        setEstado({ fase: 'dentro', empresa, nivel, puedeConmutar: true })
      } catch (fallo) {
        fallar(fallo)
      }
    },
    [fallar],
  )

  const arrancar = useCallback(async () => {
    setEstado({ fase: 'arrancando' })
    try {
      setUsuario(await usuarioActual())

      const { activa, puede_conmutar, empresas = [] } = await listarEmpresas()

      // Sin ninguna empresa el usuario no tiene contabilidad: no hay módulo.
      const primera = empresas[0]
      if (!primera) {
        setEstado({ fase: 'sin_contabilidad' })
        return
      }

      // Quien no puede conmutar (obligado y operario) entra en la suya y ya
      // está: llamar a /sesion/conmutar con su rol daría 403.
      if (!puede_conmutar) {
        setEstado({ fase: 'dentro', empresa: primera, nivel: primera.nivel, puedeConmutar: false })
        return
      }

      const yaActiva = empresas.find((e) => e.id_obligado === activa)
      if (yaActiva) {
        await elegir(yaActiva)
        return
      }

      setEstado({ fase: 'eligiendo', empresas })
    } catch (fallo) {
      fallar(fallo)
    }
  }, [elegir, fallar])

  async function arrancarSelector() {
    try {
      const { empresas = [] } = await listarEmpresas()
      setEstado({ fase: 'eligiendo', empresas })
    } catch (fallo) {
      fallar(fallo)
    }
  }

  async function salir() {
    try {
      await cerrarSesion()
    } finally {
      setUsuario(null)
      setEstado({ fase: 'login' })
    }
  }

  useEffect(() => {
    void arrancar()
  }, [arrancar])

  if (estado.fase === 'arrancando') {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  if (estado.fase === 'login') {
    return <PantallaLogin alEntrar={() => void arrancar()} />
  }

  if (estado.fase === 'eligiendo') {
    return (
      <SelectorEmpresa
        empresas={estado.empresas}
        alElegir={(e) => void elegir(e)}
        alActivarOtra={
          puedeActivarContabilidad(usuario)
            ? () => setEstado({ fase: 'activando', hayEmpresas: true })
            : null
        }
      />
    )
  }

  if (estado.fase === 'activando') {
    return (
      <PantallaActivar
        alActivada={() => void arrancar()}
        alVolver={estado.hayEmpresas ? () => void arrancarSelector() : null}
        idInicial={estado.idInicial}
      />
    )
  }

  if (estado.fase === 'sin_contabilidad') {
    // Quien gestiona empresas puede activarla; el resto solo puede pedirlo.
    if (puedeActivarContabilidad(usuario)) {
      return <PantallaActivar alActivada={() => void arrancar()} alVolver={null} />
    }
    return (
      <Container size="sm" py="xl">
        <Alert color="yellow" title="Sin contabilidad">
          Tu usuario no tiene acceso a la contabilidad de ninguna empresa. Pídeselo a quien
          administre la aplicación.
        </Alert>
      </Container>
    )
  }

  if (estado.fase === 'error') {
    return (
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Alert color="red" title="No se pudo cargar">
            {estado.mensaje}
          </Alert>
          <Button onClick={() => void arrancar()}>Reintentar</Button>
        </Stack>
      </Container>
    )
  }

  const empresaActual = estado.empresa

  return (
    <Estructura
      key={empresaActual.id_obligado}
      empresa={empresaActual}
      nivel={estado.nivel}
      usuario={usuario}
      alCambiarEmpresa={estado.puedeConmutar ? () => void arrancarSelector() : null}
      alSalir={() => void salir()}
      alActivarEsta={
        puedeActivarContabilidad(usuario)
          ? () =>
              setEstado({
                fase: 'activando',
                hayEmpresas: true,
                idInicial: empresaActual.id_obligado,
              })
          : null
      }
    />
  )
}
