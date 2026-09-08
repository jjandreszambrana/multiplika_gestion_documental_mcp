import { useEffect, useState } from "react"
import { api, leerToken, setToken } from "./api"
import Login from "./paginas/Login"
import ElegirProyecto from "./paginas/ElegirProyecto"
import Documentos from "./paginas/Documentos"
import DocumentoDetalle from "./paginas/DocumentoDetalle"

export default function App() {
  const [sesion, setSesion] = useState(null)
  const [proyecto, setProyecto] = useState(null)
  const [idDocumentoActivo, setIdDocumentoActivo] = useState(null)
  const [comprobandoEnlace, setComprobandoEnlace] = useState(true)
  const [error, setError] = useState(null)

  // Enlace directo del superadmin desde el panel de administración
  // (?token=...&id_proyecto=...): entra sin login ni selector — el
  // acceso queda registrado igualmente en el propio backend.
  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    const token = parametros.get("token")
    const idProyecto = parametros.get("id_proyecto")
    if (!token || !idProyecto) {
      setComprobandoEnlace(false)
      return
    }
    window.history.replaceState({}, "", window.location.pathname)
    setToken(token)
    setSesion(leerToken(token))
    api
      .verProyecto(idProyecto)
      .then(setProyecto)
      .catch((err) => setError(err.message))
      .finally(() => setComprobandoEnlace(false))
  }, [])

  function iniciarSesion(token) {
    setToken(token)
    setSesion(leerToken(token))
  }

  function cerrarSesion() {
    setToken(null)
    setSesion(null)
    setProyecto(null)
    setIdDocumentoActivo(null)
  }

  if (comprobandoEnlace) {
    return <p>Cargando...</p>
  }

  if (!sesion) {
    return <Login onLogin={iniciarSesion} />
  }

  const esSuperadmin = sesion.tipo === "superadmin"

  if (!proyecto) {
    return (
      <div className="app">
        <header>
          <h1>Gestión documental</h1>
          <div className="sesion">
            <button onClick={cerrarSesion}>Cerrar sesión</button>
          </div>
        </header>
        <main>
          {error && <p className="error">{error}</p>}
          {esSuperadmin ? (
            <p>No se ha podido cargar el proyecto del enlace.</p>
          ) : (
            <ElegirProyecto idTenant={sesion.id_tenant} onElegir={setProyecto} />
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Gestión documental{esSuperadmin && " — modo soporte"}</h1>
        <div className="sesion">
          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </header>
      <main>
        {idDocumentoActivo ? (
          <DocumentoDetalle
            proyecto={proyecto}
            idDocumento={idDocumentoActivo}
            onVolver={() => setIdDocumentoActivo(null)}
          />
        ) : (
          <Documentos
            proyecto={proyecto}
            onCambiarProyecto={esSuperadmin ? null : () => setProyecto(null)}
            onVerDocumento={setIdDocumentoActivo}
          />
        )}
      </main>
    </div>
  )
}
