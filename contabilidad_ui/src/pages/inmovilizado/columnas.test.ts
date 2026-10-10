import { describe, expect, it } from 'vitest'
import { mesDotado } from './columnas'

describe('mesDotado', () => {
  it('pasa el periodo de la API a como se lee en España', () => {
    expect(mesDotado('2026-05')).toBe('05/2026')
  })

  it('un bien que nunca se ha dotado no enseña nada', () => {
    expect(mesDotado('')).toBe('')
  })

  it('deja enero y diciembre con sus dos cifras', () => {
    expect(mesDotado('2025-01')).toBe('01/2025')
    expect(mesDotado('2025-12')).toBe('12/2025')
  })

  it('lo que no es un periodo se enseña tal cual, en vez de quedar en blanco', () => {
    expect(mesDotado('2026-5')).toBe('2026-5')
    expect(mesDotado('mayo')).toBe('mayo')
  })
})
