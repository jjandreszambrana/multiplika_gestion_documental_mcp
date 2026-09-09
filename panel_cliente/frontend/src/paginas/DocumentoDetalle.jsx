import { useEffect, useState } from "react"
import { api } from "../api"

export default function DocumentoDetalle({ proyecto, idDocumento, onVolver }) {
  const [documento, setDocumento] = useState(null)
  const [error, setError] = useState(null)
  const [cambiandoArchivo, setCambiandoArchivo] = useState(false)

  useEffect(() => {
    api
      .obtenerDocumento(proyecto.id, idDocumento)
      .then(setDocumento)
      .catch((err) => setError(err.message))
  }, [proyecto.id, idDocumento])

  async function alternarArchivado() {
    setCambiandoArchivo(true)
    setError(null)
    try {
      const actualizado = documento.archivado
        ? await api.desarchivarDocumento(proyecto.id, idDocumento)
        : await api.archivarDocumento(proyecto.id, idDocumento)
      setDocumento({ ...documento, ...actualizado })
    } catch (err) {
      setError(err.message)
    } finally {
      setCambiandoArchivo(false)
    }
  }

  return (
    <section>
      <button className="volver" onClick={onVolver}>
        ← Documentos
      </button>

      {error && <p className="error">{error}</p>}
      {!documento && !error && <p>Cargando...</p>}

      {documento && (
        <>
          <h2>
            {documento.nombre}
            {documento.archivado && <span className="badge-archivado">🗄 Archivado</span>}
          </h2>
          <p>
            {documento.tipo_documento} — {documento.fecha_documento}
            {documento.revisado_manualmente && " — corregido a mano"}
          </p>
          <button onClick={alternarArchivado} disabled={cambiandoArchivo}>
            {cambiandoArchivo
              ? "Guardando..."
              : documento.archivado
                ? "Desarchivar"
                : "Archivar"}
          </button>
          <div className="documento-markdown">{documento.markdown}</div>
        </>
      )}
    </section>
  )
}
