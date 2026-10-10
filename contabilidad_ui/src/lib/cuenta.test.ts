import { describe, expect, it } from 'vitest'
import { expandirCuenta, nombreDeTipo, soloCodigoDeCuenta, codigoDeOpcion } from './cuenta'

const ANCHO = 9

describe('expandirCuenta', () => {
  it('rellena con ceros hasta el ancho de la empresa', () => {
    expect(expandirCuenta('431.10', ANCHO)).toBe('431000010')
    expect(expandirCuenta('430.1', ANCHO)).toBe('430000001')
    expect(expandirCuenta('572.', ANCHO)).toBe('572000000')
  })

  it('respeta el ancho de cada empresa', () => {
    expect(expandirCuenta('431.10', 8)).toBe('43100010')
    expect(expandirCuenta('431.10', 12)).toBe('431000000010')
  })

  it('deja igual lo que no lleva punto', () => {
    expect(expandirCuenta('430000001', ANCHO)).toBe('430000001')
    expect(expandirCuenta('430', ANCHO)).toBe('430')
  })

  it('quita los espacios de alrededor', () => {
    expect(expandirCuenta('  431.10  ', ANCHO)).toBe('431000010')
  })

  it('no toca lo que no cabe ni lo que lleva dos puntos', () => {
    expect(expandirCuenta('4310000001.5', ANCHO)).toBe('4310000001.5')
    expect(expandirCuenta('43.1.10', ANCHO)).toBe('43.1.10')
  })

  it('devuelve vacío si no se ha escrito nada', () => {
    expect(expandirCuenta('', ANCHO)).toBe('')
  })
})

describe('nombreDeTipo', () => {
  it('llama subcuenta a la que admite apuntes, sea cual sea su nivel', () => {
    expect(nombreDeTipo(9, true)).toBe('Subcuenta')
    expect(nombreDeTipo(4, true)).toBe('Subcuenta')
  })

  it('nombra las demás por sus dígitos', () => {
    expect(nombreDeTipo(1, false)).toBe('Grupo')
    expect(nombreDeTipo(2, false)).toBe('Subgrupo')
    expect(nombreDeTipo(3, false)).toBe('Cuenta de mayor')
    expect(nombreDeTipo(4, false)).toBe('Cuenta de mayor')
    expect(nombreDeTipo(6, false)).toBe('Cuenta de mayor')
  })

  it('trata un código todavía sin teclear como grupo', () => {
    expect(nombreDeTipo(0, false)).toBe('Grupo')
  })
})

describe('soloCodigoDeCuenta', () => {
  it('quita las letras y deja los dígitos', () => {
    expect(soloCodigoDeCuenta('43a0b1')).toBe('4301')
  })

  it('deja pasar el punto, que es el comodín', () => {
    expect(soloCodigoDeCuenta('431.10')).toBe('431.10')
  })

  it('quita espacios, signos y acentos', () => {
    expect(soloCodigoDeCuenta(' 472 - ñ ')).toBe('472')
  })

  it('deja vacío lo que no trae ningún dígito', () => {
    expect(soloCodigoDeCuenta('cuenta')).toBe('')
  })
})

describe('codigoDeOpcion', () => {
  it('se queda con el número cuando se acepta una opción del selector', () => {
    expect(codigoDeOpcion('430000001 · Clientes, Pepe Pérez')).toBe('430000001')
  })

  it('deja buscar por título: lo tecleado no se toca', () => {
    expect(codigoDeOpcion('caja')).toBe('caja')
    expect(codigoDeOpcion('amortización')).toBe('amortización')
    expect(codigoDeOpcion('430.1')).toBe('430.1')
    expect(codigoDeOpcion('')).toBe('')
  })

  it('un título con guiones no se parte por ellos', () => {
    expect(codigoDeOpcion('600000001 · Compras - mercaderías')).toBe('600000001')
  })
})
