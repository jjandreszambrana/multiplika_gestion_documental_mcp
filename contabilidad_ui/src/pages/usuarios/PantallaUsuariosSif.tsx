import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { textoDeError } from '../../api/errores'
import { NIVELES, type Nivel } from '../../api/sesion'
import {
  accesosDe,
  concederAcceso,
  crearUsuario,
  guardarPerfilOperario,
  listarEntidades,
  listarPerfiles,
  listarUsuarios,
  modificarUsuario,
  operarioDe,
  revocarAcceso,
  type AccesoContable,
  type DatosUsuario,
  type Entidad,
  type Operario,
  type Perfil,
  type TipoEntidad,
  type UsuarioSif,
} from '../../api/usuariosSif'

/**
 * Todos los usuarios del SIF, para su superadministrador: datos, rol, a quién
 * pertenece, estado, perfil si es operario y en qué empresas puede entrar a
 * la contabilidad. No se borra a nadie: se desactiva, suspende o cancela.
 */

const ROLES = [
  { value: '1', label: 'Superadministrador' },
  { value: '2', label: 'Administrador' },
  { value: '6', label: 'Desarrollador' },
  { value: '3', label: 'Asesoría' },
  { value: '4', label: 'Empresa' },
  { value: '5', label: 'Operario de una empresa' },
]
const NOMBRE_ROL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))

const ESTADOS = [
  { value: '1', label: 'Activo' },
  { value: '0', label: 'Desactivado' },
  { value: '2', label: 'Suspendido' },
  { value: '3', label: 'Cancelado' },
]
const NOMBRE_ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.value, e.label]))

const NOMBRE_NIVEL: Record<Nivel, string> = {
  consulta: 'Solo consultar',
  apuntes: 'Hacer apuntes',
  cierre: 'También cerrar el ejercicio',
  admin: 'Todo, también dar permisos',
}
const OPCIONES_NIVEL = NIVELES.map((n) => ({ value: n, label: NOMBRE_NIVEL[n] }))

/** A qué cuelga cada rol: el campo del usuario y de dónde salen las opciones. */
function vinculoDe(rol: number): { campo: 'id_obligado' | 'id_representante' | 'id_administrador'; tipo: TipoEntidad; etiqueta: string } | null {
  if (rol === 2 || rol === 6) return { campo: 'id_administrador', tipo: 'administradores', etiqueta: 'Administración' }
  if (rol === 3) return { campo: 'id_representante', tipo: 'asesorias', etiqueta: 'Asesoría' }
  if (rol === 4 || rol === 5) return { campo: 'id_obligado', tipo: 'empresas', etiqueta: 'Empresa' }
  return null
}

function aQuien(u: UsuarioSif): string {
  return u.NombreRazon_obligado || u.NombreRazon_representante || u.NombreRazon_administrador || ''
}

function opcionesDe(lista: Entidad[]) {
  return lista.map((x) => ({
    value: String(x.id),
    label: [x.NombreRazon, x.NIF].filter(Boolean).join(' · ') || `N.º ${x.id}`,
  }))
}

export default function PantallaUsuariosSif() {
  const [usuarios, setUsuarios] = useState<UsuarioSif[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<UsuarioSif | 'nuevo' | null>(null)

  const cargar = useCallback(() => {
    listarUsuarios()
      .then(setUsuarios)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [])
  useEffect(cargar, [cargar])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!usuarios || !texto) return usuarios ?? []
    return usuarios.filter((u) =>
      [u.nombre_real, u.usuario, u.email, aQuien(u)].some((v) => (v ?? '').toLowerCase().includes(texto)),
    )
  }, [usuarios, busqueda])

  return (
    <Stack gap="md">
      <Title order={3}>Usuarios del SIF</Title>
      <Text size="sm" c="dimmed">
        Todos los usuarios del SIF, con sus permisos y su acceso a la contabilidad. Solo lo ve el
        superadministrador.
      </Text>
      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Group>
        <TextInput
          placeholder="Buscar por nombre, usuario, email o empresa"
          value={busqueda}
          onChange={(e) => setBusqueda(e.currentTarget.value)}
          w={360}
        />
        <Button onClick={() => setEditando('nuevo')}>Nuevo usuario</Button>
      </Group>
      {usuarios === null && !error ? (
        <Loader size="sm" />
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Usuario</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Rol</Table.Th>
              <Table.Th>De</Table.Th>
              <Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibles.map((u) => (
              <Table.Tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setEditando(u)}>
                <Table.Td>{u.nombre_real}</Table.Td>
                <Table.Td>{u.usuario}</Table.Td>
                <Table.Td>{u.email}</Table.Td>
                <Table.Td>{NOMBRE_ROL[String(u.id_rol)] ?? `Rol ${u.id_rol}`}</Table.Td>
                <Table.Td>{aQuien(u)}</Table.Td>
                <Table.Td>
                  <Badge color={u.id_estado === 1 ? 'green' : 'gray'} variant="light">
                    {NOMBRE_ESTADO[String(u.id_estado)] ?? u.id_estado}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {editando && (
        <DialogoUsuario
          usuario={editando === 'nuevo' ? null : editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            cargar()
          }}
        />
      )}
    </Stack>
  )
}

interface PropsDialogo {
  usuario: UsuarioSif | null
  alCerrar: () => void
  alGuardar: () => void
}

function DialogoUsuario({ usuario, alCerrar, alGuardar }: PropsDialogo) {
  // Recién creado, sigue abierto en la pestaña de contabilidad.
  const [actual, setActual] = useState<UsuarioSif | null>(usuario)
  return (
    <Modal opened onClose={alCerrar} size="lg" title={actual ? actual.nombre_real : 'Nuevo usuario del SIF'}>
      <Tabs defaultValue="datos" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="datos">Datos y permisos</Tabs.Tab>
          <Tabs.Tab value="contabilidad" disabled={!actual}>
            Acceso a la contabilidad
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="datos" pt="md">
          <FormularioDatos
            usuario={actual}
            alGuardar={(u) => {
              setActual(u)
              alGuardar()
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="contabilidad" pt="md">
          {actual && <AccesosContables usuario={actual} />}
        </Tabs.Panel>
      </Tabs>
    </Modal>
  )
}

function FormularioDatos({ usuario, alGuardar }: { usuario: UsuarioSif | null; alGuardar: (u: UsuarioSif) => void }) {
  const nuevo = usuario === null
  const [datos, setDatos] = useState({
    nombre_real: usuario?.nombre_real ?? '',
    usuario: usuario?.usuario ?? '',
    email: usuario?.email ?? '',
    password: '',
    id_rol: String(usuario?.id_rol ?? 4),
    id_estado: String(usuario?.id_estado ?? 1),
  })
  const vinculo = vinculoDe(Number(datos.id_rol))
  const [aQuienVa, setAQuienVa] = useState<string | null>(() => {
    const v = vinculoDe(usuario?.id_rol ?? 0)
    const id = v && usuario ? usuario[v.campo] : null
    return id ? String(id) : null
  })
  const [opciones, setOpciones] = useState<{ value: string; label: string }[]>([])
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [operario, setOperario] = useState<Operario | null>(null)
  const [perfil, setPerfil] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    setOpciones([])
    if (!vinculo) return
    listarEntidades(vinculo.tipo)
      .then((lista) => setOpciones(opcionesDe(lista)))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [vinculo?.tipo])

  // El perfil de un operario es de su empresa.
  const esOperario = Number(datos.id_rol) === 5
  useEffect(() => {
    setPerfiles([])
    setOperario(null)
    setPerfil(null)
    if (!esOperario || !aQuienVa) return
    const idObligado = Number(aQuienVa)
    listarPerfiles(idObligado)
      .then(setPerfiles)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
    if (usuario) {
      operarioDe(idObligado, usuario.id)
        .then((o) => {
          setOperario(o)
          setPerfil(o ? String(o.id_perfil) : null)
        })
        .catch((fallo: unknown) => setError(textoDeError(fallo)))
    }
  }, [esOperario, aQuienVa, usuario])

  const cambiar = (campo: keyof typeof datos) => (valor: string) => setDatos((d) => ({ ...d, [campo]: valor }))

  async function guardar() {
    setError(null)
    setHecho(null)
    if (vinculo && !aQuienVa) return setError(`Falta elegir la ${vinculo.etiqueta.toLowerCase()}`)
    if (esOperario && !perfil) return setError('Falta elegir qué puede hacer el operario')
    if (nuevo && !datos.password) return setError('Falta la contraseña')
    const cuerpo: DatosUsuario = {
      nombre_real: datos.nombre_real.trim(),
      usuario: datos.usuario.trim(),
      email: datos.email.trim(),
      id_rol: Number(datos.id_rol),
      id_estado: Number(datos.id_estado),
      // Un usuario cuelga como mucho de uno: el resto, a cero.
      id_obligado: 0,
      id_representante: 0,
      id_administrador: 0,
      ...(vinculo ? { [vinculo.campo]: Number(aQuienVa) } : {}),
      ...(datos.password ? { password: datos.password } : {}),
    }
    setTrabajando(true)
    try {
      let id = usuario?.id ?? 0
      if (nuevo) id = (await crearUsuario(cuerpo)).id
      else {
        // Solo lo que cambia: un dato antiguo que ya no pasa la validación del
        // SIF (un usuario corto, p. ej.) no impide cambiar lo demás.
        const cambios = Object.fromEntries(
          Object.entries(cuerpo).filter(([k, v]) => (usuario as unknown as Record<string, unknown>)[k] !== v),
        )
        if (Object.keys(cambios).length) await modificarUsuario(id, cambios)
      }
      const guardado = { ...(usuario ?? {}), ...cuerpo, id } as UsuarioSif
      if (esOperario && perfil && (Number(perfil) !== operario?.id_perfil || !operario)) {
        try {
          await guardarPerfilOperario(Number(aQuienVa), guardado, Number(perfil), operario)
        } catch (fallo) {
          setError(`El usuario se ha guardado, pero no su perfil de operario: ${textoDeError(fallo)}`)
        }
      }
      setDatos((d) => ({ ...d, password: '' }))
      setHecho(nuevo ? 'Usuario creado. Ya puedes darle acceso a la contabilidad.' : 'Cambios guardados.')
      alGuardar(guardado)
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Stack gap="sm">
      {error && <Alert color="red">{error}</Alert>}
      {hecho && <Alert color="green">{hecho}</Alert>}
      <TextInput label="Nombre" value={datos.nombre_real} onChange={(e) => cambiar('nombre_real')(e.currentTarget.value)} />
      <Group grow>
        <TextInput
          label="Usuario para entrar"
          description="Entre 8 y 30 letras o números"
          value={datos.usuario}
          onChange={(e) => cambiar('usuario')(e.currentTarget.value)}
        />
        <TextInput label="Email" value={datos.email} onChange={(e) => cambiar('email')(e.currentTarget.value)} />
      </Group>
      <PasswordInput
        label={nuevo ? 'Contraseña' : 'Contraseña nueva'}
        description={
          nuevo
            ? 'Entre 8 y 30, con mayúscula, minúscula, número y un signo'
            : 'Déjala vacía para no cambiarla'
        }
        value={datos.password}
        onChange={(e) => cambiar('password')(e.currentTarget.value)}
      />
      <Group grow>
        <Select
          label="Rol"
          data={ROLES}
          value={datos.id_rol}
          allowDeselect={false}
          onChange={(v) => {
            if (!v) return
            cambiar('id_rol')(v)
            if (vinculoDe(Number(v))?.tipo !== vinculo?.tipo) setAQuienVa(null)
          }}
        />
        <Select
          label="Estado"
          description="Solo los activos pueden entrar"
          data={ESTADOS}
          value={datos.id_estado}
          allowDeselect={false}
          onChange={(v) => v && cambiar('id_estado')(v)}
        />
      </Group>
      {vinculo && (
        <Select
          label={vinculo.etiqueta}
          data={opciones}
          value={aQuienVa}
          onChange={setAQuienVa}
          searchable
          nothingFoundMessage="No hay ninguna con ese nombre"
          placeholder={opciones.length ? 'Elige' : 'Cargando…'}
        />
      )}
      {esOperario && aQuienVa && (
        <Select
          label="Qué puede hacer el operario"
          data={perfiles.map((p) => ({ value: String(p.id), label: p.nombre || `Perfil ${p.id}` }))}
          value={perfil}
          onChange={setPerfil}
          placeholder={perfiles.length ? 'Elige un perfil' : 'Esta empresa no tiene perfiles de operario'}
        />
      )}
      <Group justify="flex-end">
        <Button onClick={guardar} loading={trabajando}>
          {nuevo ? 'Crear usuario' : 'Guardar'}
        </Button>
      </Group>
    </Stack>
  )
}

function AccesosContables({ usuario }: { usuario: UsuarioSif }) {
  const [accesos, setAccesos] = useState<AccesoContable[] | null>(null)
  const [empresas, setEmpresas] = useState<{ value: string; label: string }[]>([])
  const [empresa, setEmpresa] = useState<string | null>(null)
  const [nivel, setNivel] = useState<string>('consulta')
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(() => {
    accesosDe(usuario.id)
      .then(setAccesos)
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [usuario.id])
  useEffect(cargar, [cargar])
  useEffect(() => {
    listarEntidades('empresas')
      .then((lista) => setEmpresas(opcionesDe(lista)))
      .catch((fallo: unknown) => setError(textoDeError(fallo)))
  }, [])

  async function hacer(accion: () => Promise<unknown>) {
    setError(null)
    setTrabajando(true)
    try {
      await accion()
      cargar()
    } catch (fallo) {
      setError(textoDeError(fallo))
    } finally {
      setTrabajando(false)
    }
  }

  // Estos roles no necesitan permiso: el SIF ya les deja.
  if (usuario.id_rol === 1) {
    return <Text size="sm">El superadministrador entra a la contabilidad de todas las empresas con todos los permisos.</Text>
  }
  const nota =
    usuario.id_rol === 2 || usuario.id_rol === 6
      ? 'Ya entra con todos los permisos en las empresas de su administración. Aquí se le da acceso a otras.'
      : null
  const yaTiene = new Set((accesos ?? []).map((a) => String(a.id_obligado)))

  return (
    <Stack gap="sm">
      {error && <Alert color="red">{error}</Alert>}
      {nota && <Text size="sm" c="dimmed">{nota}</Text>}
      {usuario.id_estado !== 1 && (
        <Alert color="yellow">Este usuario no está activo: aunque tenga acceso, no puede entrar.</Alert>
      )}
      {accesos === null ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">Mirando empresa por empresa…</Text>
        </Group>
      ) : accesos.length === 0 ? (
        <Text size="sm">No tiene acceso a la contabilidad de ninguna empresa.</Text>
      ) : (
        <Table>
          <Table.Tbody>
            {accesos.map((a) => (
              <Table.Tr key={a.id_obligado}>
                <Table.Td>{a.empresa || `Empresa ${a.id_obligado}`}</Table.Td>
                <Table.Td w={230}>
                  <Select
                    data={OPCIONES_NIVEL}
                    value={a.nivel}
                    allowDeselect={false}
                    disabled={trabajando}
                    onChange={(v) => v && v !== a.nivel && hacer(() => concederAcceso(a.id_obligado, usuario.id, v as Nivel))}
                  />
                </Table.Td>
                <Table.Td w={90}>
                  <Button
                    variant="subtle"
                    color="red"
                    size="xs"
                    disabled={trabajando}
                    onClick={() => hacer(() => revocarAcceso(a.id_obligado, usuario.id))}
                  >
                    Quitar
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Group align="flex-end">
        <Select
          label="Darle acceso a otra empresa"
          data={empresas.filter((e) => !yaTiene.has(e.value))}
          value={empresa}
          onChange={setEmpresa}
          searchable
          nothingFoundMessage="No hay ninguna con ese nombre"
          style={{ flex: 1 }}
        />
        <Select data={OPCIONES_NIVEL} value={nivel} onChange={(v) => v && setNivel(v)} allowDeselect={false} w={230} />
        <Button
          disabled={!empresa || trabajando}
          onClick={() =>
            hacer(async () => {
              await concederAcceso(Number(empresa), usuario.id, nivel as Nivel)
              setEmpresa(null)
            })
          }
        >
          Dar acceso
        </Button>
      </Group>
    </Stack>
  )
}
