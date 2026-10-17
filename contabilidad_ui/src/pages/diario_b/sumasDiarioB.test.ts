import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { EquivalenciaCuenta, LineaDiarioB } from '../../api/diarioB'
import { sumarDiarioB } from './sumasDiarioB'

function linea(cuenta: string, debe: string, haber: string): LineaDiarioB {
  return {
    pase: 1,
    ejercicio: 2026,
    asiento: 1,
    fecha: '2026-03-01',
    cuenta,
    debe: new Decimal(debe),
    haber: new Decimal(haber),
    concepto: null,
    documento: null,
    diario: null,
    contabilizado: 1,
  }
}

const EQUIVALENCIA: EquivalenciaCuenta = {
  id: 1,
  cuenta_origen: '430000001',
  titulo_origen: 'Cliente viejo',
  cuenta_destino: '430000099',
  titulo_destino: 'Cliente nuevo',
  observaciones: null,
}

const PLAN: Record<string, string> = { '570000000': 'Caja' }
const titulo = (c: string) => PLAN[c]

describe('sumarDiarioB', () => {
  it('suma por cuenta, ordena y saca los saldos', () => {
    const r = sumarDiarioB(
      [
        linea('570000000', '0', '100.10'),
        linea('430000001', '121.05', '0'),
        linea('430000001', '0.15', '21.10'),
      ],
      null,
      titulo,
    )
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['430000001', '570000000'])
    expect(r.cuentas[0].debe.toFixed(2)).toBe('121.20')
    expect(r.cuentas[0].haber.toFixed(2)).toBe('21.10')
    expect(r.cuentas[0].deudor.toFixed(2)).toBe('100.10')
    expect(r.cuentas[0].acreedor.toFixed(2)).toBe('0.00')
    expect(r.cuentas[1].titulo).toBe('Caja')
    expect(r.cuentas[1].acreedor.toFixed(2)).toBe('100.10')
    expect(r.total.debe.toFixed(2)).toBe('121.20')
    expect(r.total.haber.toFixed(2)).toBe('121.20')
    expect(r.total.deudor.toFixed(2)).toBe('100.10')
    expect(r.total.acreedor.toFixed(2)).toBe('100.10')
  })

  it('con equivalencias, la cuenta de origen se suma en la de destino', () => {
    const r = sumarDiarioB(
      [linea('430000001', '50', '0'), linea('430000099', '25.50', '0'), linea('4300000011', '1', '0')],
      [EQUIVALENCIA],
      titulo,
    )
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['4300000011', '430000099'])
    expect(r.cuentas[1].debe.toFixed(2)).toBe('75.50')
    expect(r.cuentas[1].titulo).toBe('Cliente nuevo')
    expect(r.cuentas[0].titulo).toBe('')
  })

  it('sin equivalencias, la cuenta de origen queda como está', () => {
    const r = sumarDiarioB([linea('430000001', '50', '0')], null, titulo)
    expect(r.cuentas[0].cuenta).toBe('430000001')
  })

  it('no saca cuentas sin debe ni haber, pero sí las de saldo cero', () => {
    const r = sumarDiarioB(
      [linea('600000000', '0', '0'), linea('572000000', '10', '10')],
      null,
      titulo,
    )
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['572000000'])
    expect(r.cuentas[0].deudor.toFixed(2)).toBe('0.00')
    expect(r.cuentas[0].acreedor.toFixed(2)).toBe('0.00')
  })
})
