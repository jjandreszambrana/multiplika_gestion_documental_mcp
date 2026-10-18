import { pedir } from './cliente'
import type { components } from './types'

export type CuentaPlan = components['schemas']['CuentaPlan']
export type RespuestaListarPlan = components['schemas']['RespuestaListarPlan']

/** Tope por llamada que impone la API. */
export const MAXIMO_POR_PAGINA = 2000

export interface FiltroPlan {
  ejercicio: number | null
  /** Busca a la vez por código (que empiece por) y por título (que lo contenga). */
  texto: string
  soloAuxiliares: boolean
  /** Trae también las ocultas y las retiradas, que por defecto no salen. */
  incluirApartadas: boolean
  offset: number
  limit: number
}

/** Apartada es tanto la oculta como la retirada: ninguna de las dos se usa ya. */
export function estaApartada(cuenta: CuentaPlan): boolean {
  return cuenta.oculta === 1 || cuenta.estado === 0
}

export function listarPlan(filtro: FiltroPlan): Promise<RespuestaListarPlan> {
  return pedir<RespuestaListarPlan>('/contabilidad/plan/listar', {
    ...(filtro.ejercicio === null ? {} : { ejercicio: filtro.ejercicio }),
    texto: filtro.texto,
    solo_auxiliares: filtro.soloAuxiliares,
    incluir_apartadas: filtro.incluirApartadas,
    offset: filtro.offset,
    limit: filtro.limit,
  })
}

export interface NuevaSubcuenta {
  ejercicio: number | null
  raiz: string
  descripcion: string
  /** Opcional: si se omite, el servidor coge el primer correlativo libre. */
  codigo?: string
}

export function crearSubcuenta(datos: NuevaSubcuenta): Promise<CuentaPlan> {
  return pedir<CuentaPlan>('/contabilidad/plan/crear_subcuenta', {
    ...(datos.ejercicio === null ? {} : { ejercicio: datos.ejercicio }),
    raiz: datos.raiz,
    descripcion: datos.descripcion,
    ...(datos.codigo ? { codigo: datos.codigo } : {}),
  })
}

export type CuentaPlanDetalle = components['schemas']['CuentaPlanDetalle']

export interface NuevaCuenta {
  ejercicio: number | null
  codigo: string
  descripcion: string
  /** true = cuenta de apuntes; false = de estructura, que solo agrega. */
  auxiliar: boolean
}

/** Detalle con `apuntes` e `hijas`, que es lo que explica por qué no se puede borrar. */
export function obtenerCuenta(
  codigo: string,
  ejercicio: number | null,
): Promise<CuentaPlanDetalle> {
  return pedir<CuentaPlanDetalle>('/contabilidad/plan/obtener', {
    ...(ejercicio === null ? {} : { ejercicio }),
    codigo,
  })
}

export function crearCuenta(datos: NuevaCuenta): Promise<CuentaPlan> {
  return pedir<CuentaPlan>('/contabilidad/plan/crear', {
    ...(datos.ejercicio === null ? {} : { ejercicio: datos.ejercicio }),
    codigo: datos.codigo,
    descripcion: datos.descripcion,
    auxiliar: datos.auxiliar,
  })
}

export interface CambioCuenta {
  ejercicio: number | null
  codigo: string
  /** Lo que no se manda se deja como está. */
  descripcion?: string
  auxiliar?: boolean
}

/**
 * Sobre una cuenta del PGC no se escribe: la API crea la versión propia de la
 * empresa con el mismo código, y la respuesta vuelve con `origen: "propia"`.
 */
export function editarCuenta(cambio: CambioCuenta): Promise<CuentaPlan> {
  return pedir<CuentaPlan>('/contabilidad/plan/editar', {
    ...(cambio.ejercicio === null ? {} : { ejercicio: cambio.ejercicio }),
    codigo: cambio.codigo,
    ...(cambio.descripcion === undefined ? {} : { descripcion: cambio.descripcion }),
    ...(cambio.auxiliar === undefined ? {} : { auxiliar: cambio.auxiliar }),
  })
}

export type RespuestaVisibilidad = components['schemas']['RespuestaVisibilidad']
export type RespuestaEstadoCuenta = components['schemas']['RespuestaEstadoCuenta']
export type RespuestaBorrada = components['schemas']['RespuestaBorrada']

/** Esconde una cuenta del PGC en esta empresa. Las propias no se ocultan: se retiran. */
export function fijarVisibilidad(
  codigo: string,
  oculta: boolean,
  ejercicio: number | null,
): Promise<RespuestaVisibilidad> {
  return pedir<RespuestaVisibilidad>('/contabilidad/plan/visibilidad', {
    ...(ejercicio === null ? {} : { ejercicio }),
    codigo,
    oculta,
  })
}

/** Retira o reactiva una cuenta propia, conservando su mayor y su histórico. */
export function fijarEstado(
  codigo: string,
  activa: boolean,
  ejercicio: number | null,
): Promise<RespuestaEstadoCuenta> {
  return pedir<RespuestaEstadoCuenta>('/contabilidad/plan/estado', {
    ...(ejercicio === null ? {} : { ejercicio }),
    codigo,
    activa,
  })
}

/** Solo para deshacer un alta equivocada: propia, sin apuntes y sin subcuentas. */
export function eliminarCuenta(
  codigo: string,
  ejercicio: number | null,
): Promise<RespuestaBorrada> {
  return pedir<RespuestaBorrada>('/contabilidad/plan/eliminar', {
    ...(ejercicio === null ? {} : { ejercicio }),
    codigo,
  })
}

export type RevisionDeAuxiliares = components['schemas']['RespuestaRevisarAuxiliares']

/**
 * Cuentas marcadas para recibir apuntes que no tienen el ancho de la empresa,
 * y apuntes hechos contra cuentas que tampoco lo tienen. Nivel `consulta`.
 *
 * Es una comprobación de rastro: la puerta por la que entraban esas cuentas se
 * cerró en el backend el 29/08/2026, así que lo normal es que salga limpio y no
 * se enseñe nada.
 */
export function revisarAuxiliares(): Promise<RevisionDeAuxiliares> {
  return pedir<RevisionDeAuxiliares>('/contabilidad/plan/revisar_auxiliares')
}

/**
 * El plan entero del ejercicio, apartadas incluidas, en tandas de
 * `MAXIMO_POR_PAGINA`. Para buscar el título de cuentas que no salen en el plan
 * en memoria (que deja fuera las ocultas y las retiradas).
 */
export async function planEntero(ejercicio: number | null): Promise<CuentaPlan[]> {
  const todas: CuentaPlan[] = []
  // Tope de vueltas, para que un `total` raro no deje el navegador dando vueltas.
  for (let vuelta = 0; vuelta < 50; vuelta += 1) {
    const respuesta = await listarPlan({
      ejercicio,
      texto: '',
      soloAuxiliares: false,
      incluirApartadas: true,
      offset: todas.length,
      limit: MAXIMO_POR_PAGINA,
    })
    const cuentas = respuesta.cuentas ?? []
    todas.push(...cuentas)
    if (cuentas.length === 0 || todas.length >= respuesta.total) break
  }
  return todas
}
