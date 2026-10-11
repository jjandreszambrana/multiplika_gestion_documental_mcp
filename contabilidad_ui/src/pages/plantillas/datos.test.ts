import { describe, expect, it } from 'vitest'
import { resumenDeDatos } from './datos'

describe('resumenDeDatos', () => {
  it('pone en una línea lo tecleado', () => {
    expect(
      resumenDeDatos({
        fecha_op: '2026-10-31',
        valor: '1200.00',
        usa_obra: false,
        nota: '',
        cliente: { cuenta: '430000001', razon: 'Maderas SL', cif: 'B1' },
        detalle: [{}, {}, {}],
      }),
    ).toBe('fecha_op: 2026-10-31 · valor: 1200.00 · usa_obra: no · cliente: Maderas SL · detalle: 3 filas')
  })

  it('lee la lista que guarda el servidor, sin los datos ocultos', () => {
    expect(
      resumenDeDatos([
        { clave: 'importe', valor: '100.00', visible: true },
        { clave: 'obra', valor: null, visible: false },
        { clave: 'extras', valor: [{ detalle: 'Uno', importe: '20.50' }], visible: true },
      ]),
    ).toBe('importe: 100.00 · extras: 1 fila')
  })

  it('sin datos, nada', () => {
    expect(resumenDeDatos(null)).toBe('')
  })
})
