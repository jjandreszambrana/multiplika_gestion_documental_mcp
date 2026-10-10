import { pedir } from './cliente'
import type { components } from './types'

export type AyudaEnLista = components['schemas']['AyudaEnLista']
export type Ayuda = components['schemas']['RespuestaAyuda']

/**
 * Las ayudas del módulo, que escribe y sirve el backend: son reglas del
 * programa y tienen que poder corregirse el mismo día, sin desplegar esto.
 *
 * Se pinta desde el listado y no con una clave escrita aquí, para que una
 * ayuda nueva aparezca sola.
 */
export function listarAyudas(): Promise<components['schemas']['RespuestaAyudas']> {
  return pedir<components['schemas']['RespuestaAyudas']>('/contabilidad/ayuda/listar')
}

/** El texto en Markdown de una ayuda. Una clave que no existe da 404. */
export function obtenerAyuda(clave: string): Promise<Ayuda> {
  return pedir<Ayuda>('/contabilidad/ayuda/obtener', { clave })
}
