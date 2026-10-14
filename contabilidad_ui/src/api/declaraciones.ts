import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { descargar, pedir, type Descarga } from './cliente'
import type { components } from './types'

/**
 * La ficha de una declaración guardada y todo lo que se hace con ella.
 *
 * Todas las rutas que cambian algo (nivel `apuntes`) devuelven la ficha entera
 * ya recalculada, así que la pantalla no recompone nada: pinta lo que llega.
 * Lo que no se puede hacer (presentada, contabilizada…) lo rechaza la API con
 * un 400 redactado para el contable; aquí solo se esconde el botón.
 */

type FichaApi = components['schemas']['RespuestaDeclaracion']
type CasillaApi = components['schemas']['CasillaDeclarada']
type AvisoApi = components['schemas']['AvisoDeclaracion']
type LineaApi = components['schemas']['LineaLiquidacion']
type DocumentoApi = components['schemas']['DocumentoDeclarado']
type ContabilizarApi = components['schemas']['RespuestaContabilizar']

export type LineaHistorial = components['schemas']['LineaHistorial']

export interface CasillaDeclarada extends Omit<CasillaApi, 'importe' | 'importe_calculado'> {
  /** Lo que vale: lo calculado o, si se ajustó, lo ajustado. */
  importe: Decimal
  /** Lo que daba el cálculo; en una ajustada, lo que daba cuando se ajustó. */
  importe_calculado: Decimal
}

export interface AvisoDeclaracion extends Omit<AvisoApi, 'importe'> {
  /** Lo que se queda fuera. Cero en los avisos que solo informan. */
  importe: Decimal
}

export interface FichaDeclaracion
  extends Omit<FichaApi, 'resultado' | 'cuotas_a_compensar' | 'casillas' | 'avisos' | 'historial'> {
  resultado: Decimal
  /** Null: se toman de la declaración anterior. */
  cuotas_a_compensar: Decimal | null
  casillas: CasillaDeclarada[]
  avisos: AvisoDeclaracion[]
  historial: LineaHistorial[]
}

/**
 * Los datos de partida que se pueden cambiar. Solo viaja lo que cambie: lo que
 * no venga se queda como está en la declaración.
 */
export interface CambiosDePartida {
  /** Cadena con punto decimal, o null para volver a tomarlas de la anterior. */
  cuotas_a_compensar?: string | null
  solicitar_devolucion?: boolean
  devolucion_mensual?: boolean
  forma_de_pago?: string
  iban?: string
  bic?: string
  criterio_caja?: boolean
  destinatario_criterio_caja?: boolean
  sii_voluntario?: boolean
  exonerado_390?: boolean
  gasolinas?: boolean
}

export interface LineaLiquidacion extends Omit<LineaApi, 'debe' | 'haber'> {
  debe: Decimal
  haber: Decimal
}

/** El asiento de la liquidación, ensayado o grabado. */
export interface Liquidacion
  extends Omit<
    ContabilizarApi,
    | 'lineas'
    | 'total_debe'
    | 'total_haber'
    | 'repercutido_declarado'
    | 'repercutido_contabilizado'
    | 'soportado_declarado'
    | 'soportado_contabilizado'
    | 'avisos'
    | 'faltan'
  > {
  lineas: LineaLiquidacion[]
  total_debe: Decimal
  total_haber: Decimal
  repercutido_declarado: Decimal
  repercutido_contabilizado: Decimal
  soportado_declarado: Decimal
  soportado_contabilizado: Decimal
  /** Diferencias con el libro. No impiden grabar. */
  avisos: string[]
  /** Lo que impide grabar. Con algo aquí, `grabable` es false. */
  faltan: string[]
}

export interface DocumentoDeclarado extends Omit<DocumentoApi, 'base' | 'cuota' | 'recargo'> {
  base: Decimal
  cuota: Decimal
  recargo: Decimal
}

export interface PaginaDeDocumentos {
  total: number
  documentos: DocumentoDeclarado[]
}

function ficha(salida: FichaApi): FichaDeclaracion {
  return {
    ...salida,
    resultado: aDecimal(salida.resultado),
    cuotas_a_compensar:
      salida.cuotas_a_compensar === null || salida.cuotas_a_compensar === undefined
        ? null
        : aDecimal(salida.cuotas_a_compensar),
    casillas: (salida.casillas ?? []).map((casilla) => ({
      ...casilla,
      importe: aDecimal(casilla.importe),
      importe_calculado: aDecimal(casilla.importe_calculado),
    })),
    avisos: (salida.avisos ?? []).map((aviso) => ({ ...aviso, importe: aDecimal(aviso.importe) })),
    historial: salida.historial ?? [],
  }
}

async function pedirFicha(ruta: string, cuerpo: object, senal?: AbortSignal) {
  return ficha(await pedir<FichaApi>(`/contabilidad/declaraciones/${ruta}`, cuerpo, senal))
}

export function obtenerDeclaracion(id_declaracion: number, senal?: AbortSignal) {
  return pedirFicha('obtener', { id_declaracion }, senal)
}

/** Guarda los datos de partida y recalcula con las facturas de hoy, sin perder los ajustes. */
export function modificarDeclaracion(id_declaracion: number, cambios: CambiosDePartida) {
  return pedirFicha('modificar', { id_declaracion, ...cambios })
}

/** `importe` como cadena con punto decimal. El motivo es obligatorio. */
export function ajustarCasilla(id_declaracion: number, casilla: string, importe: string, motivo: string) {
  return pedirFicha('ajustar_casilla', { id_declaracion, casilla, importe, motivo })
}

export function quitarAjuste(id_declaracion: number, casilla: string) {
  return pedirFicha('quitar_ajuste', { id_declaracion, casilla })
}

/** Para pasar a presentada hacen falta la fecha (`aaaa-mm-dd`) y el justificante. */
export function cambiarEstado(
  id_declaracion: number,
  estado: number,
  presentacion?: { fecha_presentacion: string; justificante: string },
) {
  return pedirFicha('cambiar_estado', { id_declaracion, estado, ...presentacion })
}

/** Tira el asiento de la liquidación mientras siga en borradores. */
export function descontabilizar(id_declaracion: number) {
  return pedirFicha('descontabilizar', { id_declaracion })
}

/**
 * El asiento de la liquidación. Con `ensayo` no se graba nada y vale también
 * con la declaración en borrador: es la vista previa. Fecha y diario vacíos
 * dejan que los ponga la API (el último día del periodo y el de siempre).
 */
export async function contabilizar(
  id_declaracion: number,
  opciones: { ensayo: boolean; fecha?: string; diario?: string },
): Promise<Liquidacion> {
  const salida = await pedir<ContabilizarApi>('/contabilidad/declaraciones/contabilizar', {
    id_declaracion,
    ensayo: opciones.ensayo,
    ...(opciones.fecha ? { fecha: opciones.fecha } : {}),
    ...(opciones.diario ? { diario: opciones.diario } : {}),
  })
  return {
    ...salida,
    lineas: (salida.lineas ?? []).map((linea) => ({
      ...linea,
      debe: aDecimal(linea.debe),
      haber: aDecimal(linea.haber),
    })),
    total_debe: aDecimal(salida.total_debe),
    total_haber: aDecimal(salida.total_haber),
    repercutido_declarado: aDecimal(salida.repercutido_declarado),
    repercutido_contabilizado: aDecimal(salida.repercutido_contabilizado),
    soportado_declarado: aDecimal(salida.soportado_declarado),
    soportado_contabilizado: aDecimal(salida.soportado_contabilizado),
    avisos: salida.avisos ?? [],
    faltan: salida.faltan ?? [],
  }
}

/** Las facturas que suman en una casilla: la respuesta a un requerimiento. */
export async function documentosDeCasilla(
  id_declaracion: number,
  casilla: string,
  limite: number,
  desplazamiento: number,
  senal?: AbortSignal,
): Promise<PaginaDeDocumentos> {
  const salida = await pedir<components['schemas']['RespuestaDocumentos']>(
    '/contabilidad/declaraciones/documentos',
    { id_declaracion, casilla, limite, desplazamiento },
    senal,
  )
  return {
    total: salida.total,
    documentos: (salida.documentos ?? []).map((documento) => ({
      ...documento,
      base: aDecimal(documento.base),
      cuota: aDecimal(documento.cuota),
      recargo: aDecimal(documento.recargo),
    })),
  }
}

/**
 * El fichero para importar en la sede de la AEAT. Lo que no se manda lo toma
 * la API de lo guardado en la declaración. Con facturas sin colocar responde
 * 400 salvo que se acepten los avisos.
 */
export function ficheroAeat(id_declaracion: number, aceptar_avisos: boolean): Promise<Descarga> {
  return descargar('/contabilidad/declaraciones/fichero', { id_declaracion, aceptar_avisos })
}
