import { Alert, AppShell, Box, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { textoDeError } from '../api/errores'
import { obtenerConfiguracion, type Configuracion } from '../api/configuracion'
import {
  listarEjercicios,
  usuarioActual,
  type Empresa,
  type Ejercicio,
  type Usuario,
} from '../api/sesion'
import CampanaAvisos from './CampanaAvisos'
import CabeceraEmpresa from './CabeceraEmpresa'
import PantallaDiario from '../pages/diario/PantallaDiario'
import PantallaConfiguracion from '../pages/configuracion/PantallaConfiguracion'
import PantallaConexiones from '../pages/conexiones/PantallaConexiones'
import PantallaEjercicios from '../pages/ejercicios/PantallaEjercicios'
import PantallaEliminados from '../pages/eliminados/PantallaEliminados'
import PantallaEnlace from '../pages/maestros/PantallaEnlace'
import PantallaImportador from '../pages/importador/PantallaImportador'
import PantallaCierre from '../pages/cierre/PantallaCierre'
import PantallaBalance from '../pages/informes/PantallaBalance'
import PantallaDeclaraciones from '../pages/fiscal/PantallaDeclaraciones'
import PantallaFiscal from '../pages/fiscal/PantallaFiscal'
import PantallaEstadosContables from '../pages/informes/PantallaEstadosContables'
import PantallaMayor from '../pages/informes/PantallaMayor'
import PantallaInmovilizado from '../pages/inmovilizado/PantallaInmovilizado'
import PantallaSinFicha from '../pages/inmovilizado/PantallaSinFicha'
import PantallaPlan from '../pages/plan/PantallaPlan'
import PantallaPlantillas from '../pages/plantillas/PantallaPlantillas'
import PantallaTraspasos from '../pages/traspasos/PantallaTraspasos'
import PantallaBandeja from '../pages/bandeja/PantallaBandeja'
import { EMITIDAS, RECIBIDAS } from '../api/contabilizar'
import { compiladoEl } from '../lib/compilacion'
import MenuModulo from './MenuModulo'
import RedDeSeguridad from './RedDeSeguridad'
import { ProveedorCuadre } from './CuadreEnMemoria'
import { ProveedorPlan } from './PlanEnMemoria'
import SelectorEjercicio from './SelectorEjercicio'
import { SECCIONES, SECCION_DE_ENTRADA } from './secciones'
import { guardarPreferencia, leerPreferencia } from '../lib/preferencias'

interface Props {
  empresa: Empresa
  nivel: string
  usuario: Usuario | null
  alCambiarEmpresa: (() => void) | null
  /** Nulo dentro del panel de la GD: la sesión es la del panel. */
  alSalir: (() => void) | null
  /** Nulo para quien no puede activar contabilidades. */
  alActivarEsta: (() => void) | null
  /**
   * Dentro del panel de la GD: sin `AppShell` de pantalla completa, el menú y
   * el contenido caben en la zona que les deje el panel.
   */
  embebido?: boolean
  /** Ejercicio con el que entrar; si no está en la lista, se cae al de siempre. */
  ejercicioInicial?: number
}

const ALTO_CABECERA = 64
const PREFERENCIA_EJERCICIO = 'sesion.ejercicio'
const ANCHO_MENU = 220

/** Marco del módulo: cabecera con la empresa y el ejercicio, y menú lateral. */
export default function Estructura({
  empresa,
  nivel,
  usuario,
  alCambiarEmpresa,
  alSalir,
  alActivarEsta,
  embebido = false,
  ejercicioInicial,
}: Props) {
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [ejercicios, setEjercicios] = useState<Ejercicio[] | null>(null)
  const [ejercicio, setEjercicio] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Con qué ejercicio se estaba trabajando la última vez, en este equipo y en
  // esta empresa. Si ya no está en la lista se cae al más reciente.
  const quienGuarda = `${usuario?.usuario ?? 'anonimo'}.${empresa.id_obligado}`
  // Se lee una sola vez, al entrar: si se releyera en cada render, guardarlo
  // volvería a disparar la carga de la configuración.
  const [recordado] = useState(
    () => ejercicioInicial ?? leerPreferencia<number>(quienGuarda, PREFERENCIA_EJERCICIO),
  )
  const [errorEjercicios, setErrorEjercicios] = useState<string | null>(null)
  const [seccion, setSeccion] = useState(SECCION_DE_ENTRADA)
  // Al llegar desde un traspaso, el diario se abre con sus borradores a la vista.
  const [aBorradores, setABorradores] = useState(false)
  const elegirSeccion = useCallback((id: string) => {
    setABorradores(false)
    setSeccion(id)
  }, [])
  const irABorradores = useCallback(() => {
    setABorradores(true)
    setSeccion('asientos')
  }, [])
  // Dentro de la GD no llega el usuario: se pregunta al SIF quién es la
  // clave con la que se entra. Si falla, se esconde lo que depende del rol.
  const [rolSif, setRolSif] = useState<number | null>(usuario?.id_rol ?? null)
  useEffect(() => {
    if (usuario) return
    usuarioActual()
      .then((u) => setRolSif(u.id_rol ?? null))
      .catch(() => setRolSif(null))
  }, [usuario])

  // Tras abrir, bloquear o desbloquear un ejercicio: la cabecera y la pantalla
  // leen la misma lista, así que se rehace una sola vez y aquí.
  const recargarEjercicios = useCallback(() => {
    listarEjercicios()
      .then((lista) => {
        setEjercicios(lista)
        setErrorEjercicios(null)
        // Si el elegido ya no está, se cae al más reciente.
        setEjercicio((actual) =>
          actual !== null && lista.some((e) => e.ejercicio === actual)
            ? actual
            : (lista[0]?.ejercicio ?? null),
        )
      })
      .catch((fallo: unknown) => setErrorEjercicios(textoDeError(fallo)))
  }, [])

  // La configuración se pide una sola vez por empresa, no en cada pantalla.
  useEffect(() => {
    Promise.all([obtenerConfiguracion(), listarEjercicios()])
      .then(([config, lista]) => {
        setConfiguracion(config)
        setEjercicios(lista)
        // Vienen del más reciente al más antiguo: se entra en el último que
        // se usó, y si ese ya no está, en el primero.
        setEjercicio(
          recordado !== null && lista.some((e) => e.ejercicio === recordado)
            ? recordado
            : (lista[0]?.ejercicio ?? null),
        )
      })
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
    // Solo al entrar: `recordado` se fija en el primer render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ejercicio !== null) guardarPreferencia(quienGuarda, PREFERENCIA_EJERCICIO, ejercicio)
  }, [quienGuarda, ejercicio])

  const etiqueta = SECCIONES.find((s) => s.id === seccion)?.etiqueta ?? ''

  const cabeceraEmpresa = (
    <CabeceraEmpresa
      empresa={empresa}
      nivel={nivel}
      usuario={usuario}
      alCambiarEmpresa={alCambiarEmpresa}
      alSalir={alSalir}
    />
  )

  const selectorYAvisos = (
    <Group gap="sm" wrap="nowrap">
      {ejercicios && ejercicios.length > 0 && (
        <SelectorEjercicio
          ejercicios={ejercicios}
          elegido={ejercicio}
          alElegir={setEjercicio}
        />
      )}
      {configuracion && <CampanaAvisos configuracion={configuracion} />}
    </Group>
  )

  const menu = (
    <MenuModulo nivel={nivel} rol={rolSif} activa={seccion} alElegir={elegirSeccion} />
  )

  const contenido = (
    <RedDeSeguridad llave={`${seccion}.${ejercicio ?? ""}`}>
      {error && (
        <Alert color="red" title="No se pudo cargar la contabilidad de esta empresa" mb="md">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{error}</Text>
            {alActivarEsta && (
              <Button size="xs" onClick={alActivarEsta}>
                Activar la contabilidad de esta empresa
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {!ejercicios && !error && <Loader size="sm" />}
      {ejercicios?.length === 0 && !error && (
        <Alert color="yellow" title="Sin ejercicios" mb="md">
          Esta empresa no tiene ningún ejercicio abierto todavía.
        </Alert>
      )}
      {ejercicios &&
        configuracion &&
        (seccion === 'asientos' ? (
          <PantallaDiario
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            cierre={ejercicios.find((e) => e.ejercicio === ejercicio)?.cierre ?? null}
            nivel={nivel}
            ancho={configuracion.anchocuentas}
            usuario={usuario?.usuario ?? 'anonimo'}
            conBorradoresAbiertos={aBorradores}
          />
        ) : seccion === 'plan' ? (
          <PantallaPlan
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            nivel={nivel}
            ancho={configuracion.anchocuentas}
          />
        ) : seccion === 'plantillas' ? (
          <PantallaPlantillas
            nivel={nivel}
            ancho={configuracion.anchocuentas}
            ejercicio={ejercicio}
            nombreEmpresa={empresa.NombreRazon ?? 'esta empresa'}
            conIA={embebido}
          />
        ) : seccion === 'eliminados' ? (
          <PantallaEliminados
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            usuario={usuario?.usuario ?? 'anonimo'}
          />
        ) : seccion === 'enlace' ? (
          <PantallaEnlace
            nivel={nivel}
            ancho={configuracion.anchocuentas}
            origenTerceros={configuracion.origen_terceros}
          />
        ) : seccion === 'ejercicios' ? (
          <PantallaEjercicios
            ejercicios={ejercicios}
            nivel={nivel}
            error={errorEjercicios}
            alRecargar={recargarEjercicios}
          />
        ) : seccion === 'configuracion' ? (
          <PantallaConfiguracion
            configuracion={configuracion}
            ejercicio={ejercicio}
            alGuardada={setConfiguracion}
          />
        ) : seccion === 'conexiones' ? (
          <PantallaConexiones
            idObligado={empresa.id_obligado}
            nombreEmpresa={empresa.NombreRazon ?? 'esta empresa'}
          />
        ) : seccion === 'inmovilizado' ? (
          <PantallaInmovilizado
            ejercicio={ejercicio}
            nivel={nivel}
            ancho={configuracion.anchocuentas}
          />
        ) : seccion === 'mayor' ? (
          <PantallaMayor
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            ancho={configuracion.anchocuentas}
            nivel={nivel}
            usuario={usuario?.usuario ?? 'anonimo'}
          />
        ) : seccion === 'balance' ? (
          <PantallaBalance
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            ancho={configuracion.anchocuentas}
            usuario={usuario?.usuario ?? 'anonimo'}
          />
        ) : seccion === 'estados_contables' ? (
          <PantallaEstadosContables
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            usuario={usuario?.usuario ?? 'anonimo'}
          />
        ) : seccion === 'fiscal' ? (
          <PantallaFiscal
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            usuario={usuario?.usuario ?? 'anonimo'}
          />
        ) : seccion === 'declaraciones' ? (
          <PantallaDeclaraciones
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            nivel={nivel}
          />
        ) : seccion === 'cierre' ? (
          <PantallaCierre key={ejercicio ?? 'sin-ejercicio'} ejercicio={ejercicio} />
        ) : seccion === 'sin_ficha' ? (
          <PantallaSinFicha
            nivel={nivel}
            ancho={configuracion.anchocuentas}
            ejercicio={ejercicio}
          />
        ) : seccion === 'importador' ? (
          <PantallaImportador ejercicio={ejercicio} nivel={nivel} />
        ) : seccion === 'traspaso_emitidas' || seccion === 'traspaso_recibidas' ? (
          <PantallaTraspasos
            key={`${seccion}.${ejercicio ?? 'sin-ejercicio'}`}
            ejercicio={ejercicio}
            tipo={seccion === 'traspaso_emitidas' ? EMITIDAS : RECIBIDAS}
            nivel={nivel}
            ancho={configuracion.anchocuentas}
            alVerBorradores={irABorradores}
          />
        ) : seccion === 'bandeja' ? (
          <PantallaBandeja
            key={ejercicio ?? 'sin-ejercicio'}
            ejercicio={ejercicio}
            nivel={nivel}
            nombreEmpresa={empresa.NombreRazon ?? ''}
            alVerBorradores={irABorradores}
          />
        ) : (
          <Text c="dimmed">{etiqueta}: pantalla pendiente.</Text>
        ))}
    </RedDeSeguridad>
  )

  if (embebido) {
    return (
      <ProveedorCuadre>
        <ProveedorPlan ejercicio={ejercicio}>
          <Box>
            <Group
              justify="space-between"
              wrap="nowrap"
              pb="xs"
              mb="md"
              style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
            >
              {cabeceraEmpresa}
              {selectorYAvisos}
            </Group>
            <Group align="flex-start" wrap="nowrap" gap="md">
              <Box
                w={ANCHO_MENU}
                style={{ flexShrink: 0, borderRight: '1px solid var(--mantine-color-default-border)' }}
                pr="xs"
              >
                {menu}
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>{contenido}</Box>
            </Group>
          </Box>
        </ProveedorPlan>
      </ProveedorCuadre>
    )
  }

  return (
    <ProveedorCuadre>
      <ProveedorPlan ejercicio={ejercicio}>
        <AppShell
          header={{ height: ALTO_CABECERA }}
          navbar={{ width: ANCHO_MENU, breakpoint: 'sm' }}
          padding="md"
        >
          <AppShell.Header>
            <Group justify="space-between" h="100%" px="md" wrap="nowrap">
              {cabeceraEmpresa}
              {selectorYAvisos}
            </Group>
          </AppShell.Header>

          <AppShell.Navbar p="xs">
            {menu}
            {/* Al pie del menú, no del contenido: así se ve siempre, sin
                depender de lo largo que sea el listado que haya puesto. */}
            <Text size="xs" c="dimmed" mt="auto" pt="xs" ta="center">
              {`Compilado el ${compiladoEl()}`}
            </Text>
          </AppShell.Navbar>

          <AppShell.Main>{contenido}</AppShell.Main>
        </AppShell>
      </ProveedorPlan>
    </ProveedorCuadre>
  )
}
