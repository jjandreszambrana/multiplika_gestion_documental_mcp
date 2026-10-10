import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import type { Apunte } from '../../api/asientos'
import { sustituirAsiento } from './reemplazo'

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

// Asiento 10, luego el borrador 7 con dos líneas, y luego el asiento 11.
const APUNTES = [apunte('1', 10), apunte('2', 0, 7), apunte('3', 0, 7), apunte('4', 11)]

describe('sustituirAsiento', () => {
  it('pone las líneas nuevas donde estaban las viejas', () => {
    const nuevas = [apunte('9', 12), apunte('10', 12), apunte('11', 12)]
    const salida = sustituirAsiento(APUNTES, 'b7', nuevas)
    expect(salida?.map((a) => a.clave)).toEqual(['1', '9', '10', '11', '4'])
  })

  it('quita el asiento cuando ya no devuelve líneas', () => {
    expect(sustituirAsiento(APUNTES, 'b7', [])?.map((a) => a.clave)).toEqual(['1', '4'])
  })

  it('null cuando el asiento no estaba a la vista', () => {
    expect(sustituirAsiento(APUNTES, 'b99', [apunte('9', 12)])).toBeNull()
  })

  it('vale también para un asiento confirmado', () => {
    const salida = sustituirAsiento(APUNTES, 'a2026.10', [apunte('20', 10)])
    expect(salida?.map((a) => a.clave)).toEqual(['20', '2', '3', '4'])
  })
})
