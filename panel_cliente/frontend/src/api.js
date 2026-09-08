// Este panel habla con DOS backends: el login y el listado de proyectos
// son del panel de administración del repo core (se reutilizan tal
// cual, mismo usuario/contraseña de la empresa); los documentos son de
// este proyecto (panel_cliente/servidor.py, junto a las herramientas MCP).
// En producción ambos viven bajo el mismo dominio (mismo origen); en
// desarrollo son dos puertos de Vite/FastAPI distintos.
const BASE_ADMIN = import.meta.env.VITE_API_ADMIN || "http://127.0.0.1:8001/v1"
const BASE_CLIENTE = import.meta.env.VITE_API_CLIENTE || "http://127.0.0.1:8002/v1"

let token = null

export function setToken(nuevoToken) {
  token = nuevoToken
}

async function peticion(base, metodo, ruta, cuerpo) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })

  if (!res.ok) {
    let detalle = res.statusText
    try {
      const cuerpoError = await res.json()
      detalle = cuerpoError.detail || detalle
    } catch {
      // el cuerpo de error no era JSON, nos quedamos con statusText
    }
    throw new Error(detalle)
  }
  if (res.status === 204) return null
  return res.json()
}

// Lee id_usuario/id_tenant del token sin comprobar la firma — solo para
// saber qué mostrar; el servidor vuelve a comprobar todo siempre.
export function leerToken(token) {
  const payload = token.split(".")[1]
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
}

export const api = {
  login: (email, password) => peticion(BASE_ADMIN, "POST", "/auth/login", { email, password }),

  listarProyectosDeLaEmpresa: (idTenant) => peticion(BASE_ADMIN, "GET", `/tenants/${idTenant}/proyectos`),
  verProyecto: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}`),

  listarOBuscarDocumentos: (idProyecto, q) =>
    peticion(
      BASE_CLIENTE, "GET",
      `/proyectos/${idProyecto}/documentos${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  obtenerDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}`),
}
