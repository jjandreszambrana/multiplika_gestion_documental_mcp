import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { aCadenaApi, aDecimal, soloImporte } from './dinero'
import { fechaParaApi, formatearEntero, formatearFecha, formatearImporte } from './format'

describe('formatearImporte', () => {
  it('pone coma decimal y punto de miles', () => {
    expect(formatearImporte(new Decimal('1234.56'))).toBe('1.234,56')
    expect(formatearImporte(new Decimal('1234567.89'))).toBe('1.234.567,89')
  })

  it('redondea al alza en el .005', () => {
    expect(formatearImporte(new Decimal('1234.565'))).toBe('1.234,57')
    expect(formatearImporte(new Decimal('0.005'))).toBe('0,01')
  })

  it('muestra el cero sin signo', () => {
    expect(formatearImporte(new Decimal('0'))).toBe('0,00')
    expect(formatearImporte(new Decimal('-0'))).toBe('0,00')
  })

  it('mantiene el signo del negativo y sus miles', () => {
    expect(formatearImporte(new Decimal('-1234.56'))).toBe('-1.234,56')
    expect(formatearImporte(new Decimal('-0.005'))).toBe('-0,01')
  })

  it('no mete separador de miles con tres cifras justas', () => {
    expect(formatearImporte(new Decimal('999.99'))).toBe('999,99')
  })
})

describe('normalización de importes de la API', () => {
  it('acepta número y cadena por igual', () => {
    expect(aDecimal(121.23).toFixed(2)).toBe('121.23')
    expect(aDecimal('121.23').toFixed(2)).toBe('121.23')
  })

  it('trata nulo, indefinido y vacío como cero', () => {
    expect(aDecimal(null).toFixed(2)).toBe('0.00')
    expect(aDecimal(undefined).toFixed(2)).toBe('0.00')
    expect(aDecimal('').toFixed(2)).toBe('0.00')
  })

  it('envía a la API como cadena con punto y dos decimales', () => {
    expect(aCadenaApi(new Decimal('121.235'))).toBe('121.24')
    expect(aCadenaApi(new Decimal('1000'))).toBe('1000.00')
  })
})

describe('un asiento de varias líneas cuadra exacto', () => {
  it('suma debe y haber sin perder céntimos', () => {
    const debe = ['1210.05', '0.15', '99.80'].map((v) => aDecimal(v))
    const haber = ['1000.00', '310.00'].map((v) => aDecimal(v))

    const totalDebe = debe.reduce((a, b) => a.plus(b), new Decimal(0))
    const totalHaber = haber.reduce((a, b) => a.plus(b), new Decimal(0))

    expect(totalDebe.equals(totalHaber)).toBe(true)
    expect(formatearImporte(totalDebe)).toBe('1.310,00')
  })
})

describe('fechas', () => {
  it('convierte de la API a pantalla y vuelta', () => {
    expect(formatearFecha('2026-01-05')).toBe('05/01/2026')
    expect(fechaParaApi('05/01/2026')).toBe('2026-01-05')
  })

  it('devuelve vacío cuando no hay fecha o no encaja', () => {
    expect(formatearFecha(null)).toBe('')
    expect(fechaParaApi('5/1/2026')).toBe('')
  })
})

describe('formatearEntero', () => {
  it('separa los miles con punto', () => {
    expect(formatearEntero(1234)).toBe('1.234')
    expect(formatearEntero(1234567)).toBe('1.234.567')
  })

  it('deja igual lo que no llega a mil, y el cero', () => {
    expect(formatearEntero(0)).toBe('0')
    expect(formatearEntero(87)).toBe('87')
  })

  it('conserva el signo', () => {
    expect(formatearEntero(-1234)).toBe('-1.234')
  })
})

describe('soloImporte', () => {
  it('deja pasar un importe normal', () => {
    expect(soloImporte('1234,56')).toBe('1234,56')
    expect(soloImporte('1234.56')).toBe('1234.56')
  })

  it('quita las letras, que es lo que se cuela al teclear deprisa', () => {
    expect(soloImporte('30000e')).toBe('30000')
    expect(soloImporte('12a3,4b5')).toBe('123,45')
    expect(soloImporte('abc')).toBe('')
  })

  it('deja un único separador decimal', () => {
    expect(soloImporte('1,2,3')).toBe('1,23')
    expect(soloImporte('1.234,56')).toBe('1.23456')
  })

  it('no deja poner el signo menos: aquí no hay importes negativos', () => {
    expect(soloImporte('-500')).toBe('500')
  })

  it('deja seguir escribiendo con la casilla a medias', () => {
    expect(soloImporte('')).toBe('')
    expect(soloImporte('12,')).toBe('12,')
  })
})
