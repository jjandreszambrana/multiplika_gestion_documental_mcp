import { Alert, Button, Group, Loader, Modal, Select, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  ejecutar,
  falloDePlantilla,
  listarPlantillas,
  obtenerPlantilla,
  type Ejecucion,
  type Fuente,
  type Plantilla,
  type ResumenPlantilla,
} from '../../api/plantillas'
import BotonDeAyuda from '../../components/BotonDeAyuda'
import FormularioPlantilla from './FormularioPlantilla'
import { usePrevisualizacion } from './usePrevisualizacion'

/** Lo que se ha grabado, para el aviso del diario. */
export interface Hecho {
  aviso: string
  /** El borrador que se puede abrir; nulo si se apuntó en el libro. */
  idBorrador: number | null
}

interface Props {
  abierto: boolean
  /** Dígitos de una subcuenta en esta empresa. */
  ancho: number
  alCerrar: () => void
  alHecho: (hecho: Hecho) => void
}

function hechoDe(ejecucion: Ejecucion): Hecho {
  if (ejecucion.estado === 'borrador') {
    return {
      aviso: 'Borrador creado. Lo tienes en Sin confirmar.',
      idBorrador: ejecucion.asientos[0]?.id_borrador ?? null,
    }
  }
  const numeros = ejecucion.asientos.map((a) => a.asiento)
  return {
    aviso:
      numeros.length === 1
        ? `Asiento ${numeros[0]} apuntado en el libro.`
        : `Asientos ${numeros.join(', ')} apuntados en el libro.`,
    idBorrador: null,
  }
}

/**
 * Un asiento hecho con una plantilla. El contable rellena los datos y a la
 * derecha ve el asiento que sale, calculado por el servidor a cada cambio. Lo
 * que se ve es lo que se graba: el servidor lo vuelve a calcular al grabar, y
 * si entretanto alguien ha cambiado la plantilla, no graba.
 */
export default function DialogoAsientoPredefinido({ abierto, ancho, alCerrar, alHecho }: Props) {
  const [plantillas, setPlantillas] = useState<ResumenPlantilla[] | null>(null)
  const [errorLista, setErrorLista] = useState<string | null>(null)
  const [idElegido, setIdElegido] = useState<number | null>(null)
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null)
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null)
  /** Sube para volver a pedir la plantilla, tras cambiarla otra persona. */
  const [recarga, setRecarga] = useState(0)
  const [grabando, setGrabando] = useState(false)
  const [errorGrabar, setErrorGrabar] = useState<string | null>(null)

  // La lista se pide cada vez que se abre: alguien ha podido crear una.
  useEffect(() => {
    if (!abierto) return
    setPlantillas(null)
    setErrorLista(null)
    listarPlantillas()
      .then(setPlantillas)
      .catch((fallo: unknown) => setErrorLista(textoDeError(fallo)))
  }, [abierto])

  useEffect(() => {
    setErrorPlantilla(null)
    if (idElegido === null) {
      setPlantilla(null)
      return
    }
    let vigente = true
    obtenerPlantilla(idElegido)
      .then((p) => vigente && setPlantilla(p))
      .catch((fallo: unknown) => vigente && setErrorPlantilla(textoDeError(fallo)))
    return () => {
      vigente = false
    }
  }, [idElegido, recarga])

  const fuente = useMemo<Fuente | null>(
    () => (plantilla === null ? null : { id: plantilla.id }),
    [plantilla],
  )
  const parametros = useMemo(() => plantilla?.definicion.parametros ?? [], [plantilla])
  // Por la plantilla, no por su versión: si se recarga una versión nueva, lo
  // tecleado se queda.
  const estado = usePrevisualizacion(fuente, parametros, String(plantilla?.id ?? ''))
  const { previa, pendiente, errorPrevia } = estado

  function cerrar() {
    setIdElegido(null)
    setErrorGrabar(null)
    alCerrar()
  }

  const sePuedeGrabar =
    plantilla !== null &&
    previa !== null &&
    previa.valido &&
    !pendiente &&
    !grabando &&
    errorPrevia === null

  function grabar() {
    if (plantilla === null) return
    setGrabando(true)
    setErrorGrabar(null)
    ejecutar(plantilla.id, plantilla.version, estado.paraEnviar())
      .then((r) => {
        setGrabando(false)
        setIdElegido(null)
        alHecho(hechoDe(r))
      })
      .catch((fallo: unknown) => {
        setGrabando(false)
        const deLaPlantilla = falloDePlantilla(fallo)
        if (deLaPlantilla?.clave === 'plantilla_datos' && deLaPlantilla.errores.length > 0) {
          // Los datos: cada error en su sitio, como al previsualizar.
          estado.fijarErrores(deLaPlantilla.errores)
          return
        }
        const mensajes = deLaPlantilla?.errores.map((e) => e.mensaje) ?? []
        setErrorGrabar([textoDeError(fallo), ...mensajes].join('\n'))
        // Sin lista de errores es que la plantilla ha cambiado o se ha
        // retirado: se vuelve a pedir para enseñar la que hay ahora.
        if (deLaPlantilla !== null && deLaPlantilla.clave === null) setRecarga((n) => n + 1)
      })
  }

  const alLibro = (previa?.estadoInicial ?? plantilla?.definicion.opciones?.estado_inicial) === 'libro'

  const selector = plantillas && plantillas.length > 0 && (
    <>
      <Select
        label="Plantilla"
        placeholder="Elige una plantilla"
        data={plantillas.map((p) => ({ value: String(p.id), label: p.nombre }))}
        value={idElegido === null ? null : String(idElegido)}
        onChange={(v) => {
          setErrorGrabar(null)
          setIdElegido(v === null ? null : Number(v))
        }}
        searchable
        data-autofocus
      />
      {plantilla?.descripcion && (
        <Text size="sm" c="dimmed">
          {plantilla.descripcion}
        </Text>
      )}
      {errorPlantilla && <Alert color="red">{errorPlantilla}</Alert>}
      {idElegido !== null && !plantilla && !errorPlantilla && <Loader size="sm" />}
    </>
  )

  return (
    <Modal
      opened={abierto}
      onClose={cerrar}
      title={
        <Group gap="xs">
          <Text fw={600}>Asiento predefinido</Text>
          <BotonDeAyuda clave="plantillas_de_asiento" />
        </Group>
      }
      size="90%"
    >
      <Stack gap="md">
        {errorLista && <Alert color="red">{errorLista}</Alert>}
        {!plantillas && !errorLista && <Loader size="sm" />}
        {plantillas?.length === 0 && (
          <Text size="sm" c="dimmed">
            Esta empresa no tiene asientos predefinidos todavía.
          </Text>
        )}

        {plantillas && plantillas.length > 0 && (
          <FormularioPlantilla
            parametros={parametros}
            estado={estado}
            ancho={ancho}
            cabecera={selector}
          />
        )}

        {errorGrabar && (
          <Alert color="red" style={{ whiteSpace: 'pre-line' }}>
            {errorGrabar}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={cerrar}>
            Cancelar
          </Button>
          {plantilla && (
            <Button onClick={grabar} disabled={!sePuedeGrabar} loading={grabando}>
              {alLibro ? 'Apuntar en el libro' : 'Crear borrador'}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
