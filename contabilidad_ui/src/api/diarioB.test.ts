import { describe, expect, it } from 'vitest'
import { normalizarEquivalencia } from './diarioB'

const BASE = {
  id: 1,
  cuenta_origen: '10000001',
  titulo_origen: null,
  cuenta_destino: '100000001',
  titulo_destino: null,
  observaciones: null,
}

describe('normalizarEquivalencia', () => {
  it('sin flag (SIF que aún no lo tiene) cuenta como 0', () => {
    expect(normalizarEquivalencia(BASE).flag).toBe(0)
    expect(normalizarEquivalencia({ ...BASE, flag: null }).flag).toBe(0)
  })

  it('respeta el 0 y el 1', () => {
    expect(normalizarEquivalencia({ ...BASE, flag: 1 }).flag).toBe(1)
    expect(normalizarEquivalencia({ ...BASE, flag: 0 }).flag).toBe(0)
  })
})
