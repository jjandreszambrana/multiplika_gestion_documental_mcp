import { useEffect, useState } from "react"
import { api } from "../api"

export default function Credenciales({ proyecto, onVolver }) {
  const [credenciales, setCredenciales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [valor, setValor] = useState("")
  const [creando, setCreando] = useState(false)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      setCredenciales(await api.listarCredenciales(proyecto.id))
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
      await api.crearCredencial(proyecto.id, nombre, descripcion, valor)
      setNombre("")
      setDescripcion("")
      setValor("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  async function eliminar(idCredencial) {
    if (!window.confirm("¿Eliminar esta credencial para siempre? No se puede deshacer.")) return
    setError(null)
    try {
      await api.eliminarCredencial(proyecto.id, idCredencial)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <button className="volver" onClick={onVolver}>
        ← Volver
      </button>
      <h2>Credenciales de {proyecto.nombre}</h2>
      <p>
        Para que la IA pueda conectar con servicios externos. El valor se guarda cifrado y no
        vuelve a mostrarse — la IA solo ve el nombre y para qué sirve cada una, nunca el valor.
      </p>

      <form onSubmit={crear} className="formulario-columna">
        <input
          placeholder='Nombre corto (ej. "erp_contabilidad")'
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          placeholder="Para qué sirve"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
        />
        <input
          placeholder="Valor (API key, token...)"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
        <button type="submit" disabled={creando}>
          {creando ? "Guardando..." : "Guardar credencial"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Para qué sirve</th>
              <th>Actualizada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {credenciales.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td>{c.descripcion}</td>
                <td>{c.fecha_actualizacion}</td>
                <td>
                  <button onClick={() => eliminar(c.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {credenciales.length === 0 && (
              <tr>
                <td colSpan={4}>Este proyecto no tiene ninguna credencial todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}
