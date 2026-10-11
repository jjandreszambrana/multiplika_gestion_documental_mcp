import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import { ErrorApi } from './errores'
import type { components } from './types'

/*
 * Asientos predefinidos (plantillas de asiento). Contrato en el apartado
 * «17 sexies» de la guía de la API.
 *
 * Las respuestas salen de los tipos generados. La DEFINICIÓN de una plantilla
 * no: el OpenAPI la declara como un objeto libre, así que su forma está escrita
 * aquí a mano, copiada del esquema del motor (`lib/contabilidad/plantillas/
 * esquema.py` en el SIF). El catálogo, igual. Pedido en [5.11].
 */

type S = components['schemas']
const P = 'apps__apisif__v1__metodos__contabilidad___api_conta_plantillas__'

export type ResumenPlantilla = S['PlantillaEnLista']
export type VersionPlantilla = S['VersionPlantilla']
export type ErrorCampo = S['ErrorCampo']
export type ParametroResuelto = S['ParametroResuelto']
export type EjecucionPlantilla = S['Ejecucion']
export type Ejecucion = S[`${typeof P}RespuestaEjecutar`]
type RespuestaPrevisualizar = S[`${typeof P}RespuestaPrevisualizar`]
type AsientoApi = S['AsientoCalculado']

// --- La definición ------------------------------------------------------------

export type TipoParametro =
  | 'texto'
  | 'numero'
  | 'importe'
  | 'porcentaje'
  | 'fecha'
  | 'booleano'
  | 'seleccion'
  | 'cuenta'
  | 'tercero'
  | 'tabla'

export type EstadoInicial = 'borrador' | 'libro'

export interface OpcionParametro {
  valor: number | string
  etiqueta: string
}

/** Todo lo que no es clave, tipo ni texto suelto es una fórmula (texto). */
export interface Parametro {
  clave: string
  tipo: TipoParametro
  etiqueta?: string
  ayuda?: string
  obligatorio?: boolean
  defecto?: string | null
  visible_si?: string | null
  validacion?: string | null
  mensaje_validacion?: string
  filtro?: string | null
  /** Las fijas, o las que el servidor rellena para una selección con origen. */
  opciones?: OpcionParametro[] | null
  origen?: string | null
  columnas?: Parametro[] | null
  filas_minimas?: number
  filas_maximas?: number
  longitud_maxima?: number | null
  decimales?: number | null
}

export interface Variable {
  clave: string
  expr: string
}

export interface Linea {
  cuenta: string
  debe?: string
  haber?: string
  concepto?: string | null
  documento?: string | null
  id_obra?: string | null
  id_tipo_iva?: string | null
  si?: string | null
  repetir_por?: string | null
}

export interface AsientoPlantilla {
  fecha: string
  concepto?: string
  diario?: string | null
  lineas: Linea[]
}

export interface Opciones {
  autocuadre?: { cuenta: string; concepto?: string | null } | null
  reversion?: { fecha: string; concepto?: string | null } | null
  estado_inicial?: EstadoInicial
}

export interface Definicion {
  diario?: string
  parametros: Parametro[]
  variables?: Variable[]
  asientos: AsientoPlantilla[]
  opciones?: Opciones
}

export interface Plantilla extends Omit<S['RespuestaPlantilla'], 'definicion'> {
  definicion: Definicion
}

export interface FuncionDelCatalogo {
  nombre: string
  firma: string
  descripcion: string
  ejemplo: string
}

export interface Catalogo {
  tipos_parametro: string[]
  origenes: string[]
  campos_linea: string[]
  campos_tercero: string[]
  nombres_del_motor: string[]
  funciones: FuncionDelCatalogo[]
}

// --- El cálculo ----------------------------------------------------------------

export interface LineaCalculada {
  cuenta: string
  debe: Decimal
  haber: Decimal
  concepto: string
  /** Posición de la línea en la plantilla; nula en la de cuadre. */
  lineaPlantilla: number | null
  /** Fila de la tabla que la repite, desde 1. */
  fila: number | null
  autocuadre: boolean
}

export interface AsientoCalculado {
  orden: number
  papel: string
  /** Posición del asiento en la plantilla. */
  asientoPlantilla: number | null
  fecha: string | null
  concepto: string
  diario: string
  lineas: LineaCalculada[]
  totalDebe: Decimal
  totalHaber: Decimal
  diferencia: Decimal
  cuadra: boolean
}

export interface Previsualizacion {
  version: number | null
  estadoInicial: string
  parametros: ParametroResuelto[]
  asientos: AsientoCalculado[]
  errores: ErrorCampo[]
  valido: boolean
}

/** Lo tecleado, por clave del dato. Los importes van como cadena. */
export type ValoresPlantilla = Record<string, unknown>

/** De dónde sale lo que se calcula: una plantilla guardada o una sin guardar. */
export type Fuente = { id: number } | { definicion: Definicion }

function normalizarAsiento(a: AsientoApi): AsientoCalculado {
  return {
    orden: a.orden,
    papel: a.papel,
    asientoPlantilla: a.asiento_plantilla ?? null,
    fecha: a.fecha ?? null,
    concepto: a.concepto,
    diario: a.diario,
    lineas: (a.lineas ?? []).map((l) => ({
      cuenta: l.cuenta,
      debe: aDecimal(l.debe),
      haber: aDecimal(l.haber),
      concepto: l.concepto,
      lineaPlantilla: l.linea_plantilla ?? null,
      fila: l.fila ?? null,
      autocuadre: l.autocuadre,
    })),
    totalDebe: aDecimal(a.total_debe),
    totalHaber: aDecimal(a.total_haber),
    diferencia: aDecimal(a.diferencia),
    cuadra: a.cuadra,
  }
}

// --- Usar ------------------------------------------------------------------------

export async function listarPlantillas(incluirInactivas = false): Promise<ResumenPlantilla[]> {
  const r = await pedir<S['RespuestaListar']>('/contabilidad/plantillas/listar', {
    incluir_inactivas: incluirInactivas,
  })
  return r.plantillas ?? []
}

/** La vigente, o la versión que se pida. */
export function obtenerPlantilla(id: number, version = 0): Promise<Plantilla> {
  return pedir<Plantilla>('/contabilidad/plantillas/obtener', { id, version })
}

/**
 * Calcula sin grabar. Los datos mal puestos no son un fallo: llegan en
 * `errores` con un 200. Un 400 es que la plantilla está rota.
 */
export async function previsualizar(
  fuente: Fuente,
  parametros: ValoresPlantilla,
  senal?: AbortSignal,
): Promise<Previsualizacion> {
  const r = await pedir<RespuestaPrevisualizar>(
    '/contabilidad/plantillas/previsualizar',
    { ...fuente, parametros },
    senal,
  )
  return {
    version: r.version ?? null,
    estadoInicial: r.estado_inicial,
    parametros: r.parametros ?? [],
    asientos: (r.asientos ?? []).map(normalizarAsiento),
    errores: r.errores ?? [],
    valido: r.valido,
  }
}

/**
 * Graba. Con la `version` que tenía delante el contable: si alguien ha guardado
 * otra entretanto, el servidor no graba y responde 400.
 */
export function ejecutar(
  id: number,
  version: number,
  parametros: ValoresPlantilla,
): Promise<Ejecucion> {
  return pedir<Ejecucion>('/contabilidad/plantillas/ejecutar', { id, version, parametros })
}

/** De quién es un 400 de plantillas: de los datos, de la plantilla, o de nada en concreto. */
export interface FalloDePlantilla {
  clave: 'plantilla_datos' | 'plantilla_definicion' | null
  errores: ErrorCampo[]
}

/** Lee la lista de errores de un 400 de plantillas. Nulo si el fallo es otro. */
export function falloDePlantilla(fallo: unknown): FalloDePlantilla | null {
  if (!(fallo instanceof ErrorApi) || fallo.estado !== 400) return null
  const cuerpo = fallo.cuerpo
  if (typeof cuerpo !== 'object' || cuerpo === null) return { clave: null, errores: [] }
  const { clave_error: clave, errores } = cuerpo as Record<string, unknown>
  const lista = Array.isArray(errores)
    ? errores.filter(
        (e: unknown): e is ErrorCampo =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as Record<string, unknown>).ruta === 'string' &&
          typeof (e as Record<string, unknown>).mensaje === 'string',
      )
    : []
  return {
    clave: clave === 'plantilla_datos' || clave === 'plantilla_definicion' ? clave : null,
    errores: lista,
  }
}

// --- Diseñar -------------------------------------------------------------------

export function obtenerCatalogo(): Promise<Catalogo> {
  return pedir<Catalogo>('/contabilidad/plantillas/catalogo', {})
}

export function comprobarDefinicion(definicion: Definicion): Promise<S['RespuestaComprobar']> {
  return pedir<S['RespuestaComprobar']>('/contabilidad/plantillas/comprobar_definicion', {
    definicion,
  })
}

export interface Cabecera {
  codigo: string
  nombre: string
  descripcion: string
}

export function crearPlantilla(cabecera: Cabecera, definicion: Definicion): Promise<Plantilla> {
  return pedir<Plantilla>('/contabilidad/plantillas/crear', { ...cabecera, definicion })
}

/** Sin `definicion`, solo cambian los textos y no hay versión nueva. */
export function editarPlantilla(
  id: number,
  nombre: string,
  descripcion: string,
  definicion?: Definicion,
): Promise<Plantilla> {
  return pedir<Plantilla>('/contabilidad/plantillas/editar', {
    id,
    nombre,
    descripcion,
    ...(definicion === undefined ? {} : { definicion }),
  })
}

export function duplicarPlantilla(id: number, codigoNuevo: string, nombre: string): Promise<Plantilla> {
  return pedir<Plantilla>('/contabilidad/plantillas/duplicar', {
    id,
    codigo_nuevo: codigoNuevo,
    nombre,
  })
}

/** Retirar o volver a poner en uso. No se borran nunca. */
export async function cambiarActiva(id: number, activa: boolean): Promise<void> {
  await pedir(`/contabilidad/plantillas/${activa ? 'activar' : 'desactivar'}`, { id })
}

export async function listarVersiones(id: number): Promise<VersionPlantilla[]> {
  const r = await pedir<S['RespuestaVersiones']>('/contabilidad/plantillas/versiones', { id })
  return r.versiones ?? []
}

// --- Historial ------------------------------------------------------------------

const POR_TANDA = 100
const MAXIMO_TANDAS = 50

/**
 * Todo lo que se ha hecho con plantillas, o con una. Se trae entero, en tandas:
 * un listado se recorre, no se pagina.
 */
export async function listarEjecuciones(id: number | null): Promise<EjecucionPlantilla[]> {
  const todas: EjecucionPlantilla[] = []
  for (let tanda = 0; tanda < MAXIMO_TANDAS; tanda += 1) {
    const r = await pedir<S['RespuestaEjecuciones']>('/contabilidad/plantillas/ejecuciones/listar', {
      ...(id === null ? {} : { id }),
      limite: POR_TANDA,
      desplazamiento: tanda * POR_TANDA,
    })
    const lote = r.ejecuciones ?? []
    todas.push(...lote)
    if (lote.length === 0 || todas.length >= r.total) break
  }
  return todas
}
