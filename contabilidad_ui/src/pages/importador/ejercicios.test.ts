import { describe, expect, it } from 'vitest'
import type { AsientoImportado } from '../../api/importador'
import { avisoDeEjercicio } from './ejercicios'

function asiento(ejercicio: number): AsientoImportado {
  return {
    asiento_origen: '1',
    ejercicio,
    asiento: 1,
    id_borrador: 0,
    lineas: 2,
    destino: 'diario',
  }
}

describe('avisoDeEjercicio', () => {
  it('no avisa cuando el archivo es del ejercicio que se está mirando', () => {
    expect(avisoDeEjercicio([asiento(2026), asiento(2026)], 2026)).toBeNull()
  })

  it('avisa cuando el archivo es de otro año', () => {
    expect(avisoDeEjercicio([asiento(2025)], 2026)).toBe(
      'El archivo trae asientos de 2025 y en la cabecera tienes el ejercicio 2026. Cada asiento entra en el que le corresponde por su fecha, así que estos irán a 2025.',
    )
  })

  it('avisa cuando el archivo trae varios años, aunque uno sea el elegido', () => {
    expect(avisoDeEjercicio([asiento(2025), asiento(2026), asiento(2024)], 2026)).toBe(
      'El archivo trae asientos de varios ejercicios: 2024, 2025 y 2026. Cada uno entra en el que le corresponde por su fecha.',
    )
  })

  it('no avisa sin ejercicio elegido y con un solo año en el archivo', () => {
    expect(avisoDeEjercicio([asiento(2025)], null)).toBeNull()
  })

  it('no avisa con un informe sin asientos', () => {
    expect(avisoDeEjercicio([], 2026)).toBeNull()
  })
})
