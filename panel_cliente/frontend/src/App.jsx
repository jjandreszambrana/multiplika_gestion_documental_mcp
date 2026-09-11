import { useEffect, useState } from "react"
import { Anchor, Box, Container, Group, Text, Title } from "@mantine/core"
import { api, cargarTokenGuardado, leerToken, setToken } from "./api"

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
import Credenciales from "./paginas/Credenciales"
import Estilos from "./paginas/Estilos"
import EstiloDetalle from "./paginas/EstiloDetalle"
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
  const [vista, setVista] = useState("documentos")
  const [comprobandoEnlace, setComprobandoEnlace] = useState(true)
  const [error, setError] = useState(null)

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
    setVista("documentos")
    localStorage.removeItem(CLAVE_PROYECTO)
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
      <Box>
        <Box component="header" bg="white" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
          <Group justify="space-between" px="xl" py="md">
            <Title order={3}>Gestión documental</Title>
            <Anchor component="button" type="button" onClick={cerrarSesion}>
              Cerrar sesión
            </Anchor>
          </Group>
        </Box>
        <Container size="md" py="xl">
          {error && <Text c="red">{error}</Text>}
          {esSuperadmin ? (
            <Text>No se ha podido cargar el proyecto del enlace.</Text>
          ) : (
            <ElegirProyecto idTenant={sesion.id_tenant} onElegir={elegirProyecto} />
          )}
        </Container>
      </Box>
    )
  }

  return (
    <Box>
      <Box component="header" bg="white" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        <Group justify="space-between" px="xl" py="md">
          <Title order={3}>Gestión documental{esSuperadmin && " — modo soporte"}</Title>
          <Anchor component="button" type="button" onClick={cerrarSesion}>
            Cerrar sesión
          </Anchor>
        </Group>
      </Box>

      <Container size="md" py="xl">
        {idDocumentoActivo ? (
          <DocumentoDetalle
            proyecto={proyecto}
            idDocumento={idDocumentoActivo}
            onVolver={() => setIdDocumentoActivo(null)}
          />
        ) : vista === "api-keys" ? (
          <ApiKeys proyecto={proyecto} onVolver={() => setVista("documentos")} />
        ) : vista === "credenciales" ? (
          <Credenciales proyecto={proyecto} onVolver={() => setVista("documentos")} />
        ) : vista === "usuarios" ? (
          <Usuarios proyecto={proyecto} onVolver={() => setVista("documentos")} />
        ) : vista === "avisos" ? (
          <Avisos proyecto={proyecto} onVolver={() => setVista("documentos")} />
        ) : vista === "cuenta-email" ? (
          <CuentaCorreo proyecto={proyecto} onVolver={() => setVista("documentos")} />
        ) : vista === "ayuda" ? (
          <Ayuda onVolver={() => setVista("documentos")} />
        ) : vista === "estilos" && estiloActivo ? (
          <EstiloDetalle proyecto={proyecto} estilo={estiloActivo} onVolver={() => setEstiloActivo(null)} />
        ) : vista === "estilos" ? (
          <Estilos proyecto={proyecto} onVolver={() => setVista("documentos")} onVerEstilo={setEstiloActivo} />
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
            onVerApiKeys={proyecto.es_admin ? () => setVista("api-keys") : null}
            onVerCredenciales={proyecto.es_admin ? () => setVista("credenciales") : null}
            onVerUsuarios={proyecto.es_admin ? () => setVista("usuarios") : null}
            onVerAvisos={proyecto.es_admin ? () => setVista("avisos") : null}
            onVerCuentaEmail={proyecto.es_admin ? () => setVista("cuenta-email") : null}
            onVerAyuda={() => setVista("ayuda")}
            onVerEstilos={() => {
              setEstiloActivo(null)
              setVista("estilos")
            }}
          />
        )}
      </Container>
    </Box>
  )
}
