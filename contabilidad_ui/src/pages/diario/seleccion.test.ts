import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import type { Apunte } from '../../api/asientos'
import { asientoDe, seleccionPorAsiento } from './seleccion'

function apunte(clave: string, asiento: number, borrador = 0): Apunte {
  return {
    clave,
    id_obligado: 1,
    pase: Number(clave),
    ejercicio: 2026,
    asiento,
    cuenta: '430000001',
    debe: new Decimal('0'),
    haber: new Decimal('0'),
    contabilizado: borrador ? 0 : 1,
    es_borrador: borrador > 0,
    id_borrador: borrador,
  } as unknown as Apunte
}

// Asiento 10: líneas 1 y 2. Asiento 11: líneas 3, 4 y 5. Borrador 7: línea 6.
const APUNTES = [
  apunte('1', 10),
  apunte('2', 10),
  apunte('3', 11),
  apunte('4', 11),
  apunte('5', 11),
  apunte('6', 0, 7),
]

describe('asientoDe', () => {
  it('agrupa los confirmados por ejercicio y asiento', () => {
    expect(asientoDe(APUNTES[0]!)).toBe('a2026.10')
    expect(asientoDe(APUNTES[0]!)).toBe(asientoDe(APUNTES[1]!))
    expect(asientoDe(APUNTES[0]!)).not.toBe(asientoDe(APUNTES[2]!))
  })

  it('agrupa los borradores por el borrador, que aún no tienen número', () => {
    expect(asientoDe(APUNTES[5]!)).toBe('b7')
  })
})

describe('seleccionPorAsiento', () => {
  it('marcar una línea marca el asiento entero', () => {
    expect(seleccionPorAsiento(APUNTES, {}, { '3': true })).toEqual({
      '3': true,
      '4': true,
      '5': true,
    })
  })

  it('desmarcar una línea desmarca el asiento entero', () => {
    const antes = { '3': true, '4': true, '5': true }
    expect(seleccionPorAsiento(APUNTES, antes, { '4': true, '5': true })).toEqual({})
  })

  it('no toca los asientos que no han cambiado', () => {
    const antes = { '1': true, '2': true }
    expect(seleccionPorAsiento(APUNTES, antes, { '1': true, '2': true, '3': true })).toEqual({
      '1': true,
      '2': true,
      '3': true,
      '4': true,
      '5': true,
    })
  })

  it('marcarlo todo de una vez sigue valiendo', () => {
    const todo = Object.fromEntries(APUNTES.map((a) => [a.clave, true]))
    expect(seleccionPorAsiento(APUNTES, {}, todo)).toEqual(todo)
  })

  it('sin cambios, se queda como está', () => {
    const antes = { '1': true, '2': true }
    expect(seleccionPorAsiento(APUNTES, antes, antes)).toEqual(antes)
  })
})
