import { pedir } from './cliente'
import type { components } from './types'

export type Configuracion = components['schemas']['RespuestaConfiguracion']

/**
 * Todo lo que condiciona la interfaz: ancho de cuenta, plan vigente, diarios,
 * cuentas por defecto y qué falta por configurar.
 *
 * Se pide una vez al entrar y al conmutar de empresa, no en cada pantalla.
 */
export function obtenerConfiguracion(): Promise<Configuracion> {
  return pedir<Configuracion>('/contabilidad/configuracion/obtener')
}

export type CampoDeCuenta =
  components['schemas']['CampoDeCuentaConfiguracion']

/** Cuentas por defecto: nombre de la columna, título, grupo y qué se rompe sin ella. */
export type CuentasPorDefecto = components['schemas']['CuentasPorDefectoConfig']

/**
 * Los rótulos de las cuentas por defecto, que los escribe el backend junto a
 * cada columna: aquí no hay diccionario que mantener y una cuenta nueva sale
 * bien escrita sola. No cambia por empresa, así que se pide una vez.
 *
 * Vienen en el orden en que conviene enseñarlas, agrupadas por `grupo`.
 */
export async function listarCamposDeCuentas(): Promise<CampoDeCuenta[]> {
  const { campos = [] } = await pedir<components['schemas']['RespuestaCamposCuentas']>(
    '/contabilidad/configuracion/campos',
  )
  return campos
}

/** Los tres modos de numerar la subcuenta de un cliente o de un proveedor. */
export type ModoCuenta = 'correlativo' | 'codigo' | 'manual'

export interface Ajustes {
  diario_defecto: string
  modo_cuenta_cliente: ModoCuenta
  modo_cuenta_proveedor: ModoCuenta
}

/** Lo que admite `/fijar_cuentas`: los ajustes y las quince cuentas. */
export type CambiosConfiguracion = Partial<Ajustes> &
  Partial<Record<keyof CuentasPorDefecto, string>>

/**
 * Guarda solo lo que cambia; lo que no se manda se queda como está. Nivel
 * `cierre`. Devuelve la configuración entera ya actualizada, así que no hay que
 * volver a pedirla.
 *
 * Cada cuenta se comprueba contra el plan de la empresa al guardarla: si no
 * existe, lo dice ahora y no tres semanas después al contabilizar.
 */
export function fijarAjustes(cambios: CambiosConfiguracion): Promise<Configuracion> {
  return pedir<Configuracion>('/contabilidad/configuracion/fijar_cuentas', cambios)
}
