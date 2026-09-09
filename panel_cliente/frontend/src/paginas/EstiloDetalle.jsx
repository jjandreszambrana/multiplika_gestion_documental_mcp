import { useEffect, useState } from "react"
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
    <div className="tarjeta-eleccion">
      {url && <img src={url} alt={imagen.nombre} style={{ maxWidth: "200px", display: "block", marginBottom: "0.5rem" }} />}
      <strong>{imagen.nombre}</strong>
      <p className="estado-fecha">{imagen.descripcion_uso}</p>
      {proyecto.es_admin && <button onClick={() => onEliminar(imagen.id)}>Eliminar</button>}
    </div>
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
    <section>
      <button className="volver" onClick={onVolver}>
        ← Estilos
      </button>
      <h2>{estilo.nombre_tipo}</h2>

      {error && <p className="error">{error}</p>}

      <form onSubmit={guardarInstrucciones} className="formulario-columna">
        <textarea
          rows={6}
          value={instrucciones}
          onChange={(e) => setInstrucciones(e.target.value)}
          disabled={!proyecto.es_admin}
        />
        {proyecto.es_admin && (
          <button type="submit" disabled={guardandoInstrucciones}>
            {guardandoInstrucciones ? "Guardando..." : "Guardar instrucciones"}
          </button>
        )}
      </form>

      <h3>Imágenes</h3>
      {cargandoImagenes ? (
        <p>Cargando...</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {imagenes.map((img) => (
            <ImagenEstilo key={img.id} proyecto={proyecto} estilo={estilo} imagen={img} onEliminar={eliminarImagen} />
          ))}
          {imagenes.length === 0 && <p>Este estilo no tiene ninguna imagen todavía.</p>}
        </div>
      )}

      {proyecto.es_admin && (
        <form onSubmit={subirImagen} className="formulario-columna" style={{ marginTop: "1.5rem" }}>
          <input
            placeholder='Nombre (ej. "logo_cabecera")'
            value={nombreImagen}
            onChange={(e) => setNombreImagen(e.target.value)}
            required
          />
          <input
            placeholder="Cuándo/cómo debe usarla la IA"
            value={descripcionUsoImagen}
            onChange={(e) => setDescripcionUsoImagen(e.target.value)}
            required
          />
          <input type="file" accept="image/*" onChange={(e) => setArchivo(e.target.files[0] || null)} required />
          <button type="submit" disabled={subiendo || !archivo}>
            {subiendo ? "Subiendo..." : "Subir imagen"}
          </button>
        </form>
      )}
    </section>
  )
}
