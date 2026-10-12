import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
} from '@mantine/core'
import { useState, type FormEvent } from 'react'
import type { Conexion, DatosNueva, Tunel } from '../../api/conexiones'
import { textoDeError } from '../../api/errores'

interface Props {
  /** Nula para crear una nueva. */
  conexion: Conexion | null
  /** Los túneles que este servidor tiene permitidos. Nunca vacía: sin túneles no se abre. */
  tuneles: Tunel[]
  nombreEmpresa: string
  alCerrar: () => void
  /** Recibe lo que hay que mandar; la contraseña solo si se ha escrito. */
  alGuardar: (datos: DatosNueva) => Promise<void>
}

/**
 * Los datos de la conexión. Lo mismo para crearla que para cambiarla: el SIF
 * solo la desactiva si cambia de verdad el destino, así que se manda todo.
 */
export default function DialogoConexion({
  conexion,
  tuneles,
  nombreEmpresa,
  alCerrar,
  alGuardar,
}: Props) {
  const opciones = (conexion?.opciones ?? {}) as { marcar?: boolean }
  const [nombre, setNombre] = useState(conexion?.nombre ?? `Codiplika de ${nombreEmpresa}`)
  // Con un solo túnel no hay nada que elegir: se deja puesto.
  const [tunel, setTunel] = useState<string | null>(
    conexion?.tunel ?? (tuneles.length === 1 ? (tuneles[0]?.nombre ?? null) : null),
  )
  const [host, setHost] = useState(conexion?.host ?? '127.0.0.1')
  const [puerto, setPuerto] = useState<number | string>(conexion?.puerto ?? 3306)
  const [baseDatos, setBaseDatos] = useState(conexion?.base_datos ?? '')
  const [usuario, setUsuario] = useState(conexion?.usuario ?? '')
  const [password, setPassword] = useState('')
  const [marcar, setMarcar] = useState(opciones.marcar ?? false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Si el túnel guardado ya no está permitido, se enseña igual para no
  // dejar el desplegable en blanco; al guardar el SIF dirá lo que pasa.
  const opcionesTunel = tuneles.map((t) => ({ value: t.nombre, label: `${t.nombre} → ${t.destino}` }))
  if (conexion?.tunel && !tuneles.some((t) => t.nombre === conexion.tunel)) {
    opcionesTunel.push({ value: conexion.tunel, label: `${conexion.tunel} (ya no permitido)` })
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!tunel) {
      setError('Falta elegir por dónde se llega a Codiplika.')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      await alGuardar({
        tipo: 'codiplika',
        nombre: nombre.trim(),
        tunel,
        host: host.trim(),
        puerto: Number(puerto),
        base_datos: baseDatos.trim(),
        usuario: usuario.trim(),
        ...(password !== '' && { password }),
        opciones: { marcar },
      })
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal
      opened
      onClose={alCerrar}
      title={conexion ? 'Cambiar la conexión con Codiplika' : 'Conectar con Codiplika'}
      size="lg"
      centered
    >
      <form onSubmit={(e) => void enviar(e)}>
        <Stack gap="md">
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}

          <TextInput
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.currentTarget.value)}
            required
          />

          <Select
            label="Por dónde se llega a Codiplika"
            data={opcionesTunel}
            value={tunel}
            onChange={setTunel}
            required
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Nombre de la base de datos"
              value={baseDatos}
              onChange={(e) => setBaseDatos(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Servidor de la base"
              description="Casi siempre 127.0.0.1"
              value={host}
              onChange={(e) => setHost(e.currentTarget.value)}
              required
            />
            <NumberInput
              label="Puerto"
              description="Casi siempre 3306"
              value={puerto}
              onChange={setPuerto}
              min={1}
              max={65535}
              allowDecimal={false}
              required
            />
          </SimpleGrid>
          <PasswordInput
            label="Contraseña"
            placeholder={conexion?.tiene_password ? 'Guardada. Escribe otra solo para cambiarla' : ''}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />

          <Checkbox
            label="Marcar en Codiplika lo que se exporte, para que no vuelva a salir"
            description="Es lo que saldrá marcado al traer; cada vez se puede cambiar."
            checked={marcar}
            onChange={(e) => setMarcar(e.currentTarget.checked)}
          />

          {conexion?.activa === 1 && (
            <Alert color="gray">
              Si cambias a dónde se conecta, la conexión se apaga hasta que la pruebes y la
              actives otra vez.
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={alCerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
