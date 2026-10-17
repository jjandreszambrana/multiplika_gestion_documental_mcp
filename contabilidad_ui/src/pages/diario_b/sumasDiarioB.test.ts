import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { EquivalenciaCuenta, LineaDiarioB } from '../../api/diarioB'
import { clasificarAsientos, sumarDiarioB, type OpcionesSumasDiarioB } from './sumasDiarioB'

// Cada línea va en su propio asiento: así las marcas de `diario` solo afectan a
// la suya, y ninguna se toma por apertura o cierre sin querer.
let siguienteAsiento = 100

function linea(
  cuenta: string,
  debe: string,
  haber: string,
  fecha: string | null = '2026-03-01',
  diario: string | null = null,
): LineaDiarioB {
  return {
    pase: siguienteAsiento,
    ejercicio: 2026,
    asiento: siguienteAsiento++,
    fecha,
    cuenta,
    debe: new Decimal(debe),
    haber: new Decimal(haber),
    concepto: null,
    documento: null,
    diario,
    contabilizado: 1,
  }
}

const EQUIVALENCIA: EquivalenciaCuenta = {
  id: 1,
  cuenta_origen: '430000001',
  titulo_origen: 'Cliente viejo',
  cuenta_destino: '430000099',
  titulo_destino: 'Cliente nuevo',
  observaciones: null,
}

const PLAN: Record<string, string> = {
  '570000000': 'Caja',
  '4': 'Acreedores y deudores',
  '43': 'Clientes',
  '430': 'Clientes',
}

function opciones(cambios: Partial<OpcionesSumasDiarioB> = {}): OpcionesSumasDiarioB {
  return {
    equivalencias: null,
    tituloDelPlan: (c) => PLAN[c],
    nivel: 0,
    desde: '',
    hasta: '',
    sinRegularizacion: false,
    ...cambios,
  }
}

const f2 = (d: Decimal) => d.toFixed(2)

describe('sumarDiarioB', () => {
  it('suma por cuenta, ordena y saca los saldos de los acumulados', () => {
    const r = sumarDiarioB(
      [
        linea('570000000', '0', '100.10'),
        linea('430000001', '121.05', '0'),
        linea('430000001', '0.15', '21.10'),
      ],
      opciones(),
    )
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['430000001', '570000000'])
    const [cliente, caja] = r.cuentas
    expect(f2(cliente.debe)).toBe('121.20')
    expect(f2(cliente.acumHaber)).toBe('21.10')
    expect(f2(cliente.inicial)).toBe('0.00')
    expect(f2(cliente.deudor)).toBe('100.10')
    expect(caja.titulo).toBe('Caja')
    expect(f2(caja.acreedor)).toBe('100.10')
    expect(f2(r.total.debe)).toBe('121.20')
    expect(f2(r.total.haber)).toBe('121.20')
  })

  it('el ejemplo del Excel del cliente: apertura y periodo', () => {
    const r = sumarDiarioB(
      [
        linea('400000001', '0', '504241.84', '2026-01-01', ' apertura '),
        linea('400000001', '364360.94', '0', '2026-05-10'),
        linea('400000001', '0', '369142.80', '2026-06-10'),
      ],
      opciones(),
    )
    const [c] = r.cuentas
    expect(f2(c.inicial)).toBe('-504241.84')
    expect(f2(c.debe)).toBe('364360.94')
    expect(f2(c.haber)).toBe('369142.80')
    expect(f2(c.acumDebe)).toBe('364360.94')
    expect(f2(c.acumHaber)).toBe('873384.64')
    expect(f2(c.acreedor)).toBe('509023.70')
    expect(f2(c.deudor)).toBe('0.00')
  })

  it('con «desde», lo anterior va al saldo inicial; lo posterior a «hasta» no entra', () => {
    const r = sumarDiarioB(
      [
        linea('570000000', '100', '0', '2026-01-01', 'APERTURA'),
        linea('570000000', '50', '0', '2026-02-15'),
        linea('570000000', '0', '30', '2026-03-01'),
        linea('570000000', '7', '0', '2026-03-31'),
        linea('570000000', '999', '0', '2026-04-01'),
        linea('570000000', '888', '0', null),
      ],
      opciones({ desde: '2026-03-01', hasta: '2026-03-31' }),
    )
    const [c] = r.cuentas
    expect(f2(c.inicial)).toBe('150.00')
    expect(f2(c.debe)).toBe('7.00')
    expect(f2(c.haber)).toBe('30.00')
    expect(f2(c.acumDebe)).toBe('157.00')
    expect(f2(c.acumHaber)).toBe('30.00')
    expect(f2(c.deudor)).toBe('127.00')
  })

  it('«sin regularización ni cierre» descarta esas líneas, sin mirar mayúsculas ni espacios', () => {
    const lineas = [
      linea('129000000', '0', '40'),
      linea('129000000', '40', '0', '2026-12-31', 'Regulariza'),
      linea('129000000', '0', '5', '2026-12-31', ' cierre'),
    ]
    expect(f2(sumarDiarioB(lineas, opciones()).cuentas[0].acumHaber)).toBe('45.00')
    const sin = sumarDiarioB(lineas, opciones({ sinRegularizacion: true }))
    expect(f2(sin.cuentas[0].acumDebe)).toBe('0.00')
    expect(f2(sin.cuentas[0].acumHaber)).toBe('40.00')
  })

  it('por subcuenta, una cuenta corta se completa con ceros (1130 → 11300000)', () => {
    const r = sumarDiarioB(
      [linea('1130', '0', '100', '2026-01-01', 'APERTURA'), linea('11300000', '0', '5'), linea('11300001', '2', '0')],
      opciones(),
    )
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['11300000', '11300001'])
    expect(f2(r.cuentas[0].acumHaber)).toBe('105.00')
  })

  it('con equivalencias, la cuenta de origen se suma en la de destino', () => {
    const r = sumarDiarioB(
      [linea('430000001', '50', '0'), linea('430000099', '25.50', '0'), linea('430000011', '1', '0')],
      opciones({ equivalencias: [EQUIVALENCIA] }),
    )
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['430000011', '430000099'])
    expect(f2(r.cuentas[1].debe)).toBe('75.50')
    expect(r.cuentas[1].titulo).toBe('Cliente nuevo')
    expect(r.cuentas[0].titulo).toBe('')
  })

  it('no saca cuentas sin importes, pero sí las de saldo cero', () => {
    const r = sumarDiarioB(
      [linea('600000000', '0', '0'), linea('572000000', '10', '10')],
      opciones(),
    )
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['572000000'])
    expect(f2(r.cuentas[0].deudor)).toBe('0.00')
    expect(f2(r.cuentas[0].acreedor)).toBe('0.00')
  })
})

describe('sumarDiarioB por niveles', () => {
  const LINEAS = [
    linea('430000001', '50', '0'),
    linea('430000099', '25.50', '0'),
    linea('431000001', '10', '0', '2026-01-01', 'APERTURA'),
    linea('570000000', '0', '85.50'),
  ]

  it('por cuenta de mayor junta por los tres primeros dígitos, saldo inicial incluido', () => {
    const r = sumarDiarioB(LINEAS, opciones({ nivel: 3 }))
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['430', '431', '570'])
    expect(f2(r.cuentas[0].debe)).toBe('75.50')
    expect(r.cuentas[0].titulo).toBe('Clientes')
    expect(r.cuentas[1].titulo).toBe('')
    expect(f2(r.cuentas[1].inicial)).toBe('10.00')
  })

  it('por subgrupo y por grupo', () => {
    const subgrupo = sumarDiarioB(LINEAS, opciones({ nivel: 2 }))
    expect(subgrupo.cuentas.map((c) => c.cuenta)).toEqual(['43', '57'])
    expect(f2(subgrupo.cuentas[0].inicial)).toBe('10.00')
    expect(f2(subgrupo.cuentas[0].deudor)).toBe('85.50')
    const grupo = sumarDiarioB(LINEAS, opciones({ nivel: 1 }))
    expect(grupo.cuentas.map((c) => c.cuenta)).toEqual(['4', '5'])
    expect(grupo.cuentas[0].titulo).toBe('Acreedores y deudores')
  })

  it('las equivalencias se aplican antes de juntar, con el título del plan', () => {
    const traslado: EquivalenciaCuenta = { ...EQUIVALENCIA, cuenta_destino: '572000001' }
    const r = sumarDiarioB(LINEAS, opciones({ equivalencias: [traslado], nivel: 3 }))
    expect(r.cuentas.map((c) => c.cuenta)).toEqual(['430', '431', '570', '572'])
    expect(f2(r.cuentas[0].debe)).toBe('25.50')
    expect(f2(r.cuentas[3].debe)).toBe('50.00')
    expect(r.cuentas[3].titulo).toBe('')
  })

  it('los totales son los mismos en todos los niveles', () => {
    for (const nivel of [0, 1, 2, 3] as const) {
      const r = sumarDiarioB(LINEAS, opciones({ equivalencias: [EQUIVALENCIA], nivel }))
      expect(f2(r.total.inicial)).toBe('10.00')
      expect(f2(r.total.debe)).toBe('75.50')
      expect(f2(r.total.haber)).toBe('85.50')
      expect(f2(r.total.acumDebe)).toBe('85.50')
      expect(f2(r.total.acumHaber)).toBe('85.50')
    }
  })
})

describe('clasificarAsientos', () => {
  const en = (asiento: number, l: LineaDiarioB): LineaDiarioB => ({ ...l, asiento })
  const ejercicio = [
    en(1, linea('1000', '0', '100', '2026-01-01')),
    en(1, linea('5720', '100', '0', '2026-01-01')),
    en(2, linea('60000000', '30', '0', '2026-05-01')),
    en(2, linea('70000000', '0', '50', '2026-05-01')),
    en(2, linea('57200000', '20', '0', '2026-05-01')),
    en(3, linea('7000', '50', '0', '2026-12-31')),
    en(3, linea('6000', '0', '30', '2026-12-31')),
    en(3, linea('1290', '0', '20', '2026-12-31')),
    en(4, linea('1000', '100', '0', '2026-12-31')),
    en(4, linea('1290', '20', '0', '2026-12-31')),
    en(4, linea('5720', '0', '120', '2026-12-31')),
  ]

  it('reconoce apertura, regularización y cierre sin marcas', () => {
    expect(Object.fromEntries(clasificarAsientos(ejercicio, 8))).toEqual({ 1: 'APERTURA', 3: 'REGULARIZA', 4: 'CIERRE' })
  })

  it('a mitad de año no toma el último asiento por cierre', () => {
    const hastaMayo = ejercicio.filter((l) => (l.fecha ?? '') <= '2026-05-31')
    expect(Object.fromEntries(clasificarAsientos(hastaMayo, 8))).toEqual({ 1: 'APERTURA' })
  })

  it('una marca en «diario» manda', () => {
    const conMarca = ejercicio.map((l) => (l.asiento === 2 ? { ...l, diario: 'cierre' } : l))
    expect(clasificarAsientos(conMarca, 8).get(2)).toBe('CIERRE')
    expect(clasificarAsientos(conMarca, 8).has(4)).toBe(false)
  })
})
