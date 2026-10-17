import {
  Alert,
  Badge,
  Button,
  Fieldset,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { listarDiarios, type DiarioContable } from '../../../api/diarios'
import { textoDeError } from '../../../api/errores'
import {
  comprobarDefinicion,
  crearPlantilla,
  editarPlantilla,
  falloDePlantilla,
  obtenerCatalogo,
  obtenerPlantilla,
  type Catalogo,
  type Definicion,
  type ErrorCampo,
  type EstadoInicial,
} from '../../../api/plantillas'
import { ContextoFormulas } from './ContextoFormulas'
import { definicionParaEnviar, definicionVacia, dondeEsta, erroresPorRuta } from './definicion'
import DialogoProbar from './DialogoProbar'
import DialogoVersiones from './DialogoVersiones'
import SeccionAsientos from './SeccionAsientos'
import SeccionCalculos from './SeccionCalculos'
import SeccionDatos from './SeccionDatos'
import SeccionOpciones from './SeccionOpciones'
import { NOTA } from './notas'

interface Props {
  /** Nulo para una plantilla nueva. */
  idPlantilla: number | null
  /** Para quien no llega a `cierre`: se ve todo, no se cambia nada. */
  soloLectura: boolean
  ancho: number
  ejercicio: number | null
  /** `true` si se ha guardado algo y la lista tiene que refrescarse. */
  alCerrar: (huboCambios: boolean) => void
}

/** En qué pestaña se pinta el error de cada ruta, para contarlos en su título. */
function pestanaDe(ruta: string): string {
  if (ruta.startsWith('parametros')) return 'datos'
  if (ruta.startsWith('variables')) return 'calculos'
  if (ruta.startsWith('asientos')) return 'asientos'
  if (ruta.startsWith('opciones.autocuadre') || ruta.startsWith('opciones.reversion')) return 'opciones'
  return 'cabecera'
}

function Cuenta({ n }: { n: number }) {
  return n > 0 ? (
    <Badge size="xs" color="red" ml={4} circle>
      {n}
    </Badge>
  ) : null
}

/**
 * El editor de una plantilla de asiento. Qué datos pide, qué calcula y qué
 * líneas salen. Comprobar y probar los hace el servidor; aquí no se valida
 * ni se calcula nada.
 */
export default function EditorPlantilla({ idPlantilla, soloLectura, ancho, ejercicio, alCerrar }: Props) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [definicion, setDefinicion] = useState<Definicion>(definicionVacia)
  /** La que hay guardada, tal y como se mandaría: para saber si se ha cambiado. */
  const [guardada, setGuardada] = useState<string | null>(null)
  const [versionActual, setVersionActual] = useState<number | null>(null)
  /** Si se ha cargado una versión anterior desde el historial. */
  const [versionVista, setVersionVista] = useState<number | null>(null)
  const [cargando, setCargando] = useState(idPlantilla !== null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [diarios, setDiarios] = useState<DiarioContable[]>([])
  const [errores, setErrores] = useState<ErrorCampo[]>([])
  const [aviso, setAviso] = useState<{ color: string; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [pestana, setPestana] = useState<string | null>('cabecera')
  const [probando, setProbando] = useState(false)
  const [viendoVersiones, setViendoVersiones] = useState(false)

  useEffect(() => {
    obtenerCatalogo()
      .then(setCatalogo)
      .catch((fallo: unknown) =>
        setAviso({ color: 'yellow', texto: `Sin sugerencias al escribir: ${textoDeError(fallo)}` }),
      )
    listarDiarios(false)
      .then(setDiarios)
      .catch((fallo: unknown) => setErrorCarga(textoDeError(fallo)))
  }, [])

  function cargar(version: number) {
    if (idPlantilla === null) return
    setCargando(true)
    obtenerPlantilla(idPlantilla, version)
      .then((p) => {
        setCodigo(p.codigo)
        setNombre(p.nombre)
        setDescripcion(p.descripcion ?? '')
        setDefinicion(p.definicion)
        setVersionActual(p.version_actual)
        setVersionVista(p.version === p.version_actual ? null : p.version)
        // Lo guardado es la vigente, no la que se está mirando.
        if (version === 0) setGuardada(JSON.stringify(definicionParaEnviar(p.definicion)))
        setErrores([])
        setCargando(false)
      })
      .catch((fallo: unknown) => {
        setErrorCarga(textoDeError(fallo))
        setCargando(false)
      })
  }

  useEffect(() => {
    if (idPlantilla !== null) cargar(0)
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPlantilla])

  const paraEnviar = useMemo(() => definicionParaEnviar(definicion), [definicion])
  const cambiada = guardada !== null && JSON.stringify(paraEnviar) !== guardada
  const porRuta = useMemo(() => erroresPorRuta(errores), [errores])
  const porPestana = useMemo(() => {
    const cuenta: Record<string, number> = {}
    for (const e of errores) cuenta[pestanaDe(e.ruta)] = (cuenta[pestanaDe(e.ruta)] ?? 0) + 1
    return cuenta
  }, [errores])
  const formulas = useMemo(
    () => ({
      catalogo,
      nombres: [
        ...definicion.parametros.map((p) => p.clave),
        ...(definicion.variables ?? []).map((v) => v.clave),
      ].filter((n) => n !== ''),
    }),
    [catalogo, definicion],
  )

  function cambiar(cambios: Partial<Definicion>) {
    setDefinicion((actual) => ({ ...actual, ...cambios }))
    setAviso(null)
  }

  function trasFallo(fallo: unknown) {
    const deLaPlantilla = falloDePlantilla(fallo)
    setErrores(deLaPlantilla?.errores ?? [])
    setAviso({ color: 'red', texto: textoDeError(fallo) })
  }

  function comprobar() {
    setOcupado(true)
    comprobarDefinicion(paraEnviar)
      .then((r) => {
        setErrores(r.errores ?? [])
        setAviso(
          r.valida
            ? { color: 'green', texto: 'La plantilla está bien.' }
            : { color: 'red', texto: 'La plantilla tiene errores: están marcados en su sitio.' },
        )
      })
      .catch(trasFallo)
      .finally(() => setOcupado(false))
  }

  function guardar() {
    setOcupado(true)
    const peticion =
      idPlantilla === null
        ? crearPlantilla({ codigo, nombre, descripcion }, paraEnviar)
        : editarPlantilla(
            idPlantilla,
            nombre,
            descripcion,
            cambiada || versionVista !== null ? paraEnviar : undefined,
          )
    peticion
      .then(() => alCerrar(true))
      .catch(trasFallo)
      .finally(() => setOcupado(false))
  }

  const opciones = definicion.opciones ?? {}
  const titulo =
    idPlantilla === null ? 'Plantilla de asiento nueva' : `Plantilla de asiento ${codigo}`

  return (
    <Modal opened onClose={() => alCerrar(false)} title={titulo} fullScreen>
      {cargando && <Loader size="sm" />}
      {errorCarga && <Alert color="red">{errorCarga}</Alert>}
      {!cargando && (
        <ContextoFormulas.Provider value={formulas}>
          <Stack gap="md">
            {versionVista !== null && (
              <Alert color="blue" p="xs">
                {`Estás viendo la versión ${versionVista}. Si la guardas, pasa a ser la versión ${(versionActual ?? 0) + 1}.`}
              </Alert>
            )}

            {errores.length > 0 && (
              <Alert color="red" p="xs" title="Errores de la plantilla">
                <Stack gap={2}>
                  {errores.map((e, i) => (
                    <Text key={i} size="sm">
                      <b>{dondeEsta(e.ruta, definicion)}</b>: {e.mensaje}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            <Fieldset disabled={soloLectura} variant="unstyled">
              <Tabs value={pestana} onChange={setPestana} keepMounted>
                <Tabs.List>
                  <Tabs.Tab value="cabecera">
                    Cabecera
                    <Cuenta n={porPestana.cabecera ?? 0} />
                  </Tabs.Tab>
                  <Tabs.Tab value="datos">
                    Datos que pide
                    <Cuenta n={porPestana.datos ?? 0} />
                  </Tabs.Tab>
                  <Tabs.Tab value="calculos">
                    Cálculos
                    <Cuenta n={porPestana.calculos ?? 0} />
                  </Tabs.Tab>
                  <Tabs.Tab value="asientos">
                    Asientos
                    <Cuenta n={porPestana.asientos ?? 0} />
                  </Tabs.Tab>
                  <Tabs.Tab value="opciones">
                    Cuadre y reversión
                    <Cuenta n={porPestana.opciones ?? 0} />
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="cabecera" pt="md">
                  <Stack gap="sm" maw={720}>
                    <SimpleGrid cols={2} spacing="sm">
                      <TextInput
                        label="Código"
                        description="Corto y sin espacios. No se puede cambiar después."
                        value={codigo}
                        onChange={(e) => setCodigo(e.currentTarget.value.toUpperCase())}
                        disabled={idPlantilla !== null}
                        maxLength={30}
                        required
                      />
                      <TextInput
                        label="Nombre"
                        description="El que se elige al hacer el asiento."
                        value={nombre}
                        onChange={(e) => setNombre(e.currentTarget.value)}
                        maxLength={150}
                        required
                      />
                    </SimpleGrid>
                    <Textarea
                      label="Descripción"
                      description="Para qué sirve. Se lee al elegirla."
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.currentTarget.value)}
                      maxLength={500}
                      autosize
                      minRows={2}
                    />
                    <SimpleGrid cols={2} spacing="sm">
                      <Select
                        label="Diario"
                        description={NOTA.diario}
                        data={diarios.map((d) => ({
                          value: d.codigo,
                          label: `${d.codigo} · ${d.descripcion ?? ''}`,
                        }))}
                        value={definicion.diario || null}
                        onChange={(diario) => cambiar({ diario: diario ?? '' })}
                        error={porRuta.get('diario')?.join(' ')}
                        searchable
                      />
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>
                          Cómo se graba
                        </Text>
                        <Text size="xs" c="dimmed">
                          {NOTA.comoSeGraba}
                        </Text>
                        <SegmentedControl
                          value={opciones.estado_inicial ?? 'borrador'}
                          onChange={(v) =>
                            cambiar({ opciones: { ...opciones, estado_inicial: v as EstadoInicial } })
                          }
                          data={[
                            { value: 'borrador', label: 'Como borrador' },
                            { value: 'libro', label: 'Directamente en el libro' },
                          ]}
                        />
                      </Stack>
                    </SimpleGrid>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="datos" pt="md">
                  <SeccionDatos
                    parametros={definicion.parametros}
                    ruta="parametros"
                    errores={porRuta}
                    alCambiar={(parametros) => cambiar({ parametros })}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="calculos" pt="md">
                  <SeccionCalculos
                    variables={definicion.variables ?? []}
                    errores={porRuta}
                    alCambiar={(variables) => cambiar({ variables })}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="asientos" pt="md">
                  <SeccionAsientos
                    asientos={definicion.asientos}
                    parametros={definicion.parametros}
                    diarios={diarios}
                    errores={porRuta}
                    alCambiar={(asientos) => cambiar({ asientos })}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="opciones" pt="md">
                  <SeccionOpciones
                    opciones={opciones}
                    errores={porRuta}
                    alCambiar={(o) => cambiar({ opciones: o })}
                  />
                </Tabs.Panel>
              </Tabs>
            </Fieldset>

            {aviso && (
              <Alert color={aviso.color} p="xs">
                {aviso.texto}
              </Alert>
            )}
            {!soloLectura && idPlantilla !== null && cambiada && (
              <Alert color="yellow" p="xs">
                {`Has cambiado lo que hace la plantilla: al guardar se crea la versión ${(versionActual ?? 0) + 1}. Los asientos ya hechos siguen con la versión con que se hicieron.`}
              </Alert>
            )}

            <Group justify="space-between">
              <Group gap="xs">
                {!soloLectura && (
                  <Button variant="default" onClick={comprobar} loading={ocupado}>
                    Comprobar
                  </Button>
                )}
                <Button variant="default" onClick={() => setProbando(true)}>
                  Probar con datos de ejemplo…
                </Button>
                {idPlantilla !== null && (
                  <Button variant="default" onClick={() => setViendoVersiones(true)}>
                    Versiones…
                  </Button>
                )}
              </Group>
              <Group gap="xs">
                <Button variant="default" onClick={() => alCerrar(false)}>
                  {soloLectura ? 'Cerrar' : 'Cancelar'}
                </Button>
                {!soloLectura && (
                  <Button onClick={guardar} loading={ocupado}>
                    Guardar
                  </Button>
                )}
              </Group>
            </Group>
          </Stack>

          {probando && (
            <DialogoProbar
              definicion={paraEnviar}
              ancho={ancho}
              ejercicio={ejercicio}
              alCerrar={() => setProbando(false)}
              alDefinicionRota={(lista) => {
                setErrores(lista)
                setProbando(false)
              }}
            />
          )}
          {viendoVersiones && idPlantilla !== null && (
            <DialogoVersiones
              idPlantilla={idPlantilla}
              alCerrar={() => setViendoVersiones(false)}
              alAbrir={(version) => {
                setViendoVersiones(false)
                cargar(version)
              }}
            />
          )}
        </ContextoFormulas.Provider>
      )}
    </Modal>
  )
}
