import { describe, expect, it } from 'vitest'
import { ordenarColumnas } from './columnas'

const DE_FABRICA = ['fecha', 'asiento', 'pase', 'cuenta', 'concepto', 'debe', 'haber']

describe('ordenarColumnas', () => {
  it('sin nada guardado, deja el orden de fábrica', () => {
    expect(ordenarColumnas(null, DE_FABRICA)).toEqual(DE_FABRICA)
  })

  it('respeta el orden que el usuario dejó puesto', () => {
    const suyo = ['cuenta', 'fecha', 'asiento', 'pase', 'concepto', 'debe', 'haber']
    expect(ordenarColumnas(suyo, DE_FABRICA)).toEqual(suyo)
  })

  it('añade al final una columna nueva, en vez de perderla', () => {
    const suyo = ['cuenta', 'fecha', 'asiento', 'pase', 'concepto', 'debe', 'haber']
    const conNueva = [...DE_FABRICA, 'documento']
    expect(ordenarColumnas(suyo, conNueva)).toEqual([...suyo, 'documento'])
  })

  it('descarta una columna que ya no existe', () => {
    const suyo = [
      'fecha',
      'columna_retirada',
      'asiento',
      'pase',
      'cuenta',
      'concepto',
      'debe',
      'haber',
    ]
    expect(ordenarColumnas(suyo, DE_FABRICA)).toEqual(DE_FABRICA)
  })
})
