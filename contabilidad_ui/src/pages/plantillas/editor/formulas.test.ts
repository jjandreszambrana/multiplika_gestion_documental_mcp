import { describe, expect, it } from 'vitest'
import { funcionAbierta, palabraFinal } from './formulas'

const funciones = [
  { nombre: 'redondear', firma: 'redondear(valor, decimales=2)', descripcion: '', ejemplo: '' },
  { nombre: 'año', firma: 'año(fecha)', descripcion: '', ejemplo: '' },
]

describe('palabraFinal', () => {
  it('coge el nombre o el número que se está escribiendo', () => {
    expect(palabraFinal('valor * pc')).toBe('pc')
    expect(palabraFinal("'Cuota ' + añ")).toBe('añ')
    expect(palabraFinal('cuenta 430')).toBe('430')
    expect(palabraFinal('valor + ')).toBe('')
  })
})

describe('funcionAbierta', () => {
  it('encuentra la función cuyo paréntesis sigue abierto', () => {
    expect(funcionAbierta('redondear(valor * ', funciones)?.nombre).toBe('redondear')
    expect(funcionAbierta('redondear(año(fecha) + ', funciones)?.nombre).toBe('redondear')
    expect(funcionAbierta('redondear(valor) + 1', funciones)).toBeNull()
  })
})
