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

// Aparte de peticion(): esta manda multipart/form-data (subida de fichero),
// no JSON, así que no puede reutilizar el Content-Type fijo de arriba.
async function peticionConFichero(base, ruta, formData) {
  const headers = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${base}${ruta}`, { method: "POST", headers, body: formData })

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
  archivarDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/documentos/${idDocumento}/archivar`),
  desarchivarDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/documentos/${idDocumento}/desarchivar`),

  listarApiKeys: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/api-keys`),
  emitirApiKey: (idProyecto, nombre) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/api-keys`, { nombre: nombre || null }),
  revocarApiKey: (idApiKey) => peticion(BASE_CLIENTE, "POST", `/api-keys/${idApiKey}/revocar`),
  eliminarApiKey: (idApiKey) => peticion(BASE_CLIENTE, "DELETE", `/api-keys/${idApiKey}`),

  listarCredenciales: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/credenciales`),
  crearCredencial: (idProyecto, nombre, descripcion, valor) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/credenciales`, { nombre, descripcion, valor }),
  actualizarCredencial: (idProyecto, idCredencial, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/credenciales/${idCredencial}`, datos),
  eliminarCredencial: (idProyecto, idCredencial) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/credenciales/${idCredencial}`),

  listarEstilos: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/estilos`),
  crearEstilo: (idProyecto, nombreTipo, instrucciones) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/estilos`, { nombre_tipo: nombreTipo, instrucciones }),
  actualizarEstilo: (idProyecto, idEstilo, instrucciones) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/estilos/${idEstilo}`, { instrucciones }),
  eliminarEstilo: (idProyecto, idEstilo) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/estilos/${idEstilo}`),
  listarImagenesEstilo: (idProyecto, idEstilo) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/estilos/${idEstilo}/imagenes`),
  subirImagenEstilo: (idProyecto, idEstilo, nombre, descripcionUso, archivo) => {
    const formData = new FormData()
    formData.append("nombre", nombre)
    formData.append("descripcion_uso", descripcionUso)
    formData.append("archivo", archivo)
    return peticionConFichero(BASE_CLIENTE, `/proyectos/${idProyecto}/estilos/${idEstilo}/imagenes`, formData)
  },
  // Devuelve un blob, no JSON: el <img> no puede mandar la cabecera
  // Authorization él solo, así que se trae aquí y se muestra con un
  // object URL (ver Estilos.jsx) en vez de poner el token en la URL.
  obtenerImagenEstiloBlob: async (idProyecto, idEstilo, idImagen) => {
    const headers = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(
      `${BASE_CLIENTE}/proyectos/${idProyecto}/estilos/${idEstilo}/imagenes/${idImagen}/contenido`,
      { headers },
    )
    if (!res.ok) throw new Error(res.statusText)
    return res.blob()
  },
  eliminarImagenEstilo: (idProyecto, idEstilo, idImagen) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/estilos/${idEstilo}/imagenes/${idImagen}`),
}
