import { describe, expect, it } from 'vitest'
import type { EquivalenciaCuenta } from '../../api/diarioB'
import { normalizarEquivalencia } from '../../api/diarioB'
import {
  datosAEnviar,
  destinosUsados,
  soloSinDestino,
  valoresDe,
  yaAsignadaA,
} from './datosEquivalencia'

const GUARDADA: EquivalenciaCuenta = {
  id: 7,
  cuenta_origen: '10000001',
  titulo_origen: 'IVAN GONZALEZ',
  cuenta_destino: '100000001',
  titulo_destino: null,
  observaciones: null,
  flag: 0,
}

describe('datosAEnviar', () => {
  it('en un alta va todo, con su Flag', () => {
    const valores = {
      ...valoresDe(null),
      cuenta_origen: ' 4300 ',
      cuenta_destino: '430000001',
      flag: 1,
    }
    expect(datosAEnviar(null, valores)).toEqual({
      cuenta_origen: '4300',
      titulo_origen: '',
      cuenta_destino: '430000001',
      titulo_destino: '',
      observaciones: '',
      flag: 1,
    })
  })

  it('al editar sin tocar nada no se manda nada', () => {
    expect(datosAEnviar(GUARDADA, valoresDe(GUARDADA))).toEqual({})
  })

  it('al editar, Flag solo va si cambia, como el resto', () => {
    expect(datosAEnviar(GUARDADA, { ...valoresDe(GUARDADA), flag: 1 })).toEqual({ flag: 1 })
    expect(
      datosAEnviar(GUARDADA, { ...valoresDe(GUARDADA), titulo_destino: 'Capital', flag: 0 }),
    ).toEqual({ titulo_destino: 'Capital' })
  })
})

describe('destinos ya asignados', () => {
  const OTRA: EquivalenciaCuenta = {
    ...GUARDADA,
    id: 8,
    cuenta_origen: '17000003',
    cuenta_destino: '170000003',
  }
  const usados = destinosUsados([GUARDADA, OTRA], null)

  it('dice de qué cuenta de origen ya es destino', () => {
    expect(yaAsignadaA('170000003', usados)).toBe('17000003')
    expect(yaAsignadaA('570000000', usados)).toBeNull()
    expect(yaAsignadaA('  ', usados)).toBeNull()
  })

  it('casa la misma subcuenta escrita con otra longitud', () => {
    expect(yaAsignadaA('17000003', usados)).toBe('17000003')
    expect(yaAsignadaA('10000001', usados)).toBe('10000001')
    expect(yaAsignadaA('100000010', usados)).toBeNull()
  })

  it('no cuenta la equivalencia que se está editando', () => {
    const sinLaMia = destinosUsados([GUARDADA, OTRA], GUARDADA.id)
    expect(yaAsignadaA('100000001', sinLaMia)).toBeNull()
    expect(yaAsignadaA('170000003', sinLaMia)).toBe('17000003')
  })
})

describe('soloSinDestino', () => {
  it('deja solo las que no tienen cuenta de destino', () => {
    const lista: EquivalenciaCuenta[] = [
      GUARDADA,
      { ...GUARDADA, id: 2, cuenta_destino: '' },
      { ...GUARDADA, id: 3, cuenta_destino: '   ' },
    ]
    expect(soloSinDestino(lista).map((e) => e.id)).toEqual([2, 3])
  })
})

describe('normalizarEquivalencia sin cuentas', () => {
  it('una deshermanada sin el campo de destino queda con cadena vacía', () => {
    const { cuenta_destino: _quitada, ...sinDestino } = GUARDADA
    const normalizada = normalizarEquivalencia(sinDestino)
    expect(normalizada.cuenta_destino).toBe('')
    expect(soloSinDestino([normalizada])).toHaveLength(1)
  })
})
