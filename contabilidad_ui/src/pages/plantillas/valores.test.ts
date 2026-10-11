import { describe, expect, it } from 'vitest'
import type { Parametro } from '../../api/plantillas'
import { textoDeResuelto, valoresIniciales, valoresParaEnviar } from './valores'

const importe: Parametro = { clave: 'valor', tipo: 'importe' }
const fecha: Parametro = { clave: 'fecha_op', tipo: 'fecha' }
const marca: Parametro = { clave: 'usa_obra', tipo: 'booleano' }
const tabla: Parametro = {
  clave: 'detalle',
  tipo: 'tabla',
  filas_minimas: 2,
  columnas: [
    { clave: 'base', tipo: 'importe' },
    { clave: 'exenta', tipo: 'booleano' },
  ],
}

describe('valoresParaEnviar', () => {
  it('manda solo lo tocado, con los importes como cadena con punto', () => {
    const enviado = valoresParaEnviar(
      [importe, fecha, marca],
      { valor: '1234,56', fecha_op: '2026-10-31', usa_obra: true },
      new Set(['valor', 'usa_obra']),
    )
    expect(enviado).toEqual({ valor: '1234.56', usa_obra: true })
  })

  it('manda las tablas siempre, celda a celda', () => {
    const enviado = valoresParaEnviar(
      [tabla],
      { detalle: [{ base: '100,5', exenta: false }, { base: '', exenta: true }] },
      new Set(),
    )
    expect(enviado).toEqual({
      detalle: [
        { base: '100.5', exenta: false },
        { base: '', exenta: true },
      ],
    })
  })
})

describe('textoDeResuelto', () => {
  it('enseña el importe con coma y la fecha tal cual', () => {
    expect(textoDeResuelto(importe, '1234.56')).toBe('1234,56')
    expect(textoDeResuelto(importe, 8.5)).toBe('8,5')
    expect(textoDeResuelto(fecha, '2026-10-31')).toBe('2026-10-31')
    expect(textoDeResuelto(importe, null)).toBe('')
  })

  it('de un tercero enseña su subcuenta', () => {
    const tercero: Parametro = { clave: 'cliente', tipo: 'tercero' }
    expect(textoDeResuelto(tercero, { cuenta: '430000001', razon: 'Maderas SL', cif: 'B1' })).toBe(
      '430000001',
    )
  })
})

describe('valoresIniciales', () => {
  it('arranca las tablas con sus filas mínimas', () => {
    expect(valoresIniciales([importe, tabla])).toEqual({
      detalle: [
        { base: '', exenta: false },
        { base: '', exenta: false },
      ],
    })
  })
})
