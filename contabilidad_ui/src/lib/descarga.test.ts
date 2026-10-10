import { describe, expect, it } from 'vitest'
import { marcaDeTiempo, nombreDeFichero } from './descarga'

/** 1 de septiembre de 2025, 06:24:01. El ejemplo que fijó el usuario. */
const EJEMPLO = new Date(2025, 8, 1, 6, 24, 1)

describe('marcaDeTiempo', () => {
  it('da día, mes, año, hora, minuto y segundo pegados', () => {
    expect(marcaDeTiempo(EJEMPLO)).toBe('01092025062401')
  })

  it('rellena con ceros los de un solo dígito', () => {
    expect(marcaDeTiempo(new Date(2026, 0, 9, 4, 5, 6))).toBe('09012026040506')
  })

  it('no se corta a medianoche', () => {
    expect(marcaDeTiempo(new Date(2026, 11, 31, 0, 0, 0))).toBe('31122026000000')
  })

  it('siempre son catorce dígitos', () => {
    expect(marcaDeTiempo(new Date(2026, 10, 25, 23, 59, 59))).toMatch(/^\d{14}$/)
  })
})

describe('nombreDeFichero', () => {
  it('pega la marca detrás del nombre y antes de la extensión', () => {
    expect(nombreDeFichero('pyg', 'xlsx', EJEMPLO)).toBe('pyg_01092025062401.xlsx')
  })

  it('vale para un nombre con ejercicio y cuenta', () => {
    expect(nombreDeFichero('mayor_2026_430000001', 'xlsx', EJEMPLO)).toBe(
      'mayor_2026_430000001_01092025062401.xlsx',
    )
  })

  it('dos descargas en el mismo segundo son el mismo nombre; en distinto, no', () => {
    const uno = nombreDeFichero('balance_pyg', 'xlsx', EJEMPLO)
    const dos = nombreDeFichero('balance_pyg', 'xlsx', new Date(2025, 8, 1, 6, 24, 2))
    expect(uno).not.toBe(dos)
  })
})
