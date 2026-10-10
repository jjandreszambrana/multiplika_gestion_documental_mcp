import { pedir } from './cliente'
import type { components } from './types'

export type DiarioContable = components['schemas']['DiarioContable']

/**
 * Los libros auxiliares donde se anota un asiento.
 *
 * `reservado` lo pone el servidor a partir de su propia lista: son los de
 * apertura, cierre y regularización, que escriben los procesos automáticos y
 * que el usuario no puede usar. **Se mira `reservado`, nunca el nombre.**
 */
export async function listarDiarios(incluirReservados: boolean): Promise<DiarioContable[]> {
  const { diarios = [] } = await pedir<components['schemas']['RespuestaListarDiarios']>(
    '/contabilidad/diarios/listar',
    { incluir_reservados: incluirReservados },
  )
  return diarios
}

/**
 * Da de alta un diario. Nivel `cierre`. El código lo llevan escrito los apuntes,
 * así que después solo se puede cambiar el nombre; los reservados se rechazan.
 */
export function crearDiario(codigo: string, descripcion: string): Promise<DiarioContable> {
  return pedir<DiarioContable>('/contabilidad/diarios/crear', { codigo, descripcion })
}
