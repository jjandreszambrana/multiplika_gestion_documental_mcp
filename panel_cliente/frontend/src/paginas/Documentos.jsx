import { useEffect, useState } from "react"
import { api } from "../api"

export default function Documentos({ proyecto, onCambiarProyecto, onVerDocumento }) {
  const [q, setQ] = useState("")
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  async function cargar(consulta) {
    setCargando(true)
    setError(null)
    try {
      setResultados(await api.listarOBuscarDocumentos(proyecto.id, consulta))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar("")
  }, [proyecto.id])

  function buscar(evento) {
    evento.preventDefault()
    cargar(q)
  }

  return (
    <section>
      <h2>{proyecto.nombre}</h2>
      {onCambiarProyecto && (
        <button className="volver" onClick={onCambiarProyecto}>
          ← Cambiar de proyecto
        </button>
      )}

      <form onSubmit={buscar} className="formulario-linea">
        <input
          placeholder="Buscar por contenido (déjalo vacío para ver todos)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit">Buscar</button>
      </form>

      {error && <p className="error">{error}</p>}
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>{q ? "Fragmento" : "Fecha de alta"}</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => {
              const idDocumento = r.id ?? r.id_documento
              return (
                <tr key={`${idDocumento}-${r.id_version ?? ""}`} className="clicable" onClick={() => onVerDocumento(idDocumento)}>
                  <td>{r.nombre}</td>
                  <td>{r.tipo_documento}</td>
                  <td className={q ? "fragmento" : undefined}>
                    {q ? r.fragmento : r.fecha_alta}
                  </td>
                </tr>
              )
            })}
            {resultados.length === 0 && (
              <tr>
                <td colSpan={3}>{q ? "Sin resultados." : "No hay ningún documento todavía."}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}
