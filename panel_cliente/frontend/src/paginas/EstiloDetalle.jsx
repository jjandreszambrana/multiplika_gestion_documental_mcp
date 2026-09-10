import { useEffect, useState } from "react"
import { Alert, Anchor, Button, Card, FileInput, Group, Image, Stack, Text, Textarea, TextInput, Title } from "@mantine/core"
import { api } from "../api"

function ImagenEstilo({ proyecto, estilo, imagen, onEliminar }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let objectUrl = null
    api
      .obtenerImagenEstiloBlob(proyecto.id, estilo.id, imagen.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [proyecto.id, estilo.id, imagen.id])

  return (
    <Card withBorder w={220}>
      {url && <Image src={url} alt={imagen.nombre} h={120} fit="contain" mb="sm" />}
      <Text fw={600}>{imagen.nombre}</Text>
      <Text c="dimmed" size="sm" mb="sm">
        {imagen.descripcion_uso}
      </Text>
      {proyecto.es_admin && (
        <Button size="xs" variant="light" color="red" onClick={() => onEliminar(imagen.id)}>
          Eliminar
        </Button>
      )}
    </Card>
  )
}

export default function EstiloDetalle({ proyecto, estilo, onVolver }) {
  const [instrucciones, setInstrucciones] = useState(estilo.instrucciones)
  const [guardandoInstrucciones, setGuardandoInstrucciones] = useState(false)
  const [imagenes, setImagenes] = useState([])
  const [cargandoImagenes, setCargandoImagenes] = useState(true)
  const [error, setError] = useState(null)

  const [nombreImagen, setNombreImagen] = useState("")
  const [descripcionUsoImagen, setDescripcionUsoImagen] = useState("")
  const [archivo, setArchivo] = useState(null)
  const [subiendo, setSubiendo] = useState(false)

  async function recargarImagenes() {
    setCargandoImagenes(true)
    setError(null)
    try {
      setImagenes(await api.listarImagenesEstilo(proyecto.id, estilo.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargandoImagenes(false)
    }
  }

  useEffect(() => {
    recargarImagenes()
  }, [proyecto.id, estilo.id])

  async function guardarInstrucciones(evento) {
    evento.preventDefault()
    setGuardandoInstrucciones(true)
    setError(null)
    try {
      await api.actualizarEstilo(proyecto.id, estilo.id, instrucciones)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoInstrucciones(false)
    }
  }

  async function subirImagen(evento) {
    evento.preventDefault()
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      await api.subirImagenEstilo(proyecto.id, estilo.id, nombreImagen, descripcionUsoImagen, archivo)
      setNombreImagen("")
      setDescripcionUsoImagen("")
      setArchivo(null)
      await recargarImagenes()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function eliminarImagen(idImagen) {
    if (!window.confirm("¿Eliminar esta imagen para siempre?")) return
    setError(null)
    try {
      await api.eliminarImagenEstilo(proyecto.id, estilo.id, idImagen)
      await recargarImagenes()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <Anchor component="button" type="button" onClick={onVolver} mb="md" display="block">
        ← Estilos
      </Anchor>
      <Title order={2} mb="lg">
        {estilo.nombre_tipo}
      </Title>

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Stack component="form" onSubmit={guardarInstrucciones} mb="xl">
        <Textarea
          rows={6}
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          disabled={!proyecto.es_admin}
        />
        {proyecto.es_admin && (
          <Button type="submit" loading={guardandoInstrucciones} w="fit-content">
            Guardar instrucciones
          </Button>
        )}
      </Stack>

      <Title order={4} mb="md">
        Imágenes
      </Title>
      {cargandoImagenes ? (
        <Text>Cargando...</Text>
      ) : (
        <Group mb="xl" align="flex-start">
          {imagenes.map((img) => (
            <ImagenEstilo key={img.id} proyecto={proyecto} estilo={estilo} imagen={img} onEliminar={eliminarImagen} />
          ))}
          {imagenes.length === 0 && <Text>Este estilo no tiene ninguna imagen todavía.</Text>}
        </Group>
      )}

      {proyecto.es_admin && (
        <Stack component="form" onSubmit={subirImagen} maw={480}>
          <TextInput
            placeholder='Nombre (ej. "logo_cabecera")'
            value={nombreImagen}
            onChange={(e) => setNombreImagen(e.target.value)}
            required
          />
          <TextInput
            placeholder="Cuándo/cómo debe usarla la IA"
            value={descripcionUsoImagen}
            onChange={(e) => setDescripcionUsoImagen(e.target.value)}
            required
          />
          <FileInput placeholder="Elige una imagen" accept="image/*" value={archivo} onChange={setArchivo} required />
          <Button type="submit" loading={subiendo} disabled={!archivo} w="fit-content">
            Subir imagen
          </Button>
        </Stack>
      )}
    </>
  )
}
