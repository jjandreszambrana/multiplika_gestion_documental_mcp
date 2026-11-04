import { Alert, Badge, Button, CopyButton, Group, Modal, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { textoDeError } from '../../api/errores'
import {
  cambiarActivoUsuarioPortal,
  crearUsuarioPortal,
  eliminarUsuarioPortal,
  listarClientes,
  listarUsuariosPortal,
  restablecerClavePortal,
  type UsuarioConClave,
  type UsuarioPortal,
} from '../../api/laboratorio'
import { fechaHora, useCarga } from './comun'
import Confirmar from './Confirmar'

/** Quién del cliente puede entrar al portal a ver sus informes, y con qué clave. */
export default function PestanaPortal() {
  const [cliente, setCliente] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [conClave, setConClave] = useState<UsuarioConClave | null>(null)
  const [borrar, setBorrar] = useState<UsuarioPortal | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clientes = useCarga(listarClientes, [])
  const usuarios = useCarga(() => listarUsuariosPortal(cliente ? Number(cliente) : undefined), [cliente])
  const nombreDe = (id: number) => clientes.datos?.find((c) => c.value === String(id))?.label ?? ''

  async function hacer(accion: () => Promise<unknown>) {
    setError(null)
    try {
      await accion()
      usuarios.recargar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    }
  }

  return (
    <Stack gap="md">
      <Group align="flex-end">
        <Select label="Cliente" data={clientes.datos ?? []} value={cliente} onChange={setCliente} searchable clearable placeholder="Todos" w={320} />
        <Button ml="auto" onClick={() => setNuevo(true)}>
          Nuevo usuario
        </Button>
      </Group>

      {(error || usuarios.error) && <Alert color="red">{error ?? usuarios.error}</Alert>}

      <Table highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Cliente</Table.Th>
            <Table.Th>Usuario</Table.Th>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Último acceso</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(usuarios.datos ?? []).map((u) => (
            <Table.Tr key={u.id}>
              <Table.Td>{nombreDe(u.id_receptor)}</Table.Td>
              <Table.Td>{u.usuario}</Table.Td>
              <Table.Td>{u.nombre}</Table.Td>
              <Table.Td>{fechaHora(u.ultimo_acceso)}</Table.Td>
              <Table.Td>
                {u.activo ? u.debe_cambiar_clave ? <Badge color="yellow">Aún no ha cambiado la clave</Badge> : <Badge color="teal">Activo</Badge> : <Badge color="gray">Desactivado</Badge>}
              </Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap" justify="flex-end">
                  <Button size="compact-xs" variant="light" onClick={() => void hacer(async () => setConClave(await restablecerClavePortal(u.id)))}>
                    Nueva clave
                  </Button>
                  <Button size="compact-xs" variant="light" onClick={() => void hacer(() => cambiarActivoUsuarioPortal(u.id, !u.activo))}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button size="compact-xs" variant="light" color="red" onClick={() => setBorrar(u)}>
                    Eliminar
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!usuarios.cargando && usuarios.datos?.length === 0 && <Text c="dimmed">Todavía no hay usuarios del portal.</Text>}

      {nuevo && (
        <DialogoNuevo
          clientes={clientes.datos ?? []}
          clienteInicial={cliente}
          alCerrar={() => setNuevo(false)}
          alCreado={(u) => {
            setNuevo(false)
            setConClave(u)
            usuarios.recargar()
          }}
        />
      )}
      {conClave && (
        <Modal opened onClose={() => setConClave(null)} title="Clave temporal">
          <Stack gap="sm">
            <Text>
              {`Esta es la clave de ${conClave.usuario}. Anótala o cópiala ahora: no se vuelve a mostrar. Tendrá que cambiarla al entrar.`}
            </Text>
            <Group>
              <Text ff="monospace" fz="lg" fw={700}>
                {conClave.clave_temporal}
              </Text>
              <CopyButton value={conClave.clave_temporal}>
                {({ copied, copy }) => (
                  <Button size="compact-sm" variant="light" onClick={copy}>
                    {copied ? 'Copiada' : 'Copiar'}
                  </Button>
                )}
              </CopyButton>
            </Group>
            <Group justify="flex-end">
              <Button onClick={() => setConClave(null)}>Ya la he anotado</Button>
            </Group>
          </Stack>
        </Modal>
      )}
      {borrar && (
        <Confirmar
          titulo="Eliminar el usuario"
          texto={`${borrar.usuario} dejará de poder entrar al portal. Si solo quieres cortarle el acceso un tiempo, desactívalo.`}
          etiqueta="Eliminar"
          alConfirmar={async () => {
            await eliminarUsuarioPortal(borrar.id)
            usuarios.recargar()
          }}
          alCerrar={() => setBorrar(null)}
        />
      )}
    </Stack>
  )
}

interface PropsNuevo {
  clientes: { value: string; label: string }[]
  clienteInicial: string | null
  alCerrar: () => void
  alCreado: (u: UsuarioConClave) => void
}

function DialogoNuevo({ clientes, clienteInicial, alCerrar, alCreado }: PropsNuevo) {
  const [cliente, setCliente] = useState(clienteInicial)
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    if (!cliente) return
    setGuardando(true)
    setError(null)
    try {
      alCreado(
        await crearUsuarioPortal({
          id_receptor: Number(cliente),
          usuario: usuario.trim(),
          ...(nombre.trim() && { nombre: nombre.trim() }),
          ...(email.trim() && { email: email.trim() }),
        }),
      )
    } catch (fallo) {
      setError(textoDeError(fallo))
      setGuardando(false)
    }
  }

  return (
    <Modal opened onClose={alCerrar} title="Nuevo usuario del portal">
      <Stack gap="sm">
        <Select label="Cliente" data={clientes} value={cliente} onChange={setCliente} searchable withAsterisk />
        <TextInput label="Usuario" description="Entre 3 y 100 caracteres" value={usuario} onChange={(e) => setUsuario(e.currentTarget.value)} withAsterisk />
        <TextInput label="Nombre" value={nombre} onChange={(e) => setNombre(e.currentTarget.value)} />
        <TextInput label="Correo" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button onClick={() => void crear()} loading={guardando} disabled={!cliente || usuario.trim().length < 3}>
            Crear
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
