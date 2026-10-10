import { Alert, Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core'
import { CasillaFecha } from '../../components/CasillaFecha'
import { useEffect, useMemo, useState } from 'react'
import {
  confirmarBorrador,
  crearBorrador,
  editarBorrador,
  eliminarBorrador,
  obtenerBorrador,
  type Confirmacion,
} from '../../api/borradores'
import { listarDiarios, type DiarioContable } from '../../api/diarios'
import { textoDeError } from '../../api/errores'
import { alcanza } from '../../api/sesion'
import DialogoCuentaAlVuelo from './DialogoCuentaAlVuelo'
import DialogoNuevoDiario from './DialogoNuevoDiario'
import { fechaDeApi, fechaParaApi } from '../../lib/fecha'
import {
  desdeApi,
  lineaVacia,
  paraEnviar,
  loQueFalta,
  tieneAlgo,
  totalesDe,
  type LineaEnEdicion,
} from './lineas'
import PieDeCuadre from './PieDeCuadre'
import TablaLineas from './TablaLineas'
import ModalMayor from '../informes/ModalMayor'

interface Props {
  abierto: boolean
  ejercicio: number | null
  nivel: string
  ancho: number
  /** Nulo para empezar uno nuevo; el id, para seguir con uno a medias. */
  idBorrador: number | null
  /**
   * `huboCambios` dice si algo llegó a escribirse en el servidor: cerrar sin
   * tocar nada no tiene por qué obligar a nadie a recargar su listado.
   */
  alCerrar: (huboCambios: boolean) => void
  alConfirmado: (confirmacion: Confirmacion) => void
}

const LINEAS_AL_EMPEZAR = 4

export default function EditorAsiento({
  abierto,
  ejercicio,
  nivel,
  ancho,
  idBorrador,
  alCerrar,
  alConfirmado,
}: Props) {
  const [id, setId] = useState<number | null>(idBorrador)
  const [fecha, setFecha] = useState<Date | null>(null)
  const [diario, setDiario] = useState<string | null>(null)
  const [concepto, setConcepto] = useState('')
  /** El número que ya tiene el borrador. Cero mientras no tenga ninguno. */
  const [asiento, setAsiento] = useState(0)
  const [lineas, setLineas] = useState<LineaEnEdicion[]>([])
  /** La cuenta cuyo mayor se está mirando, sin salir del asiento. */
  const [mayorDe, setMayorDe] = useState('')
  const [diarios, setDiarios] = useState<DiarioContable[]>([])
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [creandoDiario, setCreandoDiario] = useState(false)
  const [cuentaNueva, setCuentaNueva] = useState<string | null>(null)
  /** Foto de lo que se cargó, para saber si se ha tocado algo desde entonces. */
  const [comoEstaba, setComoEstaba] = useState('')

  const puedeCrearDiario = alcanza(nivel, 'cierre')

  const totales = useMemo(() => totalesDe(lineas), [lineas])

  const ahora = useMemo(
    () => JSON.stringify({ fecha: fechaParaApi(fecha), diario, concepto, lineas }),
    [fecha, diario, concepto, lineas],
  )
  const hayCambios = comoEstaba !== '' && ahora !== comoEstaba

  useEffect(() => {
    if (!abierto) return
    listarDiarios(false)
      .then((lista) => {
        setDiarios(lista)
        setDiario((antes) => antes ?? lista[0]?.codigo ?? null)
      })
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    setError(null)
    setId(idBorrador)

    if (idBorrador === null) {
      const enBlanco = Array.from({ length: LINEAS_AL_EMPEZAR }, lineaVacia)
      const hoy = new Date()
      setFecha(hoy)
      setConcepto('')
      setAsiento(0)
      setLineas(enBlanco)
      setComoEstaba('')
      return
    }

    obtenerBorrador(idBorrador)
      .then((borrador) => {
        setFecha(fechaDeApi(borrador.fecha))
        setDiario(borrador.diario)
        setConcepto(borrador.concepto)
        setAsiento(borrador.asiento)
        const suyas = desdeApi(borrador.lineas ?? [])
        // Al abrir un borrador guardado, una línea en blanco al final para
        // seguir tecleando sin tener que pedirla.
        const puestas =
          suyas.length > 0
            ? [...suyas, lineaVacia()]
            : Array.from({ length: LINEAS_AL_EMPEZAR }, lineaVacia)
        setLineas(puestas)
        setComoEstaba(
          JSON.stringify({
            fecha: borrador.fecha,
            diario: borrador.diario,
            concepto: borrador.concepto,
            lineas: puestas,
          }),
        )
      })
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [abierto, idBorrador])

  function pedirCerrar() {
    if (hayCambios) {
      setDescartando(true)
      return
    }
    alCerrar(false)
  }

  function cambiar(clave: number, campo: keyof LineaEnEdicion, valor: string) {
    setLineas((antes) => {
      const cambiadas = antes.map((linea) =>
        linea.clave === clave ? { ...linea, [campo]: valor } : linea,
      )
      // En cuanto la última línea tiene algo, se pone otra debajo: se teclea un
      // asiento seguido, sin parar a pedir sitio. Solo se añade una, porque la
      // recién puesta pasa a ser la última y está vacía.
      const ultima = cambiadas[cambiadas.length - 1]
      return ultima && tieneAlgo(ultima) ? [...cambiadas, lineaVacia()] : cambiadas
    })
  }

  function quitar(clave: number) {
    setLineas((antes) => antes.filter((linea) => linea.clave !== clave))
  }

  /** Lo que se manda: las líneas en blanco del final no viajan. */
  function datos() {
    return {
      ejercicio: ejercicio ?? new Date().getFullYear(),
      fecha: fechaParaApi(fecha),
      diario: diario ?? '',
      concepto: concepto.trim(),
      lineas: paraEnviar(lineas.filter(tieneAlgo)),
    }
  }

  /** Guarda y devuelve el id, que hace falta para confirmar acto seguido. */
  async function guardar(): Promise<number> {
    const guardado = id === null ? await crearBorrador(datos()) : await editarBorrador(id, datos())
    setId(guardado.id)
    return guardado.id
  }

  async function alGuardar() {
    // Una línea a medias se para aquí: guardarla dejaría un borrador que luego
    // no se puede confirmar y hay que volver a buscar.
    const falta = loQueFalta(lineas)
    if (falta !== null) {
      setError(falta)
      return
    }
    setError(null)
    setTrabajando(true)
    try {
      await guardar()
      alCerrar(true)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  async function alConfirmar() {
    setError(null)
    setTrabajando(true)
    try {
      // Se guarda antes: confirmar trabaja sobre lo que hay en el servidor, no
      // sobre lo que se ve en pantalla.
      alConfirmado(await confirmarBorrador(await guardar()))
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  function ponerCuentaCreada(codigo: string) {
    setLineas((antes) => {
      const enBlanco = antes.find((l) => l.cuenta.trim() === '' || l.cuenta === codigo)
      if (enBlanco === undefined) return antes
      return antes.map((l) => (l.clave === enBlanco.clave ? { ...l, cuenta: codigo } : l))
    })
  }

  async function alEliminar() {
    if (id === null) {
      alCerrar(false)
      return
    }
    setError(null)
    setTrabajando(true)
    try {
      await eliminarBorrador(id)
      setBorrando(false)
      alCerrar(true)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <>
      {/* El número va en el título: un borrador puede nacer ya con él, y es por
          el que se le busca en el diario y en el mayor. */}
      <Modal
        opened={abierto}
        onClose={pedirCerrar}
        size="90%"
        padding="lg"
        title={asiento > 0 ? `Asiento ${asiento}` : 'Asiento'}
      >
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <Group align="flex-end" gap="md">
            <CasillaFecha
              label="Fecha"
              value={fecha}
              onChange={setFecha}
              w={160}
            />
            <Select
              label="Diario"
              data={diarios.map((d) => ({
                value: d.codigo,
                label: `${d.codigo} · ${d.descripcion}`,
              }))}
              value={diario}
              onChange={setDiario}
              allowDeselect={false}
              w={240}
            />
            {puedeCrearDiario && (
              <Button variant="default" onClick={() => setCreandoDiario(true)} pb={0}>
                Nuevo diario…
              </Button>
            )}
            <TextInput
              label="Concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
          </Group>

          <TablaLineas
            lineas={lineas}
            ancho={ancho}
            alCambiar={cambiar}
            alQuitar={quitar}
            alCrearCuenta={setCuentaNueva}
            alVerMayor={setMayorDe}
          />

          <Group justify="space-between" align="flex-start">
            <Button
              variant="default"
              size="xs"
              onClick={() => setLineas((a) => [...a, lineaVacia()])}
            >
              Añadir línea
            </Button>
            <PieDeCuadre totales={totales} />
          </Group>

          <Group justify="space-between">
            <Button variant="subtle" color="red" onClick={() => setBorrando(true)}>
              Eliminar…
            </Button>
            <Group>
              {/*
                Confirmar mete el asiento en el libro y no hay vuelta atrás: no
                se puede modificar ni eliminar. Por eso va discreto, a la
                izquierda del que se pulsa a diario, y pregunta antes.
              */}
              <Stack gap={2} align="center">
                <Button
                  variant="subtle"
                  onClick={() => setConfirmando(true)}
                  disabled={!totales.cuadra || trabajando}
                >
                  Confirmar…
                </Button>
                {!totales.cuadra && (
                  <Text fz="xs" c="red">
                    El asiento no cuadra
                  </Text>
                )}
              </Stack>
              <Button variant="default" onClick={pedirCerrar}>
                Cancelar
              </Button>
              <Button onClick={alGuardar} loading={trabajando}>
                Guardar borrador
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={confirmando} onClose={() => setConfirmando(false)} title="Confirmar" centered>
        <Stack gap="md">
          <Text size="sm">
            El asiento va a entrar en el libro y ya no se podrá modificar ni eliminar.
            ¿Confirmar?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setConfirmando(false)
                void alConfirmar()
              }}
              loading={trabajando}
            >
              Confirmar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={descartando} onClose={() => setDescartando(false)} title="Cerrar" centered>
        <Stack gap="md">
          <Text size="sm">
            Se van a perder los cambios que no has guardado. ¿Cerrar de todas formas?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDescartando(false)}>
              Seguir aquí
            </Button>
            <Button
              color="red"
              onClick={() => {
                setDescartando(false)
                // Se tira lo tecleado: en el servidor no ha cambiado nada.
                alCerrar(false)
              }}
            >
              Cerrar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <DialogoNuevoDiario
        abierto={creandoDiario}
        alCerrar={() => setCreandoDiario(false)}
        alCreado={(nuevo) => {
          setCreandoDiario(false)
          setDiarios((antes) => [...antes, nuevo])
          setDiario(nuevo.codigo)
        }}
      />

      <ModalMayor cuenta={mayorDe} ejercicio={ejercicio} alCerrar={() => setMayorDe('')} />

      <DialogoCuentaAlVuelo
        codigo={cuentaNueva}
        ejercicio={ejercicio}
        alCerrar={() => setCuentaNueva(null)}
        alCreada={(cuenta) => {
          ponerCuentaCreada(cuenta.codigo)
          setCuentaNueva(null)
        }}
      />

      <Modal opened={borrando} onClose={() => setBorrando(false)} title="Eliminar" centered>
        <Stack gap="md">
          <Text size="sm">
            Se va a eliminar este asiento a medias. No queda copia porque nunca llegó al libro.
            ¿Seguir?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBorrando(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={alEliminar} loading={trabajando}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
