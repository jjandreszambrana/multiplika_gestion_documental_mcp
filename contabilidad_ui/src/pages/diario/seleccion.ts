import type { MRT_RowSelectionState } from 'mantine-react-table'
import type { Apunte } from '../../api/asientos'

/**
 * A qué asiento pertenece una línea. Un borrador todavía no tiene número de
 * asiento, así que se agrupa por el borrador del que sale.
 */
export function asientoDe(apunte: Apunte): string {
  return apunte.es_borrador ? `b${apunte.id_borrador}` : `a${apunte.ejercicio}.${apunte.asiento}`
}

/**
 * Marcar una línea marca el asiento entero, y desmarcarla lo desmarca entero.
 *
 * Un asiento es una unidad: media docena de líneas que solo significan algo
 * juntas, y sumar tres de las seis da una cifra que no corresponde con nada.
 * Se mira qué líneas ha cambiado la rejilla y ese mismo cambio se aplica a las
 * demás del asiento; así funciona igual marcando una fila que marcándolas todas.
 */
export function seleccionPorAsiento(
  apuntes: Apunte[],
  anterior: MRT_RowSelectionState,
  propuesta: MRT_RowSelectionState,
): MRT_RowSelectionState {
  const cambiados = new Map<string, boolean>()
  for (const apunte of apuntes) {
    const antes = anterior[apunte.clave] === true
    const ahora = propuesta[apunte.clave] === true
    if (antes !== ahora) cambiados.set(asientoDe(apunte), ahora)
  }

  if (cambiados.size === 0) return propuesta

  const resultado: MRT_RowSelectionState = { ...propuesta }
  for (const apunte of apuntes) {
    const cambio = cambiados.get(asientoDe(apunte))
    if (cambio === undefined) continue
    if (cambio) resultado[apunte.clave] = true
    else delete resultado[apunte.clave]
  }
  return resultado
}
