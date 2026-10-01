// Este panel habla con DOS backends: el login y el listado de proyectos
// son del panel de administración del repo core (se reutilizan tal
// cual, mismo usuario/contraseña de la empresa); los documentos son de
// este proyecto (panel_cliente/servidor.py, junto a las herramientas MCP).
// En producción ambos viven bajo el mismo dominio (mismo origen); en
// desarrollo son dos puertos de Vite/FastAPI distintos.
const BASE_ADMIN = import.meta.env.VITE_API_ADMIN || "http://127.0.0.1:8001/v1"
const BASE_CLIENTE = import.meta.env.VITE_API_CLIENTE || "http://127.0.0.1:8002/v1"

// Antes el token solo vivía en esta variable: una recarga de página lo
// perdía aunque siguiera siendo válido, obligando a volver a entrar todo
// el rato. Se guarda también en localStorage y se recupera al cargar la
// página (ver cargarTokenGuardado, usada desde App.jsx).
const CLAVE_TOKEN = "gd_panel_token"

let token = null

function tokenSinCaducar(t) {
  try {
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    return !payload.exp || payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function cargarTokenGuardado() {
  const guardado = localStorage.getItem(CLAVE_TOKEN)
  if (!guardado || !tokenSinCaducar(guardado)) {
    localStorage.removeItem(CLAVE_TOKEN)
    return null
  }
  token = guardado
  return guardado
}

export function setToken(nuevoToken) {
  token = nuevoToken
  if (nuevoToken) {
    localStorage.setItem(CLAVE_TOKEN, nuevoToken)
  } else {
    localStorage.removeItem(CLAVE_TOKEN)
  }
}

// El backend renueva el token solo (sesión caducada hace menos de 48h,
// ver lib/jwt_tokens.py del núcleo) devolviéndolo en esta cabecera — así
// no hace falta volver a iniciar sesión mientras se siga usando el panel
// de vez en cuando, aunque hayan pasado los 30 días de vigencia normal.
function _capturarTokenRenovado(res) {
  const nuevo = res.headers.get("X-Nuevo-Token")
  if (nuevo) setToken(nuevo)
}

async function peticion(base, metodo, ruta, cuerpo) {
  const headers = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })
  _capturarTokenRenovado(res)

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
  _capturarTokenRenovado(res)

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
  login: (email, password, idTenant) =>
    peticion(BASE_ADMIN, "POST", "/auth/login", { email, password, id_tenant: idTenant ?? null }),
  empresasDeEmail: (email) => peticion(BASE_ADMIN, "GET", `/auth/empresas?email=${encodeURIComponent(email)}`),
  misEmpresas: () => peticion(BASE_ADMIN, "GET", "/auth/mis-empresas"),
  cambiarEmpresa: (idTenant) => peticion(BASE_ADMIN, "POST", "/auth/cambiar-empresa", { id_tenant: idTenant }),

  listarProyectosDeLaEmpresa: (idTenant) => peticion(BASE_ADMIN, "GET", `/tenants/${idTenant}/proyectos`),
  verProyecto: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}`),
  obtenerAyuda: () => peticion(BASE_CLIENTE, "GET", "/ayuda"),
  obtenerSeccionAyuda: (idSeccion) => peticion(BASE_CLIENTE, "GET", `/ayuda/${idSeccion}`),

  // Gestión de usuarios/roles: vive en el backend del panel de
  // administración (mismo JWT, se puede llamar desde aquí igual que
  // login/listarProyectosDeLaEmpresa) — permitido para admin_tenant de
  // este proyecto, no solo para superadmin (ver _api_usuarios.py del core).
  listarUsuarios: (idTenant, idProyecto) =>
    peticion(BASE_ADMIN, "GET", `/tenants/${idTenant}/usuarios?id_proyecto=${idProyecto}`),
  crearUsuario: (idTenant, idProyecto, nombre, email, password) =>
    peticion(BASE_ADMIN, "POST", `/tenants/${idTenant}/usuarios?id_proyecto=${idProyecto}`, {
      nombre, email, password,
    }),
  actualizarUsuario: (idTenant, idProyecto, idUsuario, nombre, email, password) =>
    peticion(BASE_ADMIN, "PUT", `/tenants/${idTenant}/usuarios/${idUsuario}?id_proyecto=${idProyecto}`, {
      nombre, email, password: password || null,
    }),
  listarRolesProyecto: (idProyecto) => peticion(BASE_ADMIN, "GET", `/proyectos/${idProyecto}/usuarios`),
  asignarRol: (idProyecto, idUsuario, idRol) =>
    peticion(BASE_ADMIN, "POST", `/proyectos/${idProyecto}/usuarios/${idUsuario}/rol`, { id_rol: idRol }),
  quitarRol: (idProyecto, idUsuario) =>
    peticion(BASE_ADMIN, "DELETE", `/proyectos/${idProyecto}/usuarios/${idUsuario}/rol`),

  listarOBuscarDocumentos: (idProyecto, q, filtros = {}) => {
    const parametros = new URLSearchParams()
    if (q) parametros.set("q", q)
    if (filtros.tipoDocumento) parametros.set("tipo_documento", filtros.tipoDocumento)
    if (filtros.fechaDesde) parametros.set("fecha_desde", filtros.fechaDesde)
    if (filtros.fechaHasta) parametros.set("fecha_hasta", filtros.fechaHasta)
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos${query ? `?${query}` : ""}`)
  },
  obtenerDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}`),
  // Alta manual desde el panel (sin pasar por la IA, ver docs/gestion-documental.md
  // → "Alta manual desde el panel"): el markdown ya viene escrito/pegado por
  // quien lo crea; el archivo original (si lo hay) es solo referencia, no se
  // convierte.
  crearDocumento: (idProyecto, datos) => {
    const formData = new FormData()
    formData.append("nombre", datos.nombre)
    formData.append("tipo_documento", datos.tipoDocumento)
    formData.append("markdown", datos.markdown)
    formData.append("fecha_documento", datos.fechaDocumento)
    if (datos.fechaCaducidad) formData.append("fecha_caducidad", datos.fechaCaducidad)
    if (datos.ambito) formData.append("ambito", datos.ambito)
    formData.append("todas_versiones_buscables", datos.todasVersionesBuscables ? "true" : "false")
    if (datos.archivoOriginal) formData.append("archivo_original", datos.archivoOriginal)
    return peticionConFichero(BASE_CLIENTE, `/proyectos/${idProyecto}/documentos`, formData)
  },
  // Igual que descargarDocumentoPdfBlob: necesita la cabecera Authorization,
  // así que no puede ser un <a href> normal.
  descargarArchivoOriginalBlob: async (idProyecto, idDocumento, idVersion) => {
    const headers = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(
      `${BASE_CLIENTE}/proyectos/${idProyecto}/documentos/${idDocumento}/versiones/${idVersion}/archivo-original`,
      { headers },
    )
    if (!res.ok) {
      let detalle = res.statusText
      try {
        detalle = (await res.json()).detail || detalle
      } catch {
        // el cuerpo de error no era JSON
      }
      throw new Error(detalle)
    }
    const disposicion = res.headers.get("Content-Disposition") || ""
    const coincidencia = disposicion.match(/filename\*=UTF-8''(.+)$/)
    const nombreFichero = coincidencia ? decodeURIComponent(coincidencia[1]) : "documento"
    return { blob: await res.blob(), nombreFichero }
  },
  archivarDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/documentos/${idDocumento}/archivar`),
  desarchivarDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/documentos/${idDocumento}/desarchivar`),
  eliminarDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/documentos/${idDocumento}`),
  cambiarReservadoDocumento: (idProyecto, idDocumento, reservado) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/documentos/${idDocumento}/reservado`, { reservado }),
  actualizarMetadatosDocumento: (idProyecto, idDocumento, metadatos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/documentos/${idDocumento}/metadatos`, metadatos),
  guardarBorradorDocumento: (idProyecto, idDocumento, idVersion, markdown) =>
    peticion(
      BASE_CLIENTE, "PUT",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/versiones/${idVersion}/borrador`,
      { markdown },
    ),
  confirmarEdicionDocumento: (idProyecto, idDocumento, idVersion) =>
    peticion(
      BASE_CLIENTE, "POST",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/versiones/${idVersion}/confirmar-edicion`,
    ),
  listarHistorialDocumento: (idProyecto, idDocumento, idVersion) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/versiones/${idVersion}/historial`),
  obtenerDiffHistorial: (idProyecto, idDocumento, idVersion, idRegistro) =>
    peticion(
      BASE_CLIENTE, "GET",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/versiones/${idVersion}/historial/${idRegistro}/diff`,
    ),
  revertirDocumento: (idProyecto, idDocumento, idVersion, idRegistro) =>
    peticion(
      BASE_CLIENTE, "POST",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/versiones/${idVersion}/revertir/${idRegistro}`,
    ),

  obtenerContextoNegocio: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/contexto`),
  actualizarContextoNegocio: (idProyecto, texto) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/contexto`, { texto }),
  actualizarPreferenciasNegocio: (idProyecto, texto) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/preferencias`, { texto }),

  listarApiKeys: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/api-keys`),
  emitirApiKey: (idProyecto, nombre, idRol, idUsuario) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/api-keys`, { nombre, id_rol: idRol, id_usuario: idUsuario }),
  renombrarApiKey: (idApiKey, nombre) => peticion(BASE_CLIENTE, "PUT", `/api-keys/${idApiKey}`, { nombre }),
  revocarApiKey: (idApiKey) => peticion(BASE_CLIENTE, "POST", `/api-keys/${idApiKey}/revocar`),
  eliminarApiKey: (idApiKey) => peticion(BASE_CLIENTE, "DELETE", `/api-keys/${idApiKey}`),

  listarCredenciales: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/credenciales`),
  crearCredencial: (idProyecto, nombre, descripcion, valor, usuario, camposExtra = []) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/credenciales`, {
      nombre, descripcion, valor, usuario: usuario || null, campos_extra: camposExtra,
    }),
  actualizarCredencial: (idProyecto, idCredencial, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/credenciales/${idCredencial}`, datos),
  eliminarCredencial: (idProyecto, idCredencial) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/credenciales/${idCredencial}`),

  listarCertificados: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/certificados`),
  subirCertificado: (idProyecto, { nombre, descripcion, idEntidad, contrasena, archivo }) => {
    const formData = new FormData()
    formData.append("nombre", nombre)
    if (descripcion) formData.append("descripcion", descripcion)
    if (idEntidad) formData.append("id_entidad", idEntidad)
    if (contrasena) formData.append("contrasena", contrasena)
    formData.append("archivo", archivo)
    return peticionConFichero(BASE_CLIENTE, `/proyectos/${idProyecto}/certificados`, formData)
  },
  actualizarCertificado: (idProyecto, idCertificado, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/certificados/${idCertificado}`, datos),
  eliminarCertificado: (idProyecto, idCertificado) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/certificados/${idCertificado}`),
  listarLogCertificado: (idProyecto, idCertificado) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/certificados/${idCertificado}/log`),
  // Igual que descargarDocumentoPdfBlob: la descarga necesita la cabecera
  // Authorization (y aquí además queda registrada en el log de uso), así
  // que no puede ser un <a href> normal.
  descargarCertificadoBlob: async (idProyecto, idCertificado) => {
    const headers = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(`${BASE_CLIENTE}/proyectos/${idProyecto}/certificados/${idCertificado}/archivo`, { headers })
    if (!res.ok) {
      let detalle = res.statusText
      try {
        detalle = (await res.json()).detail || detalle
      } catch {
        // el cuerpo de error no era JSON
      }
      throw new Error(detalle)
    }
    const disposicion = res.headers.get("Content-Disposition") || ""
    const coincidencia = disposicion.match(/filename\*=UTF-8''(.+)$/)
    const nombreFichero = coincidencia ? decodeURIComponent(coincidencia[1]) : "certificado"
    return { blob: await res.blob(), nombreFichero }
  },

  listarDocumentosPendientes: (idProyecto) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos-pendientes`),
  subirDocumentosPendientes: (idProyecto, archivos) => {
    const formData = new FormData()
    for (const archivo of archivos) formData.append("archivos", archivo)
    return peticionConFichero(BASE_CLIENTE, `/proyectos/${idProyecto}/documentos-pendientes`, formData)
  },
  eliminarDocumentoPendiente: (idProyecto, idPendiente) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/documentos-pendientes/${idPendiente}`),
  vistaPreviaDocumentoPendiente: (idProyecto, idPendiente) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos-pendientes/${idPendiente}/vista-previa`),
  estructurarDocumentoPendiente: (idProyecto, idPendiente, texto) =>
    peticion(
      BASE_CLIENTE, "POST",
      `/proyectos/${idProyecto}/documentos-pendientes/${idPendiente}/estructurar`, { texto },
    ),

  listarNotasDocumento: (idProyecto, idDocumento, tipo) =>
    peticion(
      BASE_CLIENTE, "GET",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/notas${tipo ? `?tipo=${tipo}` : ""}`,
    ),
  crearNotaDocumento: (idProyecto, idDocumento, datos) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/documentos/${idDocumento}/notas`, datos),
  resolverIncidencia: (idProyecto, idDocumento, idNota, textoResolucion) =>
    peticion(
      BASE_CLIENTE, "POST",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/notas/${idNota}/resolver`,
      { texto_resolucion: textoResolucion },
    ),
  asignarResponsableNota: (idProyecto, idDocumento, idNota, responsable, responsableEmail) =>
    peticion(
      BASE_CLIENTE, "PUT",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/notas/${idNota}/responsable`,
      { responsable: responsable || null, responsable_email: responsableEmail || null },
    ),
  relacionarNotas: (idProyecto, idDocumento, idOrigen, idDestino, tipoRelacion) =>
    peticion(
      BASE_CLIENTE, "POST",
      `/proyectos/${idProyecto}/documentos/${idDocumento}/notas/${idOrigen}/relaciones`,
      { id_destino: idDestino, tipo_relacion: tipoRelacion || null },
    ),

  listarEntidades: (idProyecto, q, tipo) => {
    const parametros = new URLSearchParams()
    if (q) parametros.set("q", q)
    if (tipo) parametros.set("tipo", tipo)
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/entidades${query ? `?${query}` : ""}`)
  },
  crearEntidad: (idProyecto, datos) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/entidades`, datos),
  obtenerEntidad: (idProyecto, idEntidad) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/entidades/${idEntidad}`),
  actualizarEntidad: (idProyecto, idEntidad, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/entidades/${idEntidad}`, datos),
  eliminarEntidad: (idProyecto, idEntidad) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/entidades/${idEntidad}`),
  listarDocumentosEntidad: (idProyecto, idEntidad) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/entidades/${idEntidad}/documentos`),
  relacionarDocumentoEntidad: (idProyecto, idEntidad, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/entidades/${idEntidad}/documentos`, { id_documento: idDocumento }),
  quitarRelacionDocumentoEntidad: (idProyecto, idEntidad, idDocumento) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/entidades/${idEntidad}/documentos/${idDocumento}`),
  listarEntidadesDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/entidades`),

  detectarVariablesDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/variables`),
  listarEnviosDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/envios`),
  crearEnvios: (idProyecto, idDocumento, datos) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/documentos/${idDocumento}/envios`, datos),
  listarEnviosEntidad: (idProyecto, idEntidad) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/entidades/${idEntidad}/envios`),
  cancelarEnvio: (idProyecto, idEnvio) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/envios/${idEnvio}/cancelar`),
  reintentarEnvio: (idProyecto, idEnvio) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/envios/${idEnvio}/reintentar`),
  listarCompartidos: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/compartidos`),
  crearCompartido: (idProyecto, idDocumento, datos) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/documentos/${idDocumento}/compartidos`, datos),
  anularCompartido: (idProyecto, idCompartido) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/compartidos/${idCompartido}/anular`),

  listarGrupos: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/grupos`),
  crearGrupo: (idProyecto, nombre, proposito) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/grupos`, { nombre, proposito }),
  actualizarGrupo: (idProyecto, idGrupo, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/grupos/${idGrupo}`, datos),
  eliminarGrupo: (idProyecto, idGrupo) => peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/grupos/${idGrupo}`),
  listarDocumentosGrupo: (idProyecto, idGrupo) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/grupos/${idGrupo}/documentos`),
  asignarDocumentoGrupo: (idProyecto, idGrupo, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/grupos/${idGrupo}/documentos`, { id_documento: idDocumento }),
  quitarDocumentoGrupo: (idProyecto, idGrupo, idDocumento) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/grupos/${idGrupo}/documentos/${idDocumento}`),
  listarGruposDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/grupos`),

  listarTiposDocumento: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/tipos-documento`),
  crearTipoDocumento: (idProyecto, nombre) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/tipos-documento`, { nombre }),
  eliminarTipoDocumento: (idProyecto, idTipo) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/tipos-documento/${idTipo}`),
  actualizarTipoDocumento: (idProyecto, idTipo, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/tipos-documento/${idTipo}`, datos),

  obtenerConfiguracionAvisos: (idProyecto) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/configuracion/avisos`),
  actualizarConfiguracionAvisos: (idProyecto, emailAvisos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/configuracion/avisos`, { email_avisos: emailAvisos || null }),

  obtenerCuentaEmail: (idProyecto) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/configuracion/cuenta-email`),
  actualizarCuentaEmail: (idProyecto, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/configuracion/cuenta-email`, datos),

  listarEstilos: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/estilos`),
  asignarEstiloDocumento: (idProyecto, idDocumento, idEstilo) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/documentos/${idDocumento}/estilo`, { id_estilo: idEstilo }),
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
  // Igual que obtenerImagenEstiloBlob: la descarga necesita la cabecera
  // Authorization, así que no puede ser un <a href> normal — se trae
  // como blob y quien llama arma la descarga en el navegador.
  descargarDocumentoPdfBlob: async (idProyecto, idDocumento, incluirMetadatos = false) => {
    const headers = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    const query = incluirMetadatos ? "?incluir_metadatos=true" : ""
    const res = await fetch(`${BASE_CLIENTE}/proyectos/${idProyecto}/documentos/${idDocumento}/pdf${query}`, { headers })
    if (!res.ok) {
      let detalle = res.statusText
      try {
        detalle = (await res.json()).detail || detalle
      } catch {
        // el cuerpo de error no era JSON
      }
      throw new Error(detalle)
    }
    return res.blob()
  },
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

  listarScripts: (idProyecto, q, lenguaje, incluirArchivados = false) => {
    const parametros = new URLSearchParams()
    if (q) parametros.set("q", q)
    if (lenguaje) parametros.set("lenguaje", lenguaje)
    if (incluirArchivados) parametros.set("incluir_archivados", "true")
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/scripts${query ? `?${query}` : ""}`)
  },
  obtenerScript: (idProyecto, idScript) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/scripts/${idScript}`),
  actualizarScript: (idProyecto, idScript, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/scripts/${idScript}`, datos),
  archivarScript: (idProyecto, idScript) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/scripts/${idScript}/archivar`),
  desarchivarScript: (idProyecto, idScript) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/scripts/${idScript}/desarchivar`),
  listarScriptsDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/scripts`),
  listarDocumentosScript: (idProyecto, idScript) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/scripts/${idScript}/documentos`),
  relacionarDocumentoScript: (idProyecto, idScript, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/scripts/${idScript}/documentos`, { id_documento: idDocumento }),
  quitarRelacionDocumentoScript: (idProyecto, idScript, idDocumento) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/scripts/${idScript}/documentos/${idDocumento}`),

  listarReglas: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/reglas`),
  listarReglasHeredadas: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/reglas/heredadas`),
  textoReglasGlobales: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/reglas/globales/texto`),
  crearRegla: (idProyecto, datos) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/reglas`, datos),
  actualizarRegla: (idProyecto, idRegla, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/reglas/${idRegla}`, datos),
  eliminarRegla: (idProyecto, idRegla) => peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/reglas/${idRegla}`),

  listarModelosRegistro: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/registros/modelos`),
  listarVersionesModeloRegistro: (idProyecto, idModelo) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/registros/modelos/${idModelo}/versiones`),
  crearModeloRegistro: (idProyecto, datos) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/registros/modelos`, datos),
  corregirModeloRegistro: (idProyecto, idModelo, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/registros/modelos/${idModelo}`, datos),
  nuevaVersionModeloRegistro: (idProyecto, idModelo, datos) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/registros/modelos/${idModelo}/versiones`, datos),
  cambiarActivoModeloRegistro: (idProyecto, idModelo, activo) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/registros/modelos/${idModelo}/activo`, { activo }),
  listarRegistros: (idProyecto, { idModelo, desde, hasta, conforme } = {}) => {
    const parametros = new URLSearchParams()
    if (idModelo) parametros.set("id_modelo", idModelo)
    if (desde) parametros.set("desde", desde)
    if (hasta) parametros.set("hasta", hasta)
    if (conforme !== undefined && conforme !== null) parametros.set("conforme", conforme)
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/registros${query ? `?${query}` : ""}`)
  },
  crearRegistro: (idProyecto, datos) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/registros`, datos),
  corregirRegistro: (idProyecto, idRegistro, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/registros/${idRegistro}`, datos),
  subirArchivoOriginalRegistro: (idProyecto, idRegistro, archivo) => {
    const formData = new FormData()
    formData.append("archivo", archivo)
    return peticionConFichero(BASE_CLIENTE, `/proyectos/${idProyecto}/registros/${idRegistro}/archivo-original`, formData)
  },
  // Igual que descargarArchivoOriginalBlob, pero del registro.
  descargarArchivoOriginalRegistroBlob: async (idProyecto, idRegistro) => {
    const headers = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(`${BASE_CLIENTE}/proyectos/${idProyecto}/registros/${idRegistro}/archivo-original`, {
      headers,
    })
    if (!res.ok) {
      let detalle = res.statusText
      try {
        detalle = (await res.json()).detail || detalle
      } catch {
        // el cuerpo de error no era JSON
      }
      throw new Error(detalle)
    }
    const disposicion = res.headers.get("Content-Disposition") || ""
    const coincidencia = disposicion.match(/filename\*=UTF-8''(.+)$/)
    const nombreFichero = coincidencia ? decodeURIComponent(coincidencia[1]) : "archivo"
    return { blob: await res.blob(), nombreFichero }
  },
  eliminarRegistro: (idProyecto, idRegistro) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/registros/${idRegistro}`),
  vincularDocumentoRegistro: (idProyecto, idRegistro, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/registros/${idRegistro}/documentos`, { id_documento: idDocumento }),
  desvincularDocumentoRegistro: (idProyecto, idRegistro, idDocumento) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/registros/${idRegistro}/documentos/${idDocumento}`),
  listarRegistrosDocumento: (idProyecto, idDocumento) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/documentos/${idDocumento}/registros`),

  listarConversacionesChat: (idProyecto) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/chat/conversaciones`),
  crearConversacionChat: (idProyecto, titulo) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/chat/conversaciones`, { titulo: titulo || null }),
  obtenerConversacionChat: (idProyecto, idConversacion) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/chat/conversaciones/${idConversacion}`),
  renombrarConversacionChat: (idProyecto, idConversacion, titulo) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/chat/conversaciones/${idConversacion}`, { titulo }),
  eliminarConversacionChat: (idProyecto, idConversacion) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/chat/conversaciones/${idConversacion}`),
  enviarMensajeChat: (idProyecto, idConversacion, mensaje) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/chat/conversaciones/${idConversacion}/mensajes`, { mensaje }),
  confirmarAccionChat: (idProyecto, confirmacionId, aceptar) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/chat/confirmar`, {
      confirmacion_id: confirmacionId, aceptar,
    }),

  listarEnlaces: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/enlaces`),
  enlazarConCentral: (idProyecto, nombre, urlMcp, apiKey) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/enlaces`, { nombre, url_mcp: urlMcp, api_key: apiKey }),
  probarEnlace: (idProyecto, idEnlace) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/enlaces/${idEnlace}/probar`),
  cambiarActivoEnlace: (idProyecto, idEnlace, activo) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/enlaces/${idEnlace}/activo`, { activo }),
  desenlazar: (idProyecto, idEnlace) => peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/enlaces/${idEnlace}`),
  listarPreguntasPendientes: (idProyecto, estado) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/preguntas-pendientes${estado ? `?estado=${estado}` : ""}`),
  cambiarEstadoPreguntaPendiente: (idProyecto, idPregunta, estado) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/preguntas-pendientes/${idPregunta}/estado`, { estado }),
  resumenUsoEnlaces: (idProyecto, mes) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/uso-enlaces?mes=${mes}`),

  listarDocumentosDeEnlazada: (idProyecto, idEnlace) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/enlaces/${idEnlace}/documentos`),
  aspirarAprendizaje: (idProyecto, idEnlace, idDocumento) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/aprendizajes`, { id_enlace: idEnlace, id_documento: idDocumento }),
  listarAprendizajes: (idProyecto, estado) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/aprendizajes${estado ? `?estado=${estado}` : ""}`),
  obtenerAprendizaje: (idProyecto, id) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/aprendizajes/${id}`),
  darViaLibreAprendizaje: (idProyecto, id) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/aprendizajes/${id}/via-libre`),
  editarAprendizaje: (idProyecto, id, markdown) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/aprendizajes/${id}`, { markdown_anonimizado: markdown }),
  aprobarAprendizaje: (idProyecto, id) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/aprendizajes/${id}/aprobar`),
  rechazarAprendizaje: (idProyecto, id, motivo) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/aprendizajes/${id}/rechazar`, { motivo: motivo || null }),
  reabrirAprendizaje: (idProyecto, id) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/aprendizajes/${id}/reabrir`),

  listarActividad: (idProyecto, filtros = {}) => {
    const parametros = new URLSearchParams()
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== "") parametros.set(clave, valor)
    }
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/actividad${query ? `?${query}` : ""}`)
  },
  listarQuienesActividad: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/actividad/quienes`),

  listarUsuariosProyecto: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/usuarios-proyecto`),
  listarProgramaciones: (idProyecto, filtros = {}) => {
    const parametros = new URLSearchParams()
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) parametros.set(clave, valor)
    }
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/programaciones${query ? `?${query}` : ""}`)
  },
  obtenerProgramacion: (idProyecto, id) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/programaciones/${id}`),
  crearProgramacion: (idProyecto, datos) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/programaciones`, datos),
  actualizarProgramacion: (idProyecto, id, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/programaciones/${id}`, datos),
  pausarProgramacion: (idProyecto, id) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/programaciones/${id}/pausar`),
  reanudarProgramacion: (idProyecto, id) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/programaciones/${id}/reanudar`),
  eliminarProgramacion: (idProyecto, id) => peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/programaciones/${id}`),

  listarNotificaciones: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/notificaciones`),
  contarNotificacionesNoLeidas: (idProyecto) =>
    peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/notificaciones/no-leidas`),
  leerNotificacion: (idProyecto, id) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/notificaciones/${id}/leida`),
  leerTodasNotificaciones: (idProyecto) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/notificaciones/leer-todas`),
  marcarAvisoHecho: (idProyecto, idEjecucion) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/avisos/${idEjecucion}/hecho`),

  // Filtros: texto, etiqueta, desde, hasta, id_documento, id_registro,
  // id_nota, archivadas ("no" | "si" | "todas"), solo_mias
  listarNotasBloc: (idProyecto, filtros = {}) => {
    const parametros = new URLSearchParams()
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== null && valor !== undefined && valor !== "" && valor !== false) parametros.set(clave, valor)
    }
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/bloc-notas${query ? `?${query}` : ""}`)
  },
  listarEtiquetasBloc: (idProyecto) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/bloc-notas/etiquetas`),
  obtenerNotaBloc: (idProyecto, id) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/bloc-notas/${id}`),
  crearNotaBloc: (idProyecto, datos) => peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/bloc-notas`, datos),
  actualizarNotaBloc: (idProyecto, id, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/bloc-notas/${id}`, datos),
  enlazarNotaBloc: (idProyecto, id, tipo, idDestino) =>
    peticion(BASE_CLIENTE, "POST", `/proyectos/${idProyecto}/bloc-notas/${id}/enlaces`, { tipo, id_destino: idDestino }),
  desenlazarNotaBloc: (idProyecto, id, tipo, idDestino) =>
    peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/bloc-notas/${id}/enlaces/${tipo}/${idDestino}`),
  eliminarNotaBloc: (idProyecto, id) => peticion(BASE_CLIENTE, "DELETE", `/proyectos/${idProyecto}/bloc-notas/${id}`),

  // tipo: "nota_bloc" | "documento" | "nota_documento". Filtros: estados
  // (lista), tipo, solo_mios, sin_responsable, incluir_archivados
  listarSeguimiento: (idProyecto, filtros = {}) => {
    const parametros = new URLSearchParams()
    for (const [clave, valor] of Object.entries(filtros)) {
      if (Array.isArray(valor) ? valor.length : valor) parametros.set(clave, Array.isArray(valor) ? valor.join(",") : valor)
    }
    const query = parametros.toString()
    return peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/seguimiento${query ? `?${query}` : ""}`)
  },
  obtenerSeguimiento: (idProyecto, tipo, id) => peticion(BASE_CLIENTE, "GET", `/proyectos/${idProyecto}/seguimiento/${tipo}/${id}`),
  // datos: { estado (null = sin estado), id_usuario_responsable (null = nadie), aplazado_hasta }
  cambiarSeguimiento: (idProyecto, tipo, id, datos) =>
    peticion(BASE_CLIENTE, "PUT", `/proyectos/${idProyecto}/seguimiento/${tipo}/${id}`, datos),
}
