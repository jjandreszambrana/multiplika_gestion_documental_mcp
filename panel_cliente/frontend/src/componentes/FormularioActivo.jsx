import { useEffect, useState } from "react"
import { Alert, Button, Group, Radio, Select, Stack, Switch, Text, TextInput, Textarea } from "@mantine/core"
import { api } from "../api"
import { AYUDA_CREDENCIAL, MODOS, MODOS_POR_CAPACIDAD, NIVELES, PLATAFORMAS, TIPOS } from "../webs"

// Alta y edición de una web o cuenta. Solo lo ve un administrador: lleva la
// credencial y decide cuánto puede hacer la IA.
export default function FormularioActivo({ proyecto, activo, catalogo, onGuardado, onCancelar }) {
  const [datos, setDatos] = useState(() => ({
    nombre: activo?.nombre || "", tipo: activo?.tipo || "web", plataforma: activo?.plataforma || "wordpress",
    url: activo?.url || "", descripcion: activo?.descripcion || "",
    id_credencial: activo?.id_credencial ? String(activo.id_credencial) : null,
    id_entidad: activo?.id_entidad ? String(activo.id_entidad) : null,
    nivel_permiso: activo?.nivel_permiso || "lectura", pausado: activo?.estado === "pausado",
    modo_conexion: activo?.modo_conexion || null,
  }))
  const [credenciales, setCredenciales] = useState([])
  const [entidades, setEntidades] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listarCredenciales(proyecto.id).then(setCredenciales).catch(() => setCredenciales([]))
    api.listarEntidades(proyecto.id).then(setEntidades).catch(() => setEntidades([]))
  }, [proyecto.id])

  const cambiar = (campo) => (valor) => setDatos((d) => ({ ...d, [campo]: valor }))
  const conectable = catalogo?.plataformas_conectables?.includes(datos.plataforma)
  const capacidad = catalogo?.capacidades?.[datos.plataforma]
  const modos = MODOS_POR_CAPACIDAD[capacidad] || []

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    setError(null)
    const cuerpo = {
      nombre: datos.nombre, tipo: datos.tipo, plataforma: datos.plataforma, url: datos.url || null,
      descripcion: datos.descripcion || null, nivel_permiso: datos.nivel_permiso,
      modo_conexion: modos.length ? datos.modo_conexion || modos[0] : null,
      id_credencial: datos.id_credencial ? Number(datos.id_credencial) : null,
      id_entidad: datos.id_entidad ? Number(datos.id_entidad) : null,
    }
    try {
      let guardado
      if (activo) {
        guardado = await api.actualizarActivo(proyecto.id, activo.id, {
          ...cuerpo, estado: datos.pausado ? "pausado" : "activo",
          quitar_credencial: !datos.id_credencial, quitar_entidad: !datos.id_entidad,
        })
      } else {
        guardado = await api.crearActivo(proyecto.id, cuerpo)
      }
      onGuardado(guardado)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Stack component="form" onSubmit={guardar} gap="sm">
      <TextInput label="Nombre" placeholder="Web corporativa" required value={datos.nombre} onChange={(e) => cambiar("nombre")(e.target.value)} />
      <Group grow>
        <Select label="Tipo" data={Object.entries(TIPOS).map(([value, label]) => ({ value, label }))} value={datos.tipo} onChange={cambiar("tipo")} allowDeselect={false} />
        <Select label="Plataforma" data={Object.entries(PLATAFORMAS).map(([value, label]) => ({ value, label }))} value={datos.plataforma} onChange={cambiar("plataforma")} allowDeselect={false} searchable />
      </Group>
      {!conectable && (
        <Text fz="12.5px" c="dimmed">
          La gestión documental todavía no se conecta con esta plataforma: quedará en el inventario y se podrá conectar cuando esté disponible.
        </Text>
      )}
      <TextInput label="Dirección" placeholder="https://www.miempresa.es" value={datos.url} onChange={(e) => cambiar("url")(e.target.value)} />
      <Textarea label="Descripción" description="Para qué sirve y qué hay que tener en cuenta. La lee la IA." autosize minRows={2} value={datos.descripcion} onChange={(e) => cambiar("descripcion")(e.target.value)} />
      <Select
        label="Credencial de acceso" clearable searchable
        description={AYUDA_CREDENCIAL[capacidad]}
        data={credenciales.map((c) => ({ value: String(c.id), label: c.nombre }))}
        value={datos.id_credencial} onChange={cambiar("id_credencial")}
        nothingFoundMessage="No hay credenciales: créala antes en Administración → Credenciales"
      />
      {modos.length > 0 && (
        <Select label="Forma de conectar" allowDeselect={false} value={datos.modo_conexion || modos[0]} onChange={cambiar("modo_conexion")}
          data={modos.map((m) => ({ value: m, label: MODOS[m] }))} />
      )}
      <Select
        label="Entidad relacionada (opcional)" clearable searchable
        data={entidades.map((e) => ({ value: String(e.id), label: e.nombre }))}
        value={datos.id_entidad} onChange={cambiar("id_entidad")}
      />
      <Radio.Group label="Qué puede hacer la IA" value={datos.nivel_permiso} onChange={cambiar("nivel_permiso")}>
        <Stack gap={6} mt={6}>
          {Object.entries(NIVELES).map(([valor, n]) => (
            <Radio key={valor} value={valor} label={n.etiqueta} description={n.ayuda} />
          ))}
        </Stack>
      </Radio.Group>
      {activo && (
        <Switch label="En pausa (no se le hace ningún cambio)" checked={datos.pausado} onChange={(e) => cambiar("pausado")(e.currentTarget.checked)} />
      )}
      {error && <Alert color="red">{error}</Alert>}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" loading={guardando}>{activo ? "Guardar" : "Dar de alta"}</Button>
      </Group>
    </Stack>
  )
}
