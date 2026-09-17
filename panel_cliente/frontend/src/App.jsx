import { useEffect, useState } from "react"
import { AppShell, Container, Text } from "@mantine/core"
import { api, cargarTokenGuardado, leerToken, setToken } from "./api"
import Sidebar from "./componentes/Sidebar"

// El id del proyecto activo se guarda aparte del token: hace falta para
// recuperar la sesión de un superadmin que entró por el enlace directo
// (?token=...&id_proyecto=...) — ese parámetro se borra de la URL nada
// más leerlo, así que sin esto una recarga lo dejaría sin proyecto y sin
// forma de volver a elegirlo (ElegirProyecto es solo para usuarios de
// empresa, no para superadmin).
const CLAVE_PROYECTO = "gd_panel_id_proyecto"
import Login from "./paginas/Login"
import ElegirProyecto from "./paginas/ElegirProyecto"
import Documentos from "./paginas/Documentos"
import DocumentoDetalle from "./paginas/DocumentoDetalle"
import ApiKeys from "./paginas/ApiKeys"
import Contexto from "./paginas/Contexto"
import Credenciales from "./paginas/Credenciales"
import Estilos from "./paginas/Estilos"
import TiposDocumento from "./paginas/TiposDocumento"
import EstiloDetalle from "./paginas/EstiloDetalle"
import Grupos from "./paginas/Grupos"
import GrupoDetalle from "./paginas/GrupoDetalle"
import Usuarios from "./paginas/Usuarios"
import Avisos from "./paginas/Avisos"
import CuentaCorreo from "./paginas/CuentaCorreo"
import Ayuda from "./paginas/Ayuda"

export default function App() {
  const [sesion, setSesion] = useState(() => {
    const guardado = cargarTokenGuardado()
    return guardado ? leerToken(guardado) : null
  })
  const [proyecto, setProyecto] = useState(null)
  const [idDocumentoActivo, setIdDocumentoActivo] = useState(null)
  const [estiloActivo, setEstiloActivo] = useState(null)
  const [grupoActivo, setGrupoActivo] = useState(null)
  const [vista, setVista] = useState("documentos")
  const [comprobandoEnlace, setComprobandoEnlace] = useState(true)
  const [error, setError] = useState(null)
  const [pendientesCount, setPendientesCount] = useState(0)

  // Enlace directo del superadmin desde el panel de administración
  // (?token=...&id_proyecto=...): entra sin login ni selector — el
  // acceso queda registrado igualmente en el propio backend.
  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    const token = parametros.get("token")
    const idProyecto = parametros.get("id_proyecto")
    if (token && idProyecto) {
      window.history.replaceState({}, "", window.location.pathname)
      setToken(token)
      setSesion(leerToken(token))
      cargarProyecto(idProyecto).finally(() => setComprobandoEnlace(false))
      return
    }

    // Sin enlace nuevo: si ya había sesión restaurada (recarga de página)
    // y se conoce el último proyecto, recupéralo directamente.
    const idProyectoGuardado = localStorage.getItem(CLAVE_PROYECTO)
    if (sesion && idProyectoGuardado) {
      cargarProyecto(idProyectoGuardado).finally(() => setComprobandoEnlace(false))
      return
    }
    setComprobandoEnlace(false)
  }, [])

  function cargarProyecto(idProyecto) {
    return api
      .verProyecto(idProyecto)
      .then((p) => {
        localStorage.setItem(CLAVE_PROYECTO, p.id)
        setProyecto(p)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    if (!proyecto) return
    api
      .listarDocumentosPendientes(proyecto.id)
      .then((filas) => setPendientesCount(filas.length))
      .catch(() => setPendientesCount(0))
  }, [proyecto, idDocumentoActivo, vista])

  function iniciarSesion(token) {
    setToken(token)
    setSesion(leerToken(token))
  }

  function elegirProyecto(p) {
    // El listado por tenant no trae `es_admin` (viene del panel de
    // administración, no de este backend) — se pide aparte para saber
    // si mostrar la gestión de API keys.
    cargarProyecto(p.id)
  }

  function cerrarSesion() {
    setToken(null)
    setSesion(null)
    setProyecto(null)
    setIdDocumentoActivo(null)
    setEstiloActivo(null)
    setGrupoActivo(null)
    setVista("documentos")
    localStorage.removeItem(CLAVE_PROYECTO)
  }

  function navegar(nuevaVista) {
    setIdDocumentoActivo(null)
    setEstiloActivo(null)
    setGrupoActivo(null)
    setVista(nuevaVista)
  }

  if (comprobandoEnlace) {
    return (
      <Container size="md" py="xl">
        <Text>Cargando...</Text>
      </Container>
    )
  }

  if (!sesion) {
    return <Login onLogin={iniciarSesion} />
  }

  const esSuperadmin = sesion.tipo === "superadmin"

  if (!proyecto) {
    return (
      <Container size="md" py="xl">
        {error && <Text c="red">{error}</Text>}
        {esSuperadmin ? (
          <Text>No se ha podido cargar el proyecto del enlace.</Text>
        ) : (
          <ElegirProyecto idTenant={sesion.id_tenant} onElegir={elegirProyecto} />
        )}
      </Container>
    )
  }

  return (
    <AppShell navbar={{ width: 252, breakpoint: 0 }} padding="xl">
      <Sidebar
        proyecto={proyecto}
        esSuperadmin={esSuperadmin}
        vista={idDocumentoActivo ? "documentos" : vista}
        pendientesCount={pendientesCount}
        onNavigate={navegar}
        onCerrarSesion={cerrarSesion}
      />
      <AppShell.Main>
        <Container size="lg" px={0}>
          {idDocumentoActivo ? (
            <DocumentoDetalle
              proyecto={proyecto}
              idDocumento={idDocumentoActivo}
              onVolver={() => setIdDocumentoActivo(null)}
            />
          ) : vista === "api-keys" ? (
            <ApiKeys proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "contexto" ? (
            <Contexto proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "credenciales" ? (
            <Credenciales proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "usuarios" ? (
            <Usuarios proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "avisos" ? (
            <Avisos proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "cuenta-email" ? (
            <CuentaCorreo proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "ayuda" ? (
            <Ayuda onVolver={() => navegar("documentos")} />
          ) : vista === "estilos" && estiloActivo ? (
            <EstiloDetalle proyecto={proyecto} estilo={estiloActivo} onVolver={() => setEstiloActivo(null)} />
          ) : vista === "estilos" ? (
            <Estilos proyecto={proyecto} onVolver={() => navegar("documentos")} onVerEstilo={setEstiloActivo} />
          ) : vista === "tipos-documento" ? (
            <TiposDocumento proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "grupos" && grupoActivo ? (
            <GrupoDetalle
              proyecto={proyecto}
              grupo={grupoActivo}
              onVolver={() => setGrupoActivo(null)}
              onEliminado={() => setGrupoActivo(null)}
            />
          ) : vista === "grupos" ? (
            <Grupos proyecto={proyecto} onVolver={() => navegar("documentos")} onVerGrupo={setGrupoActivo} />
          ) : (
            <Documentos
              proyecto={proyecto}
              onCambiarProyecto={
                esSuperadmin
                  ? null
                  : () => {
                      setProyecto(null)
                      localStorage.removeItem(CLAVE_PROYECTO)
                    }
              }
              onVerDocumento={setIdDocumentoActivo}
              onPendientesCambiaron={setPendientesCount}
            />
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
