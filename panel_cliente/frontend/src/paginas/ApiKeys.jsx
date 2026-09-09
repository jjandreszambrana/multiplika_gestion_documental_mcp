import { useEffect, useState } from "react"
import { api } from "../api"

export default function ApiKeys({ proyecto, onVolver }) {
  const [keys, setKeys] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [nombreNueva, setNombreNueva] = useState("")
  const [emitiendo, setEmitiendo] = useState(false)
  const [keyRecienEmitida, setKeyRecienEmitida] = useState(null)

  async function recargar() {
    setCargando(true)
    setError(null)
    try {
      setKeys(await api.listarApiKeys(proyecto.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [proyecto.id])

  async function emitir(evento) {
    evento.preventDefault()
    setEmitiendo(true)
    setError(null)
    try {
      const nueva = await api.emitirApiKey(proyecto.id, nombreNueva)
      setKeyRecienEmitida(nueva.api_key)
      setNombreNueva("")
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEmitiendo(false)
    }
  }

  async function revocar(idApiKey) {
    setError(null)
    try {
      await api.revocarApiKey(idApiKey)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function eliminar(idApiKey) {
    if (!window.confirm("¿Eliminar esta key para siempre? No se puede deshacer.")) return
    setError(null)
    try {
      await api.eliminarApiKey(idApiKey)
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
      <h2>API keys de {proyecto.nombre}</h2>
      <p>Cada key conecta un cliente MCP (por ejemplo, Claude Desktop) a este proyecto.</p>

      <form onSubmit={emitir} className="formulario-linea">
        <input
          placeholder="Nombre para identificarla (opcional, ej. Claude Desktop de Juan)"
          value={nombreNueva}
          onChange={(e) => setNombreNueva(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={emitiendo}>
          {emitiendo ? "Emitiendo..." : "Emitir API key nueva"}
        </button>
      </form>

      {keyRecienEmitida && (
        <div className="aviso-key">
          <p>Copia esta key ahora — no se puede volver a ver:</p>
          <code>{keyRecienEmitida}</code>
          <button onClick={() => setKeyRecienEmitida(null)}>Ya la copié</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Prefijo</th>
              <th>Estado</th>
              <th>Emitida</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.nombre || "—"}</td>
                <td>{k.prefijo}</td>
                <td>{k.estado ? "activa" : "revocada"}</td>
                <td>{k.fecha_emision}</td>
                <td>{k.estado === 1 && <button onClick={() => revocar(k.id)}>Revocar</button>}</td>
                <td>
                  <button onClick={() => eliminar(k.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={6}>Este proyecto no tiene ninguna API key todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}
