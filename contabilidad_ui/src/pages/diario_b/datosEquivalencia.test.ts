import { describe, expect, it } from 'vitest'
import type { EquivalenciaCuenta } from '../../api/diarioB'
import { datosAEnviar, valoresDe } from './datosEquivalencia'

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
