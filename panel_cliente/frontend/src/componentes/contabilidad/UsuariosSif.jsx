import { useEffect, useState } from "react"
import {
  Alert, Badge, Button, Group, Loader, Modal, PasswordInput, Select, Stack, Table, Tabs, Text, TextInput,
} from "@mantine/core"
import { api } from "../../api"

// Gestión de los usuarios del SIF desde un acceso: lo que ese usuario del SIF
// pueda gestionar según su rol. Los permisos los pone el SIF; aquí solo se
// esconde lo que su rol no puede hacer. No se borra nunca: solo se desactiva.

const ROLES_ADMINISTRADOR = [2, 6]
const NIVELES = [
  { value: "consulta", label: "Solo consultar" },
  { value: "apuntes", label: "Hacer apuntes" },
  { value: "cierre", label: "También cerrar el ejercicio" },
  { value: "admin", label: "Todo, también dar permisos" },
]
const NOMBRE_NIVEL = Object.fromEntries(NIVELES.map((n) => [n.value, n.label]))

// Qué tipos de usuario puede dar de alta cada rol, y a qué cuelga cada uno:
// `lista` = hay que elegirlo; `propio` = el mismo del que da el alta.
function tiposQuePuedeCrear(yo) {
  const rol = yo?.id_rol
  if (rol === 1) return [
    { rol: 2, etiqueta: "De un administrador", campo: "id_administrador", lista: "administradores" },
    { rol: 3, etiqueta: "De una asesoría", campo: "id_representante", lista: "asesorias" },
    { rol: 4, etiqueta: "De una empresa", campo: "id_obligado", lista: "empresas" },
  ]
  if (ROLES_ADMINISTRADOR.includes(rol)) return [
    { rol, etiqueta: "De tu administración", campo: "id_administrador", propio: true },
    { rol: 3, etiqueta: "De una asesoría", campo: "id_representante", lista: "asesorias" },
    { rol: 4, etiqueta: "De una empresa", campo: "id_obligado", lista: "empresas" },
  ]
  if (rol === 3) return [
    { rol: 3, etiqueta: "De tu asesoría", campo: "id_representante", propio: true },
    { rol: 4, etiqueta: "De una empresa que lleváis", campo: "id_obligado", lista: "empresas" },
  ]
  if (rol === 4) return [{ rol: 4, etiqueta: "De tu empresa", campo: "id_obligado", propio: true }]
  return []
}

function aQuien(u) {
  return u.NombreRazon_obligado || u.NombreRazon_representante || u.NombreRazon_administrador || ""
}

function FormularioUsuario({ proyecto, acceso, yo, usuario, onHecho, onCancelar }) {
  const tipos = tiposQuePuedeCrear(yo)
  const nuevo = !usuario
  const [datos, setDatos] = useState({
    nombre_real: usuario?.nombre_real || "", usuario: usuario?.usuario || "", email: usuario?.email || "", password: "",
  })
  const [tipo, setTipo] = useState(tipos[0])
  const [opciones, setOpciones] = useState([])
  const [aQuienVa, setAQuienVa] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    setAQuienVa(null)
    setOpciones([])
    if (!nuevo || !tipo?.lista) return
    api.verUsuariosSif(proyecto.id, acceso.id, tipo.lista)
      .then((r) => setOpciones((r.registros || []).map((x) => ({
        value: String(x.id), label: [x.NombreRazon, x.NIF].filter(Boolean).join(" · ") || `N.º ${x.id}`,
      }))))
      .catch((err) => setError(err.message))
  }, [tipo, nuevo, proyecto.id, acceso.id])

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.currentTarget.value })

  const guardar = () => {
    setTrabajando(true)
    setError(null)
    let peticion
    if (nuevo) {
      const vinculo = tipo.propio ? yo[tipo.campo] : Number(aQuienVa)
      peticion = api.cambiarUsuariosSif(proyecto.id, acceso.id, "crear", {
        ...datos, id_rol: tipo.rol, id_estado: 1, [tipo.campo]: vinculo,
      })
    } else {
      const cambios = { id: usuario.id, nombre_real: datos.nombre_real, email: datos.email }
      if (datos.password) cambios.password = datos.password
      peticion = api.cambiarUsuariosSif(proyecto.id, acceso.id, "modificar", cambios)
    }
    peticion.then(onHecho).catch((err) => setError(err.message)).finally(() => setTrabajando(false))
  }

  const falta = !datos.nombre_real || !datos.email || (nuevo && (!datos.usuario || !datos.password || (tipo?.lista && !aQuienVa)))
  return (
    <Stack gap="sm">
      {nuevo && tipos.length > 1 && (
        <Select
          id="usuario-sif-tipo" label="Tipo de usuario" allowDeselect={false}
          data={tipos.map((t, i) => ({ value: String(i), label: t.etiqueta }))}
          value={String(tipos.indexOf(tipo))} onChange={(v) => setTipo(tipos[Number(v)])}
        />
      )}
      {nuevo && tipo?.lista && (
        <Select
          id="usuario-sif-vinculo" searchable label={tipo.lista === "empresas" ? "Empresa" : tipo.lista === "asesorias" ? "Asesoría" : "Administrador"}
          data={opciones} value={aQuienVa} onChange={setAQuienVa} nothingFoundMessage="No hay ninguna"
        />
      )}
      <TextInput id="usuario-sif-nombre" label="Nombre y apellidos" value={datos.nombre_real} onChange={cambiar("nombre_real")} />
      <TextInput id="usuario-sif-email" label="Correo electrónico" value={datos.email} onChange={cambiar("email")} />
      {nuevo && (
        <TextInput
          id="usuario-sif-usuario" label="Usuario para entrar" description="De 8 a 30 letras o números, sin espacios"
          value={datos.usuario} onChange={cambiar("usuario")}
        />
      )}
      <PasswordInput
        id="usuario-sif-contrasena" label={nuevo ? "Contraseña" : "Contraseña nueva (déjala vacía para no cambiarla)"}
        description="De 8 a 30 caracteres, con mayúscula, minúscula, número y un signo como ! o ?"
        value={datos.password} onChange={cambiar("password")}
      />
      {error && <Alert color="red">{error}</Alert>}
      <Group>
        <Button onClick={guardar} loading={trabajando} disabled={falta}>{nuevo ? "Dar de alta" : "Guardar"}</Button>
        <Button variant="default" onClick={onCancelar}>Cancelar</Button>
      </Group>
    </Stack>
  )
}

function PermisosContabilidad({ proyecto, acceso, usuarios }) {
  const [empresas, setEmpresas] = useState(null)
  const [idEmpresa, setIdEmpresa] = useState(null)
  const [permisos, setPermisos] = useState(null)
  const [quien, setQuien] = useState(null)
  const [nivel, setNivel] = useState("consulta")
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    api.empresasContables(proyecto.id)
      .then((r) => setEmpresas((r.empresas || []).filter((e) => e.id_acceso === acceso.id && e.nivel === "admin")))
      .catch((err) => setError(err.message))
  }, [proyecto.id, acceso.id])

  const cargar = (id) => {
    setPermisos(null)
    if (!id) return
    api.verUsuariosSif(proyecto.id, acceso.id, "permisos", id)
      .then((r) => setPermisos(r.accesos || []))
      .catch((err) => setError(err.message))
  }
  useEffect(() => cargar(idEmpresa), [idEmpresa]) // eslint-disable-line react-hooks/exhaustive-deps

  const ejecutar = (accion, datos) => {
    setTrabajando(true)
    setError(null)
    api.cambiarUsuariosSif(proyecto.id, acceso.id, accion, { id_empresa: Number(idEmpresa), ...datos })
      .then(() => { setQuien(null); cargar(idEmpresa) })
      .catch((err) => setError(err.message))
      .finally(() => setTrabajando(false))
  }

  const nombres = Object.fromEntries((usuarios || []).map((u) => [u.id, `${u.nombre_real} (${u.usuario})`]))
  if (!empresas) return error ? <Alert color="red">{error}</Alert> : <Loader size="sm" />
  if (!empresas.length) {
    return <Text c="dimmed">Con este acceso no puedes dar permisos de contabilidad en ninguna empresa.</Text>
  }
  return (
    <Stack gap="sm">
      <Select
        id="permisos-sif-empresa" searchable label="Empresa" placeholder="Elige una empresa"
        data={empresas.map((e) => ({ value: String(e.id_empresa), label: e.nombre }))}
        value={idEmpresa} onChange={setIdEmpresa}
      />
      {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      {idEmpresa && !permisos && <Loader size="sm" />}
      {permisos && (
        <>
          <Table striped verticalSpacing="xs">
            <Table.Tbody>
              {permisos.filter((p) => p.estado === 1).map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.id_usuario ? nombres[p.id_usuario] || `Usuario n.º ${p.id_usuario}` : "Toda la asesoría"}</Table.Td>
                  <Table.Td>{NOMBRE_NIVEL[p.nivel] || p.nivel}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs" variant="subtle" color="red" loading={trabajando}
                      onClick={() => ejecutar("revocar", p.id_usuario ? { id_usuario: p.id_usuario } : { id_representante: p.id_representante })}
                    >
                      Quitar
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {!permisos.some((p) => p.estado === 1) && <Text c="dimmed">Nadie tiene permiso en esta empresa.</Text>}
          <Group align="flex-end">
            <Select
              id="permisos-sif-usuario" searchable label="Dar permiso a" placeholder="Elige un usuario" style={{ flex: 1 }}
              data={(usuarios || []).filter((u) => u.id_estado === 1).map((u) => ({ value: String(u.id), label: nombres[u.id] }))}
              value={quien} onChange={setQuien}
            />
            <Select id="permisos-sif-nivel" label="Para" data={NIVELES} value={nivel} onChange={setNivel} allowDeselect={false} />
            <Button disabled={!quien} loading={trabajando} onClick={() => ejecutar("conceder", { id_usuario: Number(quien), nivel })}>
              Dar permiso
            </Button>
          </Group>
        </>
      )}
    </Stack>
  )
}

export default function UsuariosSif({ proyecto, acceso, onCerrar }) {
  const [yo, setYo] = useState(null)
  const [usuarios, setUsuarios] = useState(null)
  const [editando, setEditando] = useState(undefined) // undefined: lista; null: alta; objeto: edición
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(null)

  const cargar = () =>
    api.verUsuariosSif(proyecto.id, acceso.id, "listar")
      .then((r) => setUsuarios(r.registros || []))
      .catch((err) => { setUsuarios([]); setError(err.message) })

  useEffect(() => {
    api.verUsuariosSif(proyecto.id, acceso.id, "yo").then((r) => setYo(r.user || {})).catch((err) => setError(err.message))
    cargar()
  }, [proyecto.id, acceso.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const activar = (u, activo) => {
    setTrabajando(u.id)
    setError(null)
    api.cambiarUsuariosSif(proyecto.id, acceso.id, "modificar", { id: u.id, id_estado: activo ? 1 : 0 })
      .then(cargar).catch((err) => setError(err.message)).finally(() => setTrabajando(null))
  }

  const puedeGestionar = yo && tiposQuePuedeCrear(yo).length > 0
  return (
    <Modal opened onClose={onCerrar} size="xl" title={<Text fw={600}>Usuarios del SIF · {acceso.nombre_sif || acceso.usuario_sif}</Text>}>
      {!yo || usuarios === null ? (
        error ? <Alert color="red">{error}</Alert> : <Loader size="sm" />
      ) : !puedeGestionar ? (
        <Text>Tu usuario del SIF no puede gestionar usuarios.</Text>
      ) : editando !== undefined ? (
        <FormularioUsuario
          proyecto={proyecto} acceso={acceso} yo={yo} usuario={editando}
          onHecho={() => { setEditando(undefined); cargar() }} onCancelar={() => setEditando(undefined)}
        />
      ) : (
        <Tabs defaultValue="usuarios">
          <Tabs.List>
            <Tabs.Tab value="usuarios">Usuarios</Tabs.Tab>
            <Tabs.Tab value="permisos">Permisos de contabilidad</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="usuarios" pt="sm">
            <Stack gap="sm">
              {error && <Alert color="red" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Tbody>
                  {usuarios.map((u) => (
                    <Table.Tr key={u.id}>
                      <Table.Td>
                        <Text fz="sm" fw={500}>{u.nombre_real}</Text>
                        <Text fz="xs" c="dimmed">{u.usuario} · {u.email}</Text>
                      </Table.Td>
                      <Table.Td><Text fz="sm">{u.rol}{aQuien(u) && ` · ${aQuien(u)}`}</Text></Table.Td>
                      <Table.Td>
                        <Badge color={u.id_estado === 1 ? "green" : "gray"} variant="light">
                          {u.id_estado === 1 ? "Activo" : "Desactivado"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Button size="xs" variant="subtle" onClick={() => setEditando(u)}>Cambiar</Button>
                          {u.id !== yo.id && (
                            <Button
                              size="xs" variant="subtle" color={u.id_estado === 1 ? "red" : "green"}
                              loading={trabajando === u.id} onClick={() => activar(u, u.id_estado !== 1)}
                            >
                              {u.id_estado === 1 ? "Desactivar" : "Activar"}
                            </Button>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Group>
                <Button variant="light" onClick={() => setEditando(null)}>Dar de alta un usuario</Button>
              </Group>
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="permisos" pt="sm">
            <PermisosContabilidad proyecto={proyecto} acceso={acceso} usuarios={usuarios} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Modal>
  )
}
