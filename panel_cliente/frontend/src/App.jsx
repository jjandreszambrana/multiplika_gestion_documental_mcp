import { useEffect, useState } from "react"
import { AppShell, Box, Container, Group, Text } from "@mantine/core"
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

// Ancho del chat lateral: lo elige el usuario arrastrando el borde y se
// recuerda en este navegador (si no se puede leer/guardar, se usa el de
// por defecto — es solo una comodidad).
const CLAVE_ANCHO_CHAT = "gd_panel_ancho_chat"
const ANCHO_CHAT_DEFECTO = 420
const ANCHO_CHAT_MINIMO = 320

function anchoChatGuardado() {
  try {
    const valor = Number(localStorage.getItem(CLAVE_ANCHO_CHAT))
    return valor >= ANCHO_CHAT_MINIMO ? valor : ANCHO_CHAT_DEFECTO
  } catch {
    return ANCHO_CHAT_DEFECTO
  }
}

// Deja siempre sitio para el menú y un mínimo de contenido a la izquierda.
function limitarAnchoChat(ancho) {
  return Math.round(Math.max(ANCHO_CHAT_MINIMO, Math.min(ancho, window.innerWidth - 252 - 360)))
}
import Login from "./paginas/Login"
import ElegirProyecto from "./paginas/ElegirProyecto"
import Documentos from "./paginas/Documentos"
import DocumentoDetalle from "./paginas/DocumentoDetalle"
import ApiKeys from "./paginas/ApiKeys"
import Contexto from "./paginas/Contexto"
import Credenciales from "./paginas/Credenciales"
import Certificados from "./paginas/Certificados"
import CopiasBD from "./paginas/CopiasBD"
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
import Actividad from "./paginas/Actividad"
import Programaciones from "./paginas/Programaciones"
import ProgramacionDetalle from "./paginas/ProgramacionDetalle"
import Notificaciones from "./paginas/Notificaciones"
import BlocNotas from "./paginas/BlocNotas"
import NotaBlocDetalle from "./paginas/NotaBlocDetalle"
import Seguimiento from "./paginas/Seguimiento"
import Ventas from "./paginas/Ventas"
import Webs from "./paginas/Webs"
import WebDetalle from "./paginas/WebDetalle"
import Publicaciones from "./paginas/Publicaciones"
import AsesorContable from "./paginas/AsesorContable"
import Inicio from "./paginas/Inicio"

// Cada cuánto se mira si han llegado notificaciones nuevas (el número
// del menú). Un minuto basta: los avisos saltan como mucho una vez por minuto.
const INTERVALO_NOTIFICACIONES_MS = 60 * 1000

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
  const [idActivoActivo, setIdActivoActivo] = useState(null)
  const [idProgramacionActiva, setIdProgramacionActiva] = useState(null)
  // { id } de la nota abierta, o { id: null, enlace } para escribir una nueva
  // (ya enlazada al documento o registro desde el que se pidió)
  const [notaActiva, setNotaActiva] = useState(null)
  const [noLeidas, setNoLeidas] = useState(0)
  const [vista, setVista] = useState("inicio")
  const [comprobandoEnlace, setComprobandoEnlace] = useState(true)
  const [error, setError] = useState(null)
  const [pendientesCount, setPendientesCount] = useState(0)
  const [empresas, setEmpresas] = useState([])
  // El chat se monta la primera vez que se abre (así no crea una
  // conversación vacía a quien nunca lo usa) y ya no se desmonta al
  // cerrarlo: solo se oculta, y la conversación sigue intacta.
  const [chatAbierto, setChatAbierto] = useState(false)
  const [chatMontado, setChatMontado] = useState(false)
  // El asesor contable se queda montado al irse a otro apartado (oculto), para
  // que la contabilidad vuelva con la misma pantalla y lo que se eligió. En su
  // pestaña de contabilidad ocupa toda la pantalla salvo el chat: el menú de la
  // GD se esconde y se abre con un botón.
  const [contaMontada, setContaMontada] = useState(false)
  const [contaCompleta, setContaCompleta] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [anchoChat, setAnchoChat] = useState(anchoChatGuardado)
  const [redimensionando, setRedimensionando] = useState(false)

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

  function contarNoLeidas() {
    if (!proyecto) return
    api.contarNotificacionesNoLeidas(proyecto.id).then((r) => setNoLeidas(r.total)).catch(() => {})
  }

  useEffect(() => {
    if (!proyecto) return
    contarNoLeidas()
    const temporizador = setInterval(contarNoLeidas, INTERVALO_NOTIFICACIONES_MS)
    return () => clearInterval(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto])

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
      setChatAbierto(false)
      setChatMontado(false)
      localStorage.removeItem(CLAVE_PROYECTO)
      navegar("inicio")
    })
  }

  function elegirProyecto(p) {
    // El listado por tenant no trae `es_admin` (viene del panel de
    // administración, no de este backend) — se pide aparte para saber
    // si mostrar la gestión de API keys.
    cargarProyecto(p.id)
  }

  function alternarChat() {
    setChatMontado(true)
    setChatAbierto((abierto) => !abierto)
  }

  function empezarRedimension(evento) {
    evento.preventDefault()
    setRedimensionando(true)
    let ultimo = anchoChat
    const mover = (e) => {
      ultimo = limitarAnchoChat(window.innerWidth - e.clientX)
      setAnchoChat(ultimo)
    }
    const soltar = () => {
      setRedimensionando(false)
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      try {
        localStorage.setItem(CLAVE_ANCHO_CHAT, String(ultimo))
      } catch {
        // sin almacenamiento: el ancho vale solo para esta sesión
      }
    }
    window.addEventListener("pointermove", mover)
    window.addEventListener("pointerup", soltar)
  }

  function cerrarSesion() {
    setChatAbierto(false)
    setChatMontado(false)
    setToken(null)
    setSesion(null)
    setProyecto(null)
    setIdDocumentoActivo(null)
    setEstiloActivo(null)
    setGrupoActivo(null)
    setEntidadActiva(null)
    setScriptActivo(null)
    setIdActivoActivo(null)
    setIdProgramacionActiva(null)
    setNotaActiva(null)
    setContaMontada(false)
    setContaCompleta(false)
    setVista("inicio")
    localStorage.removeItem(CLAVE_PROYECTO)
  }

  function navegar(nuevaVista) {
    setIdDocumentoActivo(null)
    setEstiloActivo(null)
    setGrupoActivo(null)
    setEntidadActiva(null)
    setScriptActivo(null)
    setIdActivoActivo(null)
    setIdProgramacionActiva(null)
    setNotaActiva(null)
    setMenuAbierto(false)
    if (nuevaVista === "asesor-contable") setContaMontada(true)
    setVista(nuevaVista)
  }

  function verProgramacion(idProgramacion) {
    navegar("programaciones")
    setIdProgramacionActiva(idProgramacion)
  }

  function verNota(idNota) {
    navegar("bloc-notas")
    setNotaActiva({ id: idNota })
  }

  function nuevaNota(enlace) {
    navegar("bloc-notas")
    setNotaActiva({ id: null, enlace })
  }

  // La ficha de la entidad trabaja con la fila entera: se pide antes de ir
  function verEntidad(idEntidad) {
    api.obtenerEntidad(proyecto.id, idEntidad).then((entidad) => {
      navegar("entidades")
      setEntidadActiva(entidad)
    }).catch(() => {})
  }

  function verDocumento(idDocumento) {
    navegar("documentos")
    setIdDocumentoActivo(idDocumento)
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

  const enConta = vista === "asesor-contable" && !idDocumentoActivo
  const pantallaContable = enConta && contaCompleta
  const menuOculto = pantallaContable && !menuAbierto

  return (
    <AppShell
      header={avisoEmpresa ? { height: 34 } : undefined}
      navbar={{ width: 252, breakpoint: 0, collapsed: { desktop: menuOculto, mobile: menuOculto } }}
      // En pantallas estrechas (móvil) Mantine lo pone a pantalla completa
      aside={{ width: anchoChat, breakpoint: "sm", collapsed: { desktop: !chatAbierto, mobile: !chatAbierto } }}
      transitionDuration={redimensionando ? 0 : 200}
      padding={0}
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
        noLeidas={noLeidas}
        onNavigate={navegar}
        chatAbierto={chatAbierto}
        onAlternarChat={alternarChat}
        onCerrarSesion={cerrarSesion}
        empresas={empresas}
        idTenantActual={sesion.id_tenant}
        onCambiarEmpresa={cambiarEmpresa}
      />
      {/* La zona central tiene su propia barra de desplazamiento: si fuera
          la de la ventana, saldría pegada al borde derecho, por fuera del
          chat lateral. */}
      <AppShell.Main h="100dvh" style={{ overflow: "hidden" }}>
        {contaMontada && (
          <Box h="100%" p={pantallaContable ? "xs" : "xl"} hidden={!enConta} style={{ overflowY: "auto" }}>
            <Container size="lg" px={0} fluid={pantallaContable}>
              <AsesorContable
                proyecto={proyecto}
                pantallaCompleta={pantallaContable}
                onPantallaCompleta={setContaCompleta}
                onAlternarMenu={() => setMenuAbierto((abierto) => !abierto)}
                onCambiarModulo={(activo) => setProyecto({ ...proyecto, modulo_contable: activo })}
              />
            </Container>
          </Box>
        )}
        <Box h="100%" p="xl" hidden={enConta} style={{ overflowY: "auto" }}>
        <Container size="lg" px={0}>
          {idDocumentoActivo ? (
            <DocumentoDetalle
              proyecto={proyecto}
              idDocumento={idDocumentoActivo}
              onVolver={() => setIdDocumentoActivo(null)}
              onVerProgramacion={verProgramacion}
              onVerNota={verNota}
              onNuevaNota={nuevaNota}
            />
          ) : vista === "api-keys" ? (
            <ApiKeys proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "enlaces" ? (
            <Enlaces proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "contexto" ? (
            <Contexto proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "credenciales" ? (
            <Credenciales proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "certificados" ? (
            <Certificados proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "copias-bd" ? (
            <CopiasBD proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "usuarios" ? (
            <Usuarios proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "avisos" ? (
            <Avisos proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "cuenta-email" ? (
            <CuentaCorreo proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "ayuda" ? (
            <Ayuda onVolver={() => navegar("inicio")} />
          ) : vista === "asesor-contable" ? null /* se pinta aparte, ver contaMontada */ : vista === "estilos" && estiloActivo ? (
            <EstiloDetalle proyecto={proyecto} estilo={estiloActivo} onVolver={() => setEstiloActivo(null)} />
          ) : vista === "estilos" ? (
            <Estilos proyecto={proyecto} onVolver={() => navegar("inicio")} onVerEstilo={setEstiloActivo} />
          ) : vista === "reglas" ? (
            <Reglas proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "registros" ? (
            <Registros proyecto={proyecto} onVolver={() => navegar("inicio")} onVerNota={verNota} onNuevaNota={nuevaNota} />
          ) : vista === "tipos-documento" ? (
            <TiposDocumento proyecto={proyecto} onVolver={() => navegar("inicio")} />
          ) : vista === "grupos" && grupoActivo ? (
            <GrupoDetalle
              proyecto={proyecto}
              grupo={grupoActivo}
              onVolver={() => setGrupoActivo(null)}
              onEliminado={() => setGrupoActivo(null)}
            />
          ) : vista === "grupos" ? (
            <Grupos proyecto={proyecto} onVolver={() => navegar("inicio")} onVerGrupo={setGrupoActivo} />
          ) : vista === "entidades" && entidadActiva ? (
            <EntidadDetalle
              proyecto={proyecto}
              entidad={entidadActiva}
              onVolver={() => setEntidadActiva(null)}
              onEliminada={() => setEntidadActiva(null)}
              onVerNota={verNota}
              onNuevaNota={nuevaNota}
              onVerDocumento={verDocumento}
            />
          ) : vista === "entidades" ? (
            <Entidades proyecto={proyecto} onVolver={() => navegar("inicio")} onVerEntidad={setEntidadActiva} />
          ) : vista === "scripts" && scriptActivo ? (
            <ScriptDetalle
              proyecto={proyecto}
              script={scriptActivo}
              onVolver={() => setScriptActivo(null)}
              onCambiado={setScriptActivo}
            />
          ) : vista === "scripts" ? (
            <Scripts proyecto={proyecto} onVolver={() => navegar("inicio")} onVerScript={setScriptActivo} />
          ) : vista === "webs" && idActivoActivo ? (
            <WebDetalle proyecto={proyecto} idActivo={idActivoActivo} onVolver={() => setIdActivoActivo(null)} />
          ) : vista === "webs" ? (
            <Webs proyecto={proyecto} onVolver={() => navegar("inicio")} onVerActivo={setIdActivoActivo} onVerCalendario={() => navegar("publicaciones")} />
          ) : vista === "publicaciones" ? (
            <Publicaciones proyecto={proyecto} onVolver={() => navegar("webs")} />
          ) : vista === "programaciones" && idProgramacionActiva ? (
            <ProgramacionDetalle
              proyecto={proyecto}
              idProgramacion={idProgramacionActiva}
              onVolver={() => setIdProgramacionActiva(null)}
              onVerDocumento={setIdDocumentoActivo}
              onVerNota={verNota}
            />
          ) : vista === "programaciones" ? (
            <Programaciones proyecto={proyecto} onVolver={() => navegar("inicio")} onVerProgramacion={setIdProgramacionActiva} />
          ) : vista === "notificaciones" ? (
            <Notificaciones
              proyecto={proyecto}
              onVolver={() => navegar("inicio")}
              onVerProgramacion={verProgramacion}
              onVerSeguimiento={() => navegar("seguimiento")}
              onVerWebs={() => navegar("webs")}
              onCambiadas={contarNoLeidas}
            />
          ) : vista === "ventas" ? (
            <Ventas
              proyecto={proyecto}
              esSuperadmin={esSuperadmin}
              onVolver={() => navegar("inicio")}
              onVerEntidad={verEntidad}
              onVerDocumento={verDocumento}
            />
          ) : vista === "seguimiento" ? (
            <Seguimiento
              proyecto={proyecto}
              esSuperadmin={esSuperadmin}
              onVolver={() => navegar("inicio")}
              onVerNota={verNota}
              onVerDocumento={verDocumento}
            />
          ) : vista === "bloc-notas" && notaActiva ? (
            <NotaBlocDetalle
              key={notaActiva.id ?? "nueva"}
              proyecto={proyecto}
              esSuperadmin={esSuperadmin}
              idNota={notaActiva.id}
              enlaceInicial={notaActiva.enlace}
              onVolver={() => setNotaActiva(null)}
              onCreada={(id) => setNotaActiva({ id })}
              onVerNota={verNota}
              onVerDocumento={verDocumento}
              onVerEntidad={verEntidad}
              onVerProgramacion={verProgramacion}
            />
          ) : vista === "bloc-notas" ? (
            <BlocNotas
              proyecto={proyecto}
              esSuperadmin={esSuperadmin}
              onVolver={() => navegar("inicio")}
              onVerNota={verNota}
              onNuevaNota={nuevaNota}
            />
          ) : vista === "inicio" ? (
            <Inicio
              proyecto={proyecto}
              esSuperadmin={esSuperadmin}
              onNavegar={navegar}
              onVerDocumento={verDocumento}
              onVerNota={verNota}
              onVerProgramacion={verProgramacion}
              onVerEntidad={verEntidad}
            />
          ) : vista === "actividad" ? (
            <Actividad proyecto={proyecto} onVolver={() => navegar("inicio")} onVerDocumento={setIdDocumentoActivo} />
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
        </Box>
      </AppShell.Main>
      {!esSuperadmin && (
        <AppShell.Aside p="md" style={{ userSelect: redimensionando ? "none" : undefined }}>
          <div
            onPointerDown={empezarRedimension}
            title="Arrastra para cambiar el ancho"
            style={{
              position: "absolute", left: -3, top: 0, bottom: 0, width: 6,
              cursor: "col-resize", zIndex: 1, touchAction: "none",
            }}
          />
          {chatMontado && <Chat proyecto={proyecto} onCerrar={() => setChatAbierto(false)} />}
        </AppShell.Aside>
      )}
    </AppShell>
  )
}
