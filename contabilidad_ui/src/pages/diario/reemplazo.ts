import type { Apunte } from '../../api/asientos'
import { asientoDe } from './seleccion'

/**
 * Cambia las líneas de un asiento por las que acaban de llegar, en el mismo
 * sitio donde estaban.
 *
 * Volver del editor recargaba el diario entero, que en un ejercicio con miles
 * de apuntes es una espera larga para ver un asiento que ya se sabe cuál es.
 * Se sustituye en su sitio para no reordenar nada: el orden lo da la API y
 * aquí no se recalcula.
 *
 * Devuelve `null` cuando el asiento no estaba en la lista —es nuevo, o el
 * filtro no lo alcanza—: entonces no hay nada que sustituir y toca recargar.
 */
export function sustituirAsiento(
  apuntes: Apunte[],
  grupo: string,
  nuevas: Apunte[],
): Apunte[] | null {
  const primera = apuntes.findIndex((a) => asientoDe(a) === grupo)
  if (primera === -1) return null

  return [...apuntes.slice(0, primera), ...nuevas, ...apuntes.slice(primera).filter((a) => asientoDe(a) !== grupo)]
}
