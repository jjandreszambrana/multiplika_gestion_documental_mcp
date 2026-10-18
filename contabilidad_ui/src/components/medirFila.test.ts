import { describe, expect, it } from 'vitest'
import { medirFila } from './medirFila'

function fila(alto: number) {
  return { getBoundingClientRect: () => ({ height: alto }) } as unknown as Element
}
const rejilla = {
  indexFromElement: () => 1,
  measurementsCache: [{ size: 30 }, { size: 55 }],
}

describe('medirFila', () => {
  it('con alto de verdad, ese', () => {
    expect(medirFila(fila(48), undefined, rejilla)).toBe(48)
  })

  it('oculta (alto 0), el que ya tenía la fila', () => {
    expect(medirFila(fila(0), undefined, rejilla)).toBe(55)
  })

  it('oculta y sin medida previa, la estimada', () => {
    expect(medirFila(fila(0), undefined, { ...rejilla, indexFromElement: () => 9 })).toBe(42.7)
  })
})
