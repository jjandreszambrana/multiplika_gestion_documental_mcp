import { useState } from "react"
import { leerToken, setToken } from "./api"
import Login from "./paginas/Login"
import ElegirProyecto from "./paginas/ElegirProyecto"
import Documentos from "./paginas/Documentos"
import DocumentoDetalle from "./paginas/DocumentoDetalle"

export default function App() {
  const [sesion, setSesion] = useState(null)
  const [proyecto, setProyecto] = useState(null)
  const [idDocumentoActivo, setIdDocumentoActivo] = useState(null)

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

  if (!sesion) {
    return <Login onLogin={iniciarSesion} />
  }

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
          <ElegirProyecto idTenant={sesion.id_tenant} onElegir={setProyecto} />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Gestión documental</h1>
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
            onCambiarProyecto={() => setProyecto(null)}
            onVerDocumento={setIdDocumentoActivo}
          />
        )}
      </main>
    </div>
  )
}
