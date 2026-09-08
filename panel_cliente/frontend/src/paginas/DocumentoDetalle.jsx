import { useEffect, useState } from "react"
import { api } from "../api"

export default function DocumentoDetalle({ proyecto, idDocumento, onVolver }) {
  const [documento, setDocumento] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .obtenerDocumento(proyecto.id, idDocumento)
      .then(setDocumento)
      .catch((err) => setError(err.message))
  }, [proyecto.id, idDocumento])

  return (
    <section>
      <button className="volver" onClick={onVolver}>
        ← Documentos
      </button>

      {error && <p className="error">{error}</p>}
      {!documento && !error && <p>Cargando...</p>}

      {documento && (
        <>
          <h2>{documento.nombre}</h2>
          <p>
            {documento.tipo_documento} — {documento.fecha_documento}
            {documento.revisado_manualmente && " — corregido a mano"}
          </p>
          <div className="documento-markdown">{documento.markdown}</div>
        </>
      )}
    </section>
  )
}
