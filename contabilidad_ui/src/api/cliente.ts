import { ErrorApi, ErrorRed } from './errores'

/**
 * Único punto de entrada a la API.
 *
 * Reglas que se cumplen aquí y en ningún otro sitio:
 * - Todo es POST con cuerpo JSON; los endpoints sin parámetros mandan `{}`.
 *   La única excepción es `/importador/subir`, que lleva un archivo.
 * - `credentials: "include"` siempre: la sesión es una cookie HttpOnly. El
 *   token no se lee ni se guarda, y no hay lógica de refresco ni reintentos.
 */

/**
 * A dónde van las llamadas y qué se añade a cada una. Por defecto, lo de la app
 * independiente: `/apisif/v1` y la cookie. Dentro del panel de la GD se cambia
 * con `configurarCliente` para ir por su proxy, con sus cabeceras.
 */
export interface ConfiguracionCliente {
  /** Lo que va delante de cada ruta (`/contabilidad/...`). */
  prefijo: string
  /** Cabeceras que se añaden a todas las peticiones. */
  cabeceras: () => Record<string, string>
  /** Se llama con cada respuesta que llega, buena o mala, antes de leerla. */
  trasRespuesta: (respuesta: Response) => void
}

const POR_DEFECTO: ConfiguracionCliente = {
  prefijo: '/apisif/v1',
  cabeceras: () => ({}),
  trasRespuesta: () => {},
}

let configuracion: ConfiguracionCliente = POR_DEFECTO

/** Cambia la configuración; lo que no se pase vuelve al valor por defecto. */
export function configurarCliente(cambios: Partial<ConfiguracionCliente>): void {
  configuracion = { ...POR_DEFECTO, ...cambios }
}

/** El `fetch` de todo el módulo: prefijo, cabeceras, cookie y gancho de respuesta. */
async function llamar(ruta: string, init: RequestInit, cfg: ConfiguracionCliente = configuracion): Promise<Response> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${cfg.prefijo}${ruta}`, {
      ...init,
      headers: { ...cfg.cabeceras(), ...(init.headers as Record<string, string>) },
      credentials: 'include',
    })
  } catch (causa) {
    throw new ErrorRed(causa)
  }
  cfg.trasRespuesta(respuesta)
  return respuesta
}

function textoDe(cuerpo: unknown, clave: string): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null || !(clave in cuerpo)) return null
  const valor = (cuerpo as Record<string, unknown>)[clave]
  return typeof valor === 'string' && valor !== '' ? valor : null
}

/**
 * La API tiene dos formas de error: los endpoints devuelven `{"detail": "..."}`
 * y el middleware de sesión devuelve `{"success": false, "message": "..."}`.
 * Se aceptan las dos; si no hay texto, queda el código.
 */
async function leerError(respuesta: Response): Promise<ErrorApi> {
  let detalle = `Error ${respuesta.status}`
  let cuerpo: unknown = null
  try {
    cuerpo = await respuesta.json()
    detalle = textoDe(cuerpo, 'detail') ?? textoDe(cuerpo, 'message') ?? detalle
  } catch {
    // El cuerpo no era JSON: nos quedamos con el código. Nunca se silencia.
  }
  // El cuerpo entero se guarda: hay errores que traen más que el texto, como
  // la lista de campos de las plantillas de asiento.
  return new ErrorApi(respuesta.status, detalle, cuerpo)
}

async function ejecutar<T>(ruta: string, init: RequestInit, cfg?: ConfiguracionCliente): Promise<T> {
  const respuesta = await llamar(ruta, init, cfg)
  if (!respuesta.ok) throw await leerError(respuesta)
  return (await respuesta.json()) as T
}

/**
 * POST de un formulario con un archivo dentro. La única llamada de la API que
 * no lleva cuerpo JSON es `/importador/subir`, porque lo que viaja es el
 * archivo. La cabecera del tipo la pone el navegador: si se pone a mano, falta
 * la frontera entre las partes y el servidor no puede leerlo.
 */
export function enviarFormulario<T>(ruta: string, datos: FormData): Promise<T> {
  return ejecutar<T>(ruta, { method: 'POST', body: datos })
}

/**
 * POST con cuerpo JSON. Es la forma de casi toda la API.
 *
 * `senal` sirve para cortar una petición que ya no interesa: al cambiar el
 * filtro del diario, lo que se estaba bajando deja de valer y sigue ocupando la
 * conexión. Quien aborta tiene que ignorar el fallo que llega después.
 */
export function pedir<T>(
  ruta: string,
  cuerpo: object = {},
  senal?: AbortSignal,
  cfg?: ConfiguracionCliente,
): Promise<T> {
  return ejecutar<T>(
    ruta,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: senal,
    },
    cfg,
  )
}

/** Un fichero que llega en el cuerpo de la respuesta, con el nombre que le puso el servidor. */
export interface Descarga {
  contenido: Blob
  nombre: string
  /** Las cabeceras de la respuesta: hay descargas que dicen qué pasó, como el 303. */
  cabeceras: Headers
}

/** El nombre que viaja en `Content-Disposition`. Vacío si no viene. */
function nombreDeLaCabecera(cabecera: string | null): string {
  if (cabecera === null) return ''
  // `filename*=UTF-8''algo.xlsx` manda sobre `filename="algo.xlsx"`: es el que
  // admite acentos, y el otro va detrás como recambio para navegadores viejos.
  const codificado = /filename\*=UTF-8''([^;]+)/i.exec(cabecera)
  if (codificado?.[1]) return decodeURIComponent(codificado[1])
  const simple = /filename="?([^";]+)"?/i.exec(cabecera)
  return simple?.[1] ?? ''
}

/**
 * POST que devuelve un fichero en vez de JSON, como las descargas de Excel. El
 * nombre lo pone el servidor en `Content-Disposition` y aquí no se inventa: si
 * un día cambia cómo se llaman, cambia allí.
 *
 * Un fallo llega igual que en el resto de la API, como JSON, así que se lee con
 * el mismo lector de errores.
 */
export async function descargar(
  ruta: string,
  cuerpo: object = {},
  senal?: AbortSignal,
  cfg?: ConfiguracionCliente,
): Promise<Descarga> {
  const respuesta = await llamar(
    ruta,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: senal,
    },
    cfg,
  )

  if (!respuesta.ok) throw await leerError(respuesta)

  return {
    contenido: await respuesta.blob(),
    nombre: nombreDeLaCabecera(respuesta.headers.get('Content-Disposition')),
    cabeceras: respuesta.headers,
  }
}

/** Si el fallo viene de haber abortado nosotros, no es un error que enseñar. */
export function esAbortada(fallo: unknown): boolean {
  const causa = fallo instanceof ErrorRed ? fallo.cause : fallo
  return causa instanceof DOMException && causa.name === 'AbortError'
}
