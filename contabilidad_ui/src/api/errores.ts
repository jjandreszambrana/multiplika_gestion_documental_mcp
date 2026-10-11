/** Error de la API. La API devuelve siempre `{"detail": "..."}`. */
export class ErrorApi extends Error {
  readonly estado: number
  /** Texto del backend. En un 400 está escrito para el contable: se muestra tal cual. */
  readonly detalle: string
  /** El cuerpo entero, para las respuestas que traen más que un texto. */
  readonly cuerpo: unknown

  constructor(estado: number, detalle: string, cuerpo: unknown = null) {
    super(detalle)
    this.name = 'ErrorApi'
    this.estado = estado
    this.detalle = detalle
    this.cuerpo = cuerpo
  }

  /** No hay sesión: hay que ir a login. */
  get esSinSesion(): boolean {
    return this.estado === 401
  }

  /** Falta elegir empresa: hay que ir al selector. */
  get esSinEmpresa(): boolean {
    return this.estado === 409
  }

  /** Sin acceso o nivel insuficiente: la acción no debía estar visible. */
  get esSinPermiso(): boolean {
    return this.estado === 403
  }
}

/** Fallo de red: ni siquiera se llegó a la API. */
export class ErrorRed extends Error {
  constructor(causa: unknown) {
    super('No se pudo contactar con el servidor.')
    this.name = 'ErrorRed'
    this.cause = causa
  }
}

/**
 * Texto que se enseña al usuario. El `detalle` del backend se muestra tal cual:
 * en un 400 está escrito para el contable y dice más que cualquier genérico.
 */
export function textoDeError(error: unknown): string {
  if (error instanceof ErrorApi) return error.detalle
  if (error instanceof ErrorRed) return error.message
  return 'Ha ocurrido un error inesperado.'
}
