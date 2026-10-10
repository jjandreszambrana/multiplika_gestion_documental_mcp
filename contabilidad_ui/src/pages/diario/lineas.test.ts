import { describe, expect, it } from 'vitest'
import { lineaVacia, loQueFalta, paraEnviar, totalesDe, type LineaEnEdicion } from './lineas'

function linea(debe: string, haber: string, cuenta = '430000001'): LineaEnEdicion {
  return { ...lineaVacia(), cuenta, debe, haber }
}

describe('totalesDe', () => {
  it('suma las dos columnas y da la diferencia', () => {
    const totales = totalesDe([linea('121.23', ''), linea('', '100.00'), linea('', '21.23')])
    expect(totales.debe.toFixed(2)).toBe('121.23')
    expect(totales.haber.toFixed(2)).toBe('121.23')
    expect(totales.diferencia.toFixed(2)).toBe('0.00')
    expect(totales.cuadra).toBe(true)
  })

  it('un asiento de varias líneas cuadra exacto con céntimos', () => {
    const totales = totalesDe([linea('1000.00', ''), linea('', '826.45'), linea('', '173.55')])
    expect(totales.diferencia.toFixed(2)).toBe('0.00')
    expect(totales.cuadra).toBe(true)
  })

  it('avisa del descuadre y de su signo', () => {
    const totales = totalesDe([linea('100.00', ''), linea('', '99.99')])
    expect(totales.diferencia.toFixed(2)).toBe('0.01')
    expect(totales.cuadra).toBe(false)
  })

  it('admite la coma decimal que teclea el contable', () => {
    const totales = totalesDe([linea('1234,56', ''), linea('', '1234.56')])
    expect(totales.debe.toFixed(2)).toBe('1234.56')
    expect(totales.cuadra).toBe(true)
  })

  it('una casilla a medio escribir cuenta como cero, no rompe', () => {
    const totales = totalesDe([linea('12,', ''), linea('', '')])
    expect(totales.debe.toFixed(2)).toBe('12.00')
  })

  it('con todo vacío, cero y cuadra', () => {
    const totales = totalesDe([lineaVacia()])
    expect(totales.debe.toFixed(2)).toBe('0.00')
    expect(totales.cuadra).toBe(true)
  })
})

describe('paraEnviar', () => {
  it('manda los importes como cadena con punto y vacío como nulo', () => {
    expect(paraEnviar([linea('121,23', '')])).toEqual([
      {
        cuenta: '430000001',
        debe: '121.23',
        haber: null,
        concepto: '',
        documento: '',
        id_obra: 0,
      },
    ])
  })

  it('conserva el negativo tal cual para que lo rechace la API', () => {
    expect(paraEnviar([linea('-50.00', '')])[0]?.debe).toBe('-50.00')
  })
})

describe('loQueFalta', () => {
  const completa = {
    clave: 1,
    cuenta: '430000001',
    concepto: 'Venta',
    documento: 'F-1',
    debe: '121,00',
    haber: '',
  }

  it('nada que decir cuando están todas completas', () => {
    expect(loQueFalta([completa, { ...completa, clave: 2, debe: '', haber: '121,00' }])).toBeNull()
  })

  it('las líneas en blanco no cuentan', () => {
    const vacia = { clave: 9, cuenta: '', concepto: '', documento: '', debe: '', haber: '' }
    expect(loQueFalta([completa, vacia])).toBeNull()
  })

  it('avisa de la línea sin cuenta, con su número', () => {
    const sinCuenta = { ...completa, clave: 2, cuenta: '' }
    expect(loQueFalta([completa, sinCuenta])).toBe('La línea 2 está a medias: le falta la cuenta.')
  })

  it('avisa de la línea sin importe', () => {
    const sinImporte = { ...completa, clave: 2, debe: '', haber: '' }
    expect(loQueFalta([completa, sinImporte])).toBe(
      'La línea 2 está a medias: le falta el importe, al debe o al haber.',
    )
  })

  it('nombra la primera que está mal, no la última', () => {
    const sinCuenta = { ...completa, clave: 2, cuenta: '' }
    const sinImporte = { ...completa, clave: 3, debe: '', haber: '' }
    expect(loQueFalta([sinCuenta, sinImporte])).toBe(
      'La línea 1 está a medias: le falta la cuenta.',
    )
  })

  it('un concepto suelto no convierte la línea en escrita', () => {
    const soloConcepto = { clave: 5, cuenta: '', concepto: 'nota', documento: '', debe: '', haber: '' }
    expect(loQueFalta([completa, soloConcepto])).toBeNull()
  })
})
