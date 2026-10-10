import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  camposDe,
  crearModelo,
  editarModelo,
  mapeoDelModelo,
  opcionesDelModelo,
  OPCIONES_POR_DEFECTO,
  type CampoImportable,
  type Destino,
  type Modelo,
  type Opciones,
} from '../../api/importador'
import MapeoPorPosicion, { mapeoDeOrden, ordenDeMapeo } from './MapeoPorPosicion'

const DESTINOS = [
  { value: 'plan', label: 'Cuentas del plan' },
  { value: 'diario', label: 'Apuntes del diario' },
  { value: 'inmovilizado', label: 'Bienes de inmovilizado' },
]

/** Los cuatro que lee el servidor. Vacío = que lo detecte él. */
const SEPARADORES = [
  { value: '', label: 'Que lo detecte solo' },
  { value: '|', label: 'Barra vertical ( | )' },
  { value: ';', label: 'Punto y coma ( ; )' },
  { value: '\t', label: 'Tabulador' },
  { value: ',', label: 'Coma ( , )' },
]

/** Las tres que lee el servidor. */
const CODIFICACIONES = [
  { value: 'utf-8', label: 'Normal (UTF-8)' },
  { value: 'cp1252', label: 'Windows antiguo (ANSI)' },
  { value: 'latin-1', label: 'Europa occidental (Latin-1)' },
]

const SI_EXISTE = [
  { value: 'omitir', label: 'Dejar el que hay' },
  { value: 'actualizar', label: 'Sustituirlo' },
  { value: 'error', label: 'Parar y avisar' },
]

interface Props {
  abierto: boolean
  /** Nulo = modelo nuevo. */
  modelo: Modelo | null
  alCerrar: () => void
  alGuardado: () => void
}

/** Alta y modificación de un modelo. El destino no se cambia una vez creado. */
export default function DialogoModelo({ abierto, modelo, alCerrar, alGuardado }: Props) {
  const [nombre, setNombre] = useState('')
  const [destino, setDestino] = useState<Destino>('plan')
  const [opciones, setOpciones] = useState<Opciones>(OPCIONES_POR_DEFECTO)
  const [orden, setOrden] = useState<string[]>([])
  const [campos, setCampos] = useState<Record<string, CampoImportable>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setError(null)
    setNombre(modelo?.nombre ?? '')
    setDestino((modelo?.destino as Destino) ?? 'plan')
    setOpciones(modelo === null ? OPCIONES_POR_DEFECTO : opcionesDelModelo(modelo))
    setOrden([])
  }, [abierto, modelo])

  // La lista de datos que admite cada destino la da el servidor: aquí no hay
  // ningún campo escrito a mano.
  useEffect(() => {
    if (!abierto) return
    let vigente = true
    camposDe(destino)
      .then((leidos) => {
        if (!vigente) return
        setCampos(leidos)
        // Un modelo nuevo empieza con todos los datos, en el orden del
        // servidor; uno guardado, con el orden que tenía.
        setOrden(
          modelo === null ? Object.keys(leidos) : ordenDeMapeo(mapeoDelModelo(modelo), leidos),
        )
      })
      .catch((fallo: unknown) => vigente && setError(textoDeError(fallo)))
    return () => {
      vigente = false
    }
  }, [abierto, destino, modelo])

  async function guardar() {
    setError(null)
    setGuardando(true)
    try {
      const mapeo = mapeoDeOrden(orden)
      if (modelo === null) await crearModelo(nombre, destino, mapeo, opciones)
      else await editarModelo(modelo.id, nombre, mapeo, opciones)
      alGuardado()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened={abierto}
      onClose={alCerrar}
      title={modelo === null ? 'Nuevo modelo' : 'Modificar el modelo'}
      size="lg"
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}

        <Group align="flex-end" gap="md">
          <TextInput
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.currentTarget.value)}
            w={280}
            data-autofocus
          />
          <Select
            label="Qué se va a importar"
            data={DESTINOS}
            value={destino}
            onChange={(valor) => valor && setDestino(valor as Destino)}
            disabled={modelo !== null}
            description={modelo === null ? undefined : 'Esto no se puede cambiar una vez creado el modelo'}
            allowDeselect={false}
            w={240}
          />
        </Group>

        <Group align="flex-end" gap="md">
          <Select
            label="Separador"
            data={SEPARADORES}
            value={opciones.separador}
            onChange={(valor) => setOpciones({ ...opciones, separador: valor ?? '' })}
            allowDeselect={false}
            w={200}
          />
          <Select
            label="Codificación"
            data={CODIFICACIONES}
            value={opciones.codificacion}
            onChange={(valor) => valor && setOpciones({ ...opciones, codificacion: valor })}
            allowDeselect={false}
            w={230}
          />
          <Select
            label="Si el dato ya existe"
            data={SI_EXISTE}
            value={opciones.si_existe}
            onChange={(valor) => valor && setOpciones({ ...opciones, si_existe: valor })}
            allowDeselect={false}
            w={180}
          />
        </Group>

        <Group align="flex-end" gap="md">
          <NumberInput
            label="Filas que saltar al principio"
            description="Para archivos que empiezan con membrete o líneas en blanco"
            value={opciones.filas_a_saltar}
            onChange={(valor) => setOpciones({ ...opciones, filas_a_saltar: Number(valor) || 0 })}
            min={0}
            w={280}
          />
          <Checkbox
            label="El archivo no trae fila de títulos"
            checked={opciones.sin_cabecera}
            onChange={(e) => setOpciones({ ...opciones, sin_cabecera: e.currentTarget.checked })}
            pb={8}
          />
        </Group>

        <MapeoPorPosicion campos={campos} orden={orden} alCambiar={setOrden} />

        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={nombre.trim() === ''} loading={guardando}>
            Guardar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
