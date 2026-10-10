import { describe, expect, it } from 'vitest'
import { fechaDeApi, fechaParaApi, parsearFechaEscrita } from './fecha'

describe('parsearFechaEscrita', () => {
  it('lee dd/mm/aaaa, no mm/dd/aaaa', () => {
    const f = parsearFechaEscrita('03/09/2026')
    expect(f?.getDate()).toBe(3)
    expect(f?.getMonth()).toBe(8)
    expect(f?.getFullYear()).toBe(2026)
  })

  it('admite guiones y puntos', () => {
    expect(fechaParaApi(parsearFechaEscrita('03-09-2026'))).toBe('2026-09-03')
    expect(fechaParaApi(parsearFechaEscrita('03.09.2026'))).toBe('2026-09-03')
  })

  it('admite sin ceros a la izquierda', () => {
    expect(fechaParaApi(parsearFechaEscrita('3/9/2026'))).toBe('2026-09-03')
  })

  it('admite escribirla del tirón', () => {
    expect(fechaParaApi(parsearFechaEscrita('03092026'))).toBe('2026-09-03')
    expect(fechaParaApi(parsearFechaEscrita('030926'))).toBe('2026-09-03')
  })

  it('toma el año de dos cifras como 20xx', () => {
    expect(parsearFechaEscrita('01/01/26')?.getFullYear()).toBe(2026)
  })

  it('devuelve null mientras la fecha está a medias', () => {
    expect(parsearFechaEscrita('')).toBeNull()
    expect(parsearFechaEscrita('03')).toBeNull()
    expect(parsearFechaEscrita('03/')).toBeNull()
    expect(parsearFechaEscrita('03/09')).toBeNull()
    expect(parsearFechaEscrita('03/09/20')).not.toBeNull()
  })

  it('devuelve null si el día no existe en el calendario', () => {
    expect(parsearFechaEscrita('31/02/2026')).toBeNull()
    expect(parsearFechaEscrita('32/01/2026')).toBeNull()
    expect(parsearFechaEscrita('01/13/2026')).toBeNull()
    expect(parsearFechaEscrita('00/01/2026')).toBeNull()
  })

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(fechaParaApi(parsearFechaEscrita('29/02/2024'))).toBe('2024-02-29')
    expect(parsearFechaEscrita('29/02/2026')).toBeNull()
  })

  it('lo tecleado y lo que vuelve de la API dan la misma fecha', () => {
    expect(fechaParaApi(parsearFechaEscrita('01/03/2026'))).toBe(
      fechaParaApi(fechaDeApi('2026-03-01')),
    )
  })
})
