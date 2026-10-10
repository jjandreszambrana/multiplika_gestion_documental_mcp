import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import type { components } from './types'

type BorradorApi = components['schemas']['Borrador']
export type LineaBorradorApi = components['schemas']['LineaBorrador']
export type Confirmacion = components['schemas']['RespuestaConfirmarBorrador']

/**
 * Un asiento a medias, con los totales que ya calcula el servidor pasados a
 * `Decimal`. Mientras es borrador no está en el libro: se cambia entero o se
 * tira sin dejar rastro, y solo al confirmarlo coge número de asiento.
 */
export interface Borrador extends Omit<BorradorApi, 'total_debe' | 'total_haber' | 'diferencia'> {
  total_debe: Decimal
  total_haber: Decimal
  diferencia: Decimal
}

/** Una línea tal y como se manda: los importes van como cadena. */
export interface LineaParaEnviar {
  cuenta: string
  debe: string | null
  haber: string | null
  concepto: string
  documento: string
  id_obra: number
}

export interface DatosBorrador {
  ejercicio: number
  fecha: string
  diario: string
  concepto: string
  lineas: LineaParaEnviar[]
}

function normalizar(borrador: BorradorApi): Borrador {
  return {
    ...borrador,
    total_debe: aDecimal(borrador.total_debe),
    total_haber: aDecimal(borrador.total_haber),
    diferencia: aDecimal(borrador.diferencia),
  }
}

/** Empieza uno. Puede nacer vacío: guardar no valida nada de fondo. */
export async function crearBorrador(datos: DatosBorrador): Promise<Borrador> {
  return normalizar(
    await pedir<BorradorApi>('/contabilidad/asientos/borrador/crear', {
      ejercicio: datos.ejercicio,
      fecha: datos.fecha,
      diario: datos.diario,
      concepto: datos.concepto,
      lineas: datos.lineas,
    }),
  )
}

/** Reemplaza el asiento entero: las líneas que se mandan sustituyen a todas. */
export async function editarBorrador(id: number, datos: DatosBorrador): Promise<Borrador> {
  return normalizar(
    await pedir<BorradorApi>('/contabilidad/asientos/borrador/editar', {
      id,
      ejercicio: datos.ejercicio,
      fecha: datos.fecha,
      diario: datos.diario,
      concepto: datos.concepto,
      lineas: datos.lineas,
    }),
  )
}

export async function obtenerBorrador(id: number): Promise<Borrador> {
  return normalizar(await pedir<BorradorApi>('/contabilidad/asientos/borrador/obtener', { id }))
}

export interface FiltroBorradores {
  ejercicio: number | null
  soloCuadrados: boolean
  soloMios: boolean
  offset: number
  limit: number
}

export async function listarBorradores(
  filtro: FiltroBorradores,
): Promise<{ total: number; borradores: Borrador[] }> {
  const respuesta = await pedir<components['schemas']['RespuestaListarBorradores']>(
    '/contabilidad/asientos/borrador/listar',
    {
      ...(filtro.ejercicio === null ? {} : { ejercicio: filtro.ejercicio }),
      solo_cuadrados: filtro.soloCuadrados,
      solo_mios: filtro.soloMios,
      offset: filtro.offset,
      limit: filtro.limit,
    },
  )
  return { total: respuesta.total, borradores: (respuesta.borradores ?? []).map(normalizar) }
}

/** Lo tira. No es `/asientos/eliminar`, que borra uno que ya está en el libro. */
export async function eliminarBorrador(id: number): Promise<void> {
  await pedir('/contabilidad/asientos/borrador/eliminar', { id })
}

/**
 * Lo pasa al libro y devuelve el número de asiento. Confirmar **es** crear el
 * asiento: aquí es donde el servidor lo comprueba todo, y un 400 deja el
 * borrador intacto para arreglarlo y volver a intentarlo.
 */
export function confirmarBorrador(id: number): Promise<Confirmacion> {
  return pedir<Confirmacion>('/contabilidad/asientos/confirmar', { id })
}

export interface Traspaso {
  /** Borrador del que salen las líneas. */
  id: number
  /** Las líneas que se mueven, por su `pase`. */
  pases: number[]
  /** Nulo para crear un borrador nuevo con esas líneas. */
  idDestino: number | null
  /** Solo para el destino nuevo. Lo que va vacío se hereda del origen. */
  fecha: string
  diario: string
  concepto: string
}

export interface ResultadoTraspaso {
  idDestino: number
  traspasadas: number
  origen: Borrador
  destino: Borrador
}

/**
 * Mueve líneas de un borrador a otro, o a uno nuevo para partir un asiento en
 * dos. Todo o nada: lo hace el servidor en una sola operación.
 *
 * **El cuadre lo decide la API**, que devuelve un 400 con el texto para el
 * contable si lo que se traspasa no cuadra. Aquí no se suma nada para dejar o
 * no dejar traspasar. Los dos borradores vuelven enteros, así que la pantalla
 * los refresca sin otra llamada.
 */
export async function traspasarLineas(traspaso: Traspaso): Promise<ResultadoTraspaso> {
  const respuesta = await pedir<components['schemas']['RespuestaTraspasarBorrador']>(
    '/contabilidad/asientos/borrador/traspasar',
    {
      id: traspaso.id,
      pases: traspaso.pases,
      ...(traspaso.idDestino === null ? {} : { id_destino: traspaso.idDestino }),
      ...(traspaso.fecha === '' ? {} : { fecha: traspaso.fecha }),
      ...(traspaso.diario === '' ? {} : { diario: traspaso.diario }),
      ...(traspaso.concepto === '' ? {} : { concepto: traspaso.concepto }),
    },
  )

  return {
    idDestino: respuesta.id_destino,
    traspasadas: respuesta.traspasadas,
    origen: normalizar(respuesta.origen),
    destino: normalizar(respuesta.destino),
  }
}
