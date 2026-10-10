import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { TramoIva } from '../../api/fiscal'
import { sumarTramos } from './sumasIva'

function tramo(tipo: number, base: string, cuota: string, recargo = '0'): TramoIva {
  return {
    tipo,
    base: new Decimal(base),
    cuota: new Decimal(cuota),
    recargo: new Decimal(recargo),
  }
}

describe('sumarTramos', () => {
  it('sin tipos, todo a cero', () => {
    const suma = sumarTramos([])
    expect(suma.base.toFixed(2)).toBe('0.00')
    expect(suma.cuota.toFixed(2)).toBe('0.00')
    expect(suma.recargo.toFixed(2)).toBe('0.00')
  })

  it('suma las tres columnas de varios tipos', () => {
    const suma = sumarTramos([
      tramo(21, '42180.00', '8857.80'),
      tramo(10, '3600.00', '360.00'),
      tramo(4, '1250.50', '50.02', '31.26'),
    ])
    expect(suma.base.toFixed(2)).toBe('47030.50')
    expect(suma.cuota.toFixed(2)).toBe('9267.82')
    expect(suma.recargo.toFixed(2)).toBe('31.26')
  })

  it('con céntimos que en coma flotante se irían: 0.1 + 0.2 son 0.3 exactos', () => {
    const suma = sumarTramos([tramo(21, '0.1', '0'), tramo(10, '0.2', '0')])
    expect(suma.base.toFixed(2)).toBe('0.30')
    expect(suma.base.equals(new Decimal('0.3'))).toBe(true)
  })

  it('admite importes negativos, que los hay con rectificativas', () => {
    const suma = sumarTramos([tramo(21, '1000.00', '210.00'), tramo(21, '-400.00', '-84.00')])
    expect(suma.base.toFixed(2)).toBe('600.00')
    expect(suma.cuota.toFixed(2)).toBe('126.00')
  })
})
