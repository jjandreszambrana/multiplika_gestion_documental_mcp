import { useEffect, useState } from "react"
import { api } from "../api"

export default function Estilos({ proyecto, onVolver, onVerEstilo }) {
  const [estilos, setEstilos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombreTipo, setNombreTipo] = useState("")
  const [instrucciones, setInstrucciones] = useState("")
  const [creando, setCreando] = useState(false)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      setEstilos(await api.listarEstilos(proyecto.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [proyecto.id])

  async function crear(evento) {
    evento.preventDefault()
    setCreando(true)
    setError(null)
    try {
      await api.crearEstilo(proyecto.id, nombreTipo, instrucciones)
      setNombreTipo("")
      setInstrucciones("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <section>
      <button className="volver" onClick={onVolver}>
        ← Volver
      </button>
      <h2>Estilos de informe de {proyecto.nombre}</h2>
      <p>Cómo debe construir la IA cada tipo de informe, y qué imágenes fijas debe usar.</p>

      {proyecto.es_admin && (
        <form onSubmit={crear} className="formulario-columna">
          <input
            placeholder='Tipo de informe (ej. "informe_mensual")'
            value={nombreTipo}
            onChange={(e) => setNombreTipo(e.target.value)}
            required
          />
          <textarea
            placeholder="Instrucciones: estructura, tono, qué apartados lleva..."
            rows={4}
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            required
          />
          <button type="submit" disabled={creando}>
            {creando ? "Guardando..." : "Crear estilo"}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo de informe</th>
              <th>Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {estilos.map((e) => (
              <tr key={e.id} className="clicable" onClick={() => onVerEstilo(e)}>
                <td>{e.nombre_tipo}</td>
                <td>{e.fecha_actualizacion}</td>
              </tr>
            ))}
            {estilos.length === 0 && (
              <tr>
                <td colSpan={2}>Este proyecto no tiene ningún estilo de informe todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}
