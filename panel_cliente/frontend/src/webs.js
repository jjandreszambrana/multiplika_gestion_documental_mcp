// Etiquetas compartidas por las pantallas de "Webs y redes"
export const NIVELES = {
  lectura: { etiqueta: "Solo lectura", color: "gray", ayuda: "La IA y el panel solo consultan; no se puede proponer ningún cambio." },
  proponer: { etiqueta: "Proponer", color: "blue", ayuda: "La IA prepara cambios, pero solo se aprueban aquí, en el panel." },
  aplicar_confirmando: {
    etiqueta: "Aplicar confirmando", color: "teal",
    ayuda: "La IA puede aplicar los cambios cuando le digas que sí en la conversación (y también se aprueban aquí).",
  },
  autonomo: {
    etiqueta: "Autónomo acotado", color: "orange",
    ayuda: "Como el anterior y, además, la IA hace sola tareas pequeñas: de momento, solo moderar comentarios (p. ej. mandar el spam a la papelera).",
  },
}

export const ESTADOS_CAMBIO = {
  propuesto: { etiqueta: "Esperando aprobación", color: "blue" },
  aplicando: { etiqueta: "Aplicándose", color: "blue" },
  aplicado: { etiqueta: "Aplicado", color: "teal" },
  rechazado: { etiqueta: "Rechazado", color: "gray" },
  caducado: { etiqueta: "Caducado", color: "yellow" },
  fallido: { etiqueta: "Falló", color: "red" },
  deshaciendo: { etiqueta: "Deshaciéndose", color: "blue" },
  deshecho: { etiqueta: "Deshecho", color: "grape" },
}

export const TIPOS = { web: "Web", red_social: "Red social", base_datos: "Base de datos", dominio: "Dominio", otro: "Otro" }
export const PLATAFORMAS = {
  wordpress: "WordPress", woocommerce: "WooCommerce (WordPress)", a_medida: "Web hecha a medida", shopify: "Shopify",
  prestashop: "PrestaShop", wix: "Wix", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn",
  google_business: "Google Business", x: "X (Twitter)", tiktok: "TikTok", youtube: "YouTube", mysql: "MySQL / MariaDB",
  postgres: "PostgreSQL", otra: "Otra",
}

export const ESTADOS_VIGILANCIA = {
  ok: { etiqueta: "Bien", color: "teal" },
  aviso: { etiqueta: "Conviene mirarlo", color: "yellow" },
  grave: { etiqueta: "Problema", color: "red" },
  sin_datos: { etiqueta: "Sin datos", color: "gray" },
  error: { etiqueta: "No se pudo comprobar", color: "gray" },
}

export const FRECUENCIAS = [
  { value: "5", label: "Cada 5 minutos" }, { value: "15", label: "Cada 15 minutos" }, { value: "60", label: "Cada hora" },
  { value: "360", label: "Cada 6 horas" }, { value: "720", label: "Cada 12 horas" }, { value: "1440", label: "Una vez al día" },
  { value: "10080", label: "Una vez a la semana" },
]

export const MODOS = {
  directo: "Directa", tunel_ssh: "Por túnel SSH", conector: "A través del conector de su web WordPress",
  intermediario: "Por un servicio intermediario", sftp: "Archivos por SFTP", git: "Repositorio Git",
}
export const MODOS_POR_CAPACIDAD = { bd: ["directo", "tunel_ssh", "conector"], red: ["intermediario", "directo"], ficheros: ["sftp", "git"] }

// Qué guardar en la credencial según lo que es (se enseña al dar de alta)
export const AYUDA_CREDENCIAL = {
  wordpress: "Usuario de WordPress y una «contraseña de aplicación» (Usuarios → Perfil → Contraseñas de aplicación), nunca la contraseña normal. Para el conector, que sea de un administrador.",
  bd: "Usuario y contraseña de la base de datos, con los campos avanzados «host», «base_datos» y «puerto». Mejor un usuario con permiso solo de lectura si no se van a hacer cambios.",
  red: "Depende de la forma de conectar: la clave del servicio intermediario, o el token de acceso de la red (ver la ayuda de la pestaña Publicaciones).",
  ficheros: "SFTP: usuario y contraseña (o «clave_privada») con campos «host» y «puerto». Git: el token de acceso en el valor y la dirección del repositorio en el campo «repositorio».",
}

export const ESTADOS_PUBLICACION = {
  borrador: { etiqueta: "Borrador", color: "gray" }, pendiente: { etiqueta: "Pendiente de aprobar", color: "yellow" },
  aprobada: { etiqueta: "Aprobada", color: "blue" }, publicando: { etiqueta: "Publicándose", color: "blue" },
  publicada: { etiqueta: "Publicada", color: "teal" }, parcial: { etiqueta: "Publicada en parte", color: "orange" },
  error: { etiqueta: "Error", color: "red" }, cancelada: { etiqueta: "Cancelada", color: "gray" },
  retirada: { etiqueta: "Retirada", color: "grape" },
}
export const LIMITE_TEXTO = { x: 280, instagram: 2200, linkedin: 3000, google_business: 1500, facebook: 63206, tiktok: 2200, youtube: 5000 }
