import { useEffect, useState } from "react"
import { Alert, Anchor, Badge, Button, Group, Modal, MultiSelect, Stack, Table, Text, TextInput, Textarea } from "@mantine/core"
import { api } from "../api"
import { formatearFecha } from "../formato"
import { ESTADOS_PUBLICACION, LIMITE_TEXTO, PLATAFORMAS } from "../webs"

// "2026-10-06T10:00:00" → valor de <input type="datetime-local">
const aLocal = (v) => (v ? String(v).slice(0, 16) : "")

// Crear o ver una publicación del calendario. Nada sale a las redes sin
// aprobar; lo publicado se puede retirar (deshacer).
export default function EditorPublicacion({ proyecto, idPublicacion, idRedInicial, onCerrar, onCambiada, onPropuesta }) {
  const [p, setP] = useState(null)
  const [redes, setRedes] = useState([])
  const [imagenes, setImagenes] = useState([])
  const [form, setForm] = useState({ titulo: "", texto: "", ids_activos: idRedInicial ? [String(idRedInicial)] : [], ids_documentos: [], enlace: "", fecha_prevista: "" })
  const [comentarios, setComentarios] = useState({})
  const [trabajando, setTrabajando] = useState(null)
  const [confirmarRetirar, setConfirmarRetirar] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listarActivos(proyecto.id).then((as) => setRedes(as.filter((a) => a.capacidad === "red"))).catch(() => {})
    api.listarOBuscarDocumentos(proyecto.id).then((ds) => setImagenes(ds.filter((d) => !d.archivado))).catch(() => {})
    if (idPublicacion) {
      api.obtenerPublicacion(proyecto.id, idPublicacion).then((x) => {
        setP(x)
        setForm({ titulo: x.titulo, texto: x.texto, ids_activos: x.ids_activos.map(String), ids_documentos: x.ids_documentos.map(String),
          enlace: x.enlace || "", fecha_prevista: aLocal(x.fecha_prevista) })
      }).catch((err) => setError(err.message))
    }
  }, [proyecto.id, idPublicacion])

  const editable = !p || ["borrador", "pendiente", "aprobada", "error"].includes(p.estado)
  const seleccionadas = redes.filter((r) => form.ids_activos.includes(String(r.id)))
  const limite = Math.min(...seleccionadas.map((r) => LIMITE_TEXTO[r.plataforma] || 5000), 63206)

  function cuerpo(extra = {}) {
    return {
      titulo: form.titulo || null, texto: form.texto, ids_activos: form.ids_activos.map(Number), ids_documentos: form.ids_documentos.map(Number),
      enlace: form.enlace || null, fecha_prevista: form.fecha_prevista ? form.fecha_prevista.replace("T", " ") : null, ...extra,
    }
  }

  async function hacer(accion) {
    setTrabajando(accion)
    setError(null)
    try {
      let r
      if (!p) {
        r = await api.crearPublicacion(proyecto.id, cuerpo({ pedir_aprobacion: accion === "pedir" }))
      } else {
        if (editable && accion !== "cancelar") r = await api.actualizarPublicacion(proyecto.id, p.id, cuerpo())
        if (accion === "pedir" && (r || p).estado === "borrador") r = await api.accionPublicacion(proyecto.id, p.id, "pedir-aprobacion")
        if (accion === "aprobar" || accion === "publicar") r = await api.accionPublicacion(proyecto.id, p.id, "aprobar", { publicar_ya: accion === "publicar" })
        if (accion === "cancelar") r = await api.accionPublicacion(proyecto.id, p.id, "cancelar")
        if (accion === "retirar") r = await api.accionPublicacion(proyecto.id, p.id, "retirar")
        if (accion === "metricas") r = await api.accionPublicacion(proyecto.id, p.id, "metricas")
      }
      setP(r)
      onCambiada()
    } catch (err) {
      setError(err.message)
    } finally {
      setTrabajando(null)
    }
  }

  async function verComentarios(idActivo) {
    try {
      setComentarios({ ...comentarios, [idActivo]: await api.comentariosPublicacion(proyecto.id, p.id, idActivo) })
    } catch (err) {
      setError(err.message)
    }
  }

  function responder(idActivo, c) {
    setComentarios({ ...comentarios, [`r_${c.id}`]: { idActivo, comentario: c, texto: "" } })
  }

  async function proponerRespuesta(clave) {
    const r = comentarios[clave]
    try {
      onPropuesta(await api.proponerCambioWeb(proyecto.id, r.idActivo, {
        operacion: "red_responder", datos: { id_publicacion: p.id, id_comentario: r.comentario.id, texto: r.texto, autor_comentario: r.comentario.autor },
      }))
    } catch (err) {
      setError(err.message)
    }
  }

  const estado = p && ESTADOS_PUBLICACION[p.estado]
  return (
    <Modal opened onClose={onCerrar} size="xl" title={
      <Group gap="xs"><Text fw={600}>{p ? p.titulo : "Nueva publicación"}</Text>{estado && <Badge color={estado.color} variant="light" tt="none">{estado.etiqueta}</Badge>}</Group>
    }>
      <Stack gap="sm">
        <MultiSelect label="Redes" data={redes.map((r) => ({ value: String(r.id), label: `${r.nombre} (${PLATAFORMAS[r.plataforma] || r.plataforma})` }))}
          value={form.ids_activos} onChange={(v) => setForm({ ...form, ids_activos: v })} disabled={!editable}
          nothingFoundMessage="No hay redes dadas de alta en Webs y redes" />
        <TextInput label="Nombre interno (para el calendario)" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} disabled={!editable} />
        <Textarea label="Texto" autosize minRows={4} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} disabled={!editable}
          description={seleccionadas.length ? `${form.texto.length} caracteres (como mucho ${limite} en la red más corta)` : undefined}
          error={form.texto.length > limite ? "Demasiado largo para alguna de las redes elegidas" : null} />
        <MultiSelect label="Imágenes (documentos con la foto adjunta)" searchable disabled={!editable}
          data={imagenes.map((d) => ({ value: String(d.id), label: d.nombre }))} value={form.ids_documentos} onChange={(v) => setForm({ ...form, ids_documentos: v })} />
        <Group grow>
          <TextInput label="Enlace (opcional)" value={form.enlace} onChange={(e) => setForm({ ...form, enlace: e.target.value })} disabled={!editable} />
          <TextInput type="datetime-local" label="Cuándo (vacío = al aprobar)" value={form.fecha_prevista} onChange={(e) => setForm({ ...form, fecha_prevista: e.target.value })} disabled={!editable} />
        </Group>
        {p && Object.keys(p.resultados || {}).length > 0 && (
          <Table withTableBorder fz="13px" verticalSpacing={4}>
            <Table.Tbody>
              {Object.entries(p.resultados).map(([id, r]) => (
                <Table.Tr key={id}>
                  <Table.Td>{p.redes?.[id]?.nombre || (id === "_" ? "Todas" : id)}</Table.Td>
                  <Table.Td>
                    {r.ok ? <Anchor href={r.url} target="_blank" fz="13px">Ver publicación</Anchor> : <Text c={r.retirada ? "dimmed" : "red"} fz="13px">{r.retirada ? "Retirada" : r.error}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {p.metricas?.[id] && !p.metricas[id].error && (
                      <Text fz="12.5px">{["alcance", "me_gusta", "comentarios", "compartidos"].filter((k) => p.metricas[id][k] != null).map((k) => `${k.replace("_", " ")}: ${p.metricas[id][k]}`).join(" · ")}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>{r.ok && <Button size="compact-xs" variant="subtle" onClick={() => verComentarios(id)}>Comentarios</Button>}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {Object.entries(comentarios).filter(([k]) => !k.startsWith("r_")).map(([idActivo, lista]) => (
          <Stack key={idActivo} gap={4}>
            <Text fz="13px" fw={600}>Comentarios en {p.redes?.[idActivo]?.nombre}</Text>
            {lista.length === 0 ? <Text fz="13px" c="dimmed">Ninguno.</Text> : lista.map((c) => {
              const clave = `r_${c.id}`
              return (
                <Stack key={c.id} gap={2}>
                  <Text fz="13px"><b>{c.autor}</b>: {c.texto} <Button size="compact-xs" variant="subtle" onClick={() => responder(idActivo, c)}>Responder</Button></Text>
                  {comentarios[clave] && (
                    <Group>
                      <TextInput size="xs" style={{ flex: 1 }} placeholder="Tu respuesta" value={comentarios[clave].texto}
                        onChange={(e) => setComentarios({ ...comentarios, [clave]: { ...comentarios[clave], texto: e.target.value } })} />
                      <Button size="xs" onClick={() => proponerRespuesta(clave)} disabled={!comentarios[clave].texto.trim()}>Ver cómo quedaría</Button>
                    </Group>
                  )}
                </Stack>
              )
            })}
          </Stack>
        ))}
        {p?.fecha_publicada && <Text fz="12.5px" c="dimmed">Publicada el {formatearFecha(p.fecha_publicada)}{p.aprobado_por && ` · aprobada por ${p.aprobado_por}`}</Text>}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end" gap="xs">
          {editable && <Button variant="default" onClick={() => hacer("guardar")} loading={trabajando === "guardar"}>Guardar borrador</Button>}
          {editable && (!p || p.estado === "borrador") && <Button variant="light" onClick={() => hacer("pedir")} loading={trabajando === "pedir"}>Pedir aprobación</Button>}
          {p && ["borrador", "pendiente", "error"].includes(p.estado) && <Button onClick={() => hacer("aprobar")} loading={trabajando === "aprobar"}>Aprobar</Button>}
          {p && ["borrador", "pendiente", "aprobada", "error"].includes(p.estado) && (
            <Button color="teal" onClick={() => hacer("publicar")} loading={trabajando === "publicar"}>Aprobar y publicar ya</Button>
          )}
          {p && ["borrador", "pendiente", "aprobada", "error"].includes(p.estado) && <Button variant="subtle" color="gray" onClick={() => hacer("cancelar")}>Cancelar publicación</Button>}
          {p && ["publicada", "parcial"].includes(p.estado) && <Button variant="default" onClick={() => hacer("metricas")} loading={trabajando === "metricas"}>Actualizar métricas</Button>}
          {p && ["publicada", "parcial"].includes(p.estado) && !confirmarRetirar && (
            <Button variant="light" color="orange" onClick={() => setConfirmarRetirar(true)}>Retirar de las redes</Button>
          )}
        </Group>
        {confirmarRetirar && (
          <Alert color="orange" title="¿Retirar esta publicación?">
            <Text fz="13.5px" mb="sm">Se borrará de las redes donde salió (con sus me gusta y comentarios). Instagram no deja borrar desde fuera: allí hay que hacerlo en la aplicación.</Text>
            <Group>
              <Button color="orange" onClick={() => { setConfirmarRetirar(false); hacer("retirar") }} loading={trabajando === "retirar"}>Sí, retirar</Button>
              <Button variant="default" onClick={() => setConfirmarRetirar(false)}>No</Button>
            </Group>
          </Alert>
        )}
      </Stack>
    </Modal>
  )
}
