import { useEffect, useState } from "react"
import { AppShell, Container, Group, Text } from "@mantine/core"
import { IconBuildingSkyscraper } from "@tabler/icons-react"
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
import Certificados from "./paginas/Certificados"
import Estilos from "./paginas/Estilos"
import Reglas from "./paginas/Reglas"
import Registros from "./paginas/Registros"
import TiposDocumento from "./paginas/TiposDocumento"
import EstiloDetalle from "./paginas/EstiloDetalle"
import Grupos from "./paginas/Grupos"
import GrupoDetalle from "./paginas/GrupoDetalle"
import Entidades from "./paginas/Entidades"
import EntidadDetalle from "./paginas/EntidadDetalle"
import Scripts from "./paginas/Scripts"
import ScriptDetalle from "./paginas/ScriptDetalle"
import Chat from "./paginas/Chat"
import Usuarios from "./paginas/Usuarios"
import Avisos from "./paginas/Avisos"
import CuentaCorreo from "./paginas/CuentaCorreo"
import Ayuda from "./paginas/Ayuda"
import Enlaces from "./paginas/Enlaces"

export default function App() {
  const [sesion, setSesion] = useState(() => {
    const guardado = cargarTokenGuardado()
    return guardado ? leerToken(guardado) : null
  })
  const [proyecto, setProyecto] = useState(null)
  const [idDocumentoActivo, setIdDocumentoActivo] = useState(null)
  const [estiloActivo, setEstiloActivo] = useState(null)
  const [grupoActivo, setGrupoActivo] = useState(null)
  const [entidadActiva, setEntidadActiva] = useState(null)
  const [scriptActivo, setScriptActivo] = useState(null)
  const [vista, setVista] = useState("documentos")
  const [comprobandoEnlace, setComprobandoEnlace] = useState(true)
  const [error, setError] = useState(null)
  const [pendientesCount, setPendientesCount] = useState(0)
  const [empresas, setEmpresas] = useState([])

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

  useEffect(() => {
    if (!sesion || sesion.tipo !== "usuario") {
      setEmpresas([])
      return
    }
    api.misEmpresas().then(setEmpresas).catch(() => setEmpresas([]))
  }, [sesion])

  function iniciarSesion(token) {
    setToken(token)
    setSesion(leerToken(token))
  }

  function cambiarEmpresa(idTenant) {
    return api.cambiarEmpresa(idTenant).then(({ token }) => {
      setToken(token)
      setSesion(leerToken(token))
      setProyecto(null)
      localStorage.removeItem(CLAVE_PROYECTO)
      navegar("documentos")
    })
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
    setEntidadActiva(null)
    setScriptActivo(null)
    setVista("documentos")
    localStorage.removeItem(CLAVE_PROYECTO)
  }

  function navegar(nuevaVista) {
    setIdDocumentoActivo(null)
    setEstiloActivo(null)
    setGrupoActivo(null)
    setEntidadActiva(null)
    setScriptActivo(null)
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

  // Solo quien tiene cuenta en varias empresas ve esta franja — para
  // todos los demás la pantalla queda exactamente igual que siempre. El
  // motivo es evitar que alguien confunda los documentos de una empresa
  // con los de otra tras cambiar de sesión (ver Sidebar, que ya deja
  // cambiar de empresa sin volver a poner la contraseña).
  const avisoEmpresa = empresas.length > 1

  return (
    <AppShell
      header={avisoEmpresa ? { height: 34 } : undefined}
      navbar={{ width: 252, breakpoint: 0 }}
      padding="xl"
    >
      {avisoEmpresa && (
        <AppShell.Header>
          <Group h="100%" justify="center" gap="6" bg="acento.6">
            <IconBuildingSkyscraper size={14} color="white" stroke={2} />
            <Text size="12.5px" fw={700} c="white" tt="uppercase" style={{ letterSpacing: ".03em" }}>
              Estás viendo: {proyecto.nombre}
            </Text>
          </Group>
        </AppShell.Header>
      )}
      <Sidebar
        proyecto={proyecto}
        esSuperadmin={esSuperadmin}
        vista={idDocumentoActivo ? "documentos" : vista}
        pendientesCount={pendientesCount}
        onNavigate={navegar}
        onCerrarSesion={cerrarSesion}
        empresas={empresas}
        idTenantActual={sesion.id_tenant}
        onCambiarEmpresa={cambiarEmpresa}
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
          ) : vista === "enlaces" ? (
            <Enlaces proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "contexto" ? (
            <Contexto proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "credenciales" ? (
            <Credenciales proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "certificados" ? (
            <Certificados proyecto={proyecto} onVolver={() => navegar("documentos")} />
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
          ) : vista === "reglas" ? (
            <Reglas proyecto={proyecto} onVolver={() => navegar("documentos")} />
          ) : vista === "registros" ? (
            <Registros proyecto={proyecto} onVolver={() => navegar("documentos")} />
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
          ) : vista === "entidades" && entidadActiva ? (
            <EntidadDetalle
              proyecto={proyecto}
              entidad={entidadActiva}
              onVolver={() => setEntidadActiva(null)}
              onEliminada={() => setEntidadActiva(null)}
            />
          ) : vista === "entidades" ? (
            <Entidades proyecto={proyecto} onVolver={() => navegar("documentos")} onVerEntidad={setEntidadActiva} />
          ) : vista === "scripts" && scriptActivo ? (
            <ScriptDetalle
              proyecto={proyecto}
              script={scriptActivo}
              onVolver={() => setScriptActivo(null)}
              onCambiado={setScriptActivo}
            />
          ) : vista === "scripts" ? (
            <Scripts proyecto={proyecto} onVolver={() => navegar("documentos")} onVerScript={setScriptActivo} />
          ) : vista === "chat" ? (
            <Chat proyecto={proyecto} onVolver={() => navegar("documentos")} />
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
