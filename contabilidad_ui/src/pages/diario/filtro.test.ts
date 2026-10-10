import { describe, expect, it } from 'vitest'
import {
  diaDeEntrada,
  filtroDeEntrada,
  importeParaApi,
  normalizarFiltro,
  resumenDeFiltro,
  soloDigitos,
  SIN_CONDICIONES,
} from './filtro'

const HOY = new Date()
const hoyIso = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}-${String(
  HOY.getDate(),
).padStart(2, '0')}`

describe('diaDeEntrada', () => {
  it('en el ejercicio en curso, hoy', () => {
    expect(diaDeEntrada(HOY.getFullYear(), '2026-12-31')).toBe(hoyIso)
  })

  it('en un ejercicio pasado, su último día', () => {
    expect(diaDeEntrada(2024, '2024-12-31')).toBe('2024-12-31')
  })

  it('respeta un ejercicio que no es el año natural', () => {
    expect(diaDeEntrada(2024, '2025-06-30')).toBe('2025-06-30')
  })

  it('sin fecha de cierre no filtra por fecha', () => {
    expect(diaDeEntrada(2024, null)).toBe('')
  })
})

describe('filtroDeEntrada', () => {
  it('abre por un solo día, sin cuenta y con las confirmadas', () => {
    expect(filtroDeEntrada(2024, '2024-12-31')).toEqual({
      ...SIN_CONDICIONES,
      desde: '2024-12-31',
      hasta: '2024-12-31',
      incluir: 'confirmadas',
    })
  })
})

describe('resumenDeFiltro', () => {
  it('dice «Hoy» cuando el día es el de hoy', () => {
    expect(resumenDeFiltro({ ...SIN_CONDICIONES, desde: hoyIso, hasta: hoyIso, incluir: 'confirmadas' })).toBe(
      'Hoy · confirmadas',
    )
  })

  it('dice la fecha cuando es un día que no es hoy', () => {
    expect(
      resumenDeFiltro({ ...SIN_CONDICIONES, desde: '2024-12-31', hasta: '2024-12-31', incluir: 'confirmadas' }),
    ).toBe('31/12/2024 · confirmadas')
  })

  it('dice el rango, la cuenta y qué se incluye', () => {
    expect(
      resumenDeFiltro({
        ...SIN_CONDICIONES,
        cuenta: '430000001',
        desde: '2026-09-01',
        hasta: '2026-09-30',
        incluir: 'todas',
      }),
    ).toBe('01/09/2026 – 30/09/2026 · cuenta 430000001 · todas')
  })

  it('sin fechas, todo el ejercicio', () => {
    expect(resumenDeFiltro({ ...SIN_CONDICIONES, desde: '', hasta: '', incluir: 'borradores' })).toBe(
      'Todo el ejercicio · borradores',
    )
  })

  it('con un solo extremo lo dice', () => {
    expect(resumenDeFiltro({ ...SIN_CONDICIONES, desde: '2026-09-01', hasta: '', incluir: 'confirmadas' })).toBe(
      'desde 01/09/2026 · confirmadas',
    )
    expect(resumenDeFiltro({ ...SIN_CONDICIONES, desde: '', hasta: '2026-09-30', incluir: 'confirmadas' })).toBe(
      'hasta 30/09/2026 · confirmadas',
    )
  })
})

describe('importeParaApi', () => {
  it('pasa el formato español a cadena decimal', () => {
    expect(importeParaApi('1.234,56')).toBe('1234.56')
    expect(importeParaApi('121,23')).toBe('121.23')
    expect(importeParaApi('100')).toBe('100')
  })

  it('admite el cero y los negativos', () => {
    expect(importeParaApi('0')).toBe('0')
    expect(importeParaApi('-50,25')).toBe('-50.25')
  })

  it('no redondea ni recorta decimales', () => {
    expect(importeParaApi('1234,565')).toBe('1234.565')
  })

  it('vacío cuando no es un número', () => {
    expect(importeParaApi('')).toBe('')
    expect(importeParaApi('   ')).toBe('')
    expect(importeParaApi('abc')).toBe('')
    expect(importeParaApi('12,3,4')).toBe('')
  })
})

describe('soloDigitos', () => {
  it('se queda con los dígitos', () => {
    expect(soloDigitos('412')).toBe('412')
    expect(soloDigitos('a4 1-2b')).toBe('412')
    expect(soloDigitos('abc')).toBe('')
  })
})

describe('normalizarFiltro', () => {
  const porDefecto = filtroDeEntrada(2026, '2026-12-31')

  it('completa un filtro guardado antes de los campos nuevos', () => {
    const viejo = { cuenta: '430', desde: '2026-03-01', hasta: '2026-03-31', incluir: 'todas' }
    expect(normalizarFiltro(viejo, porDefecto)).toEqual({
      ...SIN_CONDICIONES,
      cuenta: '430',
      desde: '2026-03-01',
      hasta: '2026-03-31',
      incluir: 'todas',
    })
  })

  it('sin nada guardado, el de entrada', () => {
    expect(normalizarFiltro(null, porDefecto)).toEqual(porDefecto)
    expect(normalizarFiltro('vaya', porDefecto)).toEqual(porDefecto)
  })

  it('descarta lo que no es texto y lo que no es un valor de «Mostrar»', () => {
    const raro = { cuenta: 7, concepto: null, incluir: 'inventado' }
    expect(normalizarFiltro(raro, porDefecto)).toEqual(porDefecto)
  })

  it('conserva los siete campos nuevos', () => {
    const completo = {
      ...porDefecto,
      diario: 'GEN',
      concepto: 'nomina',
      documento: 'F-12',
      asientoDesde: '10',
      asientoHasta: '20',
      importeDesde: '100.00',
      importeHasta: '200.00',
    }
    expect(normalizarFiltro(completo, porDefecto)).toEqual(completo)
  })
})

describe('importeParaApi y soloDigitos aguantan lo que venga del navegador', () => {
  it('un campo que no existe no rompe la pantalla', () => {
    expect(importeParaApi(undefined as unknown as string)).toBe('')
    expect(soloDigitos(undefined as unknown as string)).toBe('')
  })
})
