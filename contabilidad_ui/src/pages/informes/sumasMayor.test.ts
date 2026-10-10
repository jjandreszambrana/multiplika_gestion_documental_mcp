import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { ApunteMayor } from '../../api/informes'
import { sumarSeleccion } from './sumasMayor'

function apunte(debe: string, haber: string): ApunteMayor {
  return {
    asiento: 1,
    pase: 1,
    fecha: '2026-03-01',
    concepto: '',
    documento: '',
    es_borrador: false,
    id_borrador: 0,
    debe: new Decimal(debe),
    haber: new Decimal(haber),
    saldo: new Decimal(0),
  }
}

describe('sumarSeleccion', () => {
  it('sin nada marcado, todo a cero', () => {
    const suma = sumarSeleccion([])
    expect(suma.debe.toFixed(2)).toBe('0.00')
    expect(suma.haber.toFixed(2)).toBe('0.00')
    expect(suma.apuntes).toBe(0)
  })

  it('suma varias líneas y da la diferencia', () => {
    const suma = sumarSeleccion([apunte('1210.05', '0'), apunte('0.15', '0'), apunte('0', '1000')])
    expect(suma.debe.toFixed(2)).toBe('1210.20')
    expect(suma.haber.toFixed(2)).toBe('1000.00')
    expect(suma.diferencia.toFixed(2)).toBe('210.20')
    expect(suma.apuntes).toBe(3)
  })

  it('un conjunto que cuadra da diferencia exacta de cero', () => {
    const suma = sumarSeleccion([apunte('121.23', '0'), apunte('0', '100.00'), apunte('0', '21.23')])
    expect(suma.diferencia.toFixed(2)).toBe('0.00')
  })

  it('el descuadre puede salir negativo', () => {
    const suma = sumarSeleccion([apunte('0', '500.50')])
    expect(suma.diferencia.toFixed(2)).toBe('-500.50')
  })
})
