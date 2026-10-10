import type { AsientoImportado } from '../../api/importador'

/**
 * El aviso de que lo que se va a importar no es del ejercicio que se está
 * mirando. No impide nada: cada asiento entra en el que le corresponde por su
 * fecha, y esto solo evita la sorpresa de importar 2025 creyendo que era 2026.
 *
 * No se deduce nada aquí: el ejercicio de cada asiento lo dice el ensayo.
 */

/** «2024 y 2025», que es como se lee una lista corta. */
function enumerar(anios: number[]): string {
  if (anios.length <= 1) return anios.join('')
  return `${anios.slice(0, -1).join(', ')} y ${anios[anios.length - 1]}`
}

export function avisoDeEjercicio(
  asientos: AsientoImportado[],
  ejercicioElegido: number | null,
): string | null {
  const anios = [...new Set(asientos.map((a) => a.ejercicio))].filter((a) => a > 0).sort()
  if (anios.length === 0) return null

  if (anios.length > 1) {
    return `El archivo trae asientos de varios ejercicios: ${enumerar(anios)}. Cada uno entra en el que le corresponde por su fecha.`
  }

  const unico = anios[0]!
  if (ejercicioElegido === null || unico === ejercicioElegido) return null

  return `El archivo trae asientos de ${unico} y en la cabecera tienes el ejercicio ${ejercicioElegido}. Cada asiento entra en el que le corresponde por su fecha, así que estos irán a ${unico}.`
}
