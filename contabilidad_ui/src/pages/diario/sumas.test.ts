import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { Apunte } from '../../api/asientos'
import { sumarSeleccion } from './sumas'

/** Un apunte con lo justo para sumar: el resto de campos no intervienen. */
function apunte(debe: string, haber: string): Apunte {
  return { debe: new Decimal(debe), haber: new Decimal(haber) } as Apunte
}

describe('sumarSeleccion', () => {
  it('suma cero cuando no hay apuntes', () => {
    const suma = sumarSeleccion([])
    expect(suma.debe.toFixed(2)).toBe('0.00')
    expect(suma.haber.toFixed(2)).toBe('0.00')
    expect(suma.diferencia.toFixed(2)).toBe('0.00')
    expect(suma.apuntes).toBe(0)
  })

  it('un asiento de varias líneas cuadra exacto', () => {
    const suma = sumarSeleccion([
      apunte('100.00', '0'),
      apunte('21.00', '0'),
      apunte('0', '121.00'),
    ])
    expect(suma.debe.toFixed(2)).toBe('121.00')
    expect(suma.haber.toFixed(2)).toBe('121.00')
    expect(suma.diferencia.toFixed(2)).toBe('0.00')
    expect(suma.apuntes).toBe(3)
  })

  it('los céntimos no se pierden al sumar muchas líneas', () => {
    const suma = sumarSeleccion([apunte('0.10', '0'), apunte('0.20', '0'), apunte('0', '0.30')])
    expect(suma.debe.toFixed(2)).toBe('0.30')
    expect(suma.diferencia.toFixed(2)).toBe('0.00')
  })

  it('el descuadre sale con signo: debe menos haber', () => {
    const suma = sumarSeleccion([apunte('121.23', '0'), apunte('0', '100.00')])
    expect(suma.diferencia.toFixed(2)).toBe('21.23')
  })

  it('un descuadre negativo se queda negativo', () => {
    const suma = sumarSeleccion([apunte('100.00', '0'), apunte('0', '121.23')])
    expect(suma.diferencia.toFixed(2)).toBe('-21.23')
  })

  it('no redondea en el paso intermedio: el .005 sigue ahí', () => {
    const suma = sumarSeleccion([apunte('1234.565', '0')])
    expect(suma.debe.toFixed(3)).toBe('1234.565')
  })
})
