import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { CasillaDeclarada, FichaDeclaracion } from '../../api/declaraciones'
import {
  BORRADOR,
  casillasPorApartado,
  cambiosDePartida,
  formularioDe,
  PRESENTADA,
  pasosDeEstado,
  REGISTRADA,
  sePuedeEditar,
  SUSTITUIDA,
} from './declaracion'

describe('pasosDeEstado', () => {
  it('de borrador solo se registra', () => {
    expect(pasosDeEstado(BORRADOR, false).map((p) => p.estado)).toEqual([REGISTRADA])
  })

  it('de registrada se presenta (con justificante) o se vuelve a borrador', () => {
    const pasos = pasosDeEstado(REGISTRADA, false)
    expect(pasos.map((p) => p.estado)).toEqual([PRESENTADA, BORRADOR])
    expect(pasos[0]?.pideJustificante).toBe(true)
  })

  it('de presentada solo se deshace a registrada, nunca a borrador', () => {
    expect(pasosDeEstado(PRESENTADA, false).map((p) => p.estado)).toEqual([REGISTRADA])
  })

  it('con la liquidación contabilizada o sustituida no hay cambios', () => {
    expect(pasosDeEstado(REGISTRADA, true)).toEqual([])
    expect(pasosDeEstado(SUSTITUIDA, false)).toEqual([])
  })
})

describe('sePuedeEditar', () => {
  it('solo en borrador o registrada y sin contabilizar', () => {
    expect(sePuedeEditar(BORRADOR, false)).toBe(true)
    expect(sePuedeEditar(REGISTRADA, false)).toBe(true)
    expect(sePuedeEditar(REGISTRADA, true)).toBe(false)
    expect(sePuedeEditar(PRESENTADA, false)).toBe(false)
    expect(sePuedeEditar(SUSTITUIDA, false)).toBe(false)
  })
})

function casilla(numero: string, apartado: string): CasillaDeclarada {
  return {
    pagina: '01000',
    casilla: numero,
    importe: new Decimal(0),
    importe_calculado: new Decimal(0),
    apartado,
    descripcion: '',
    ajustable: true,
  }
}

describe('casillasPorApartado', () => {
  it('agrupa en el orden del impreso sin reordenar las casillas', () => {
    const grupos = casillasPorApartado([
      casilla('01', 'devengado'),
      casilla('28', 'deducible'),
      casilla('03', 'devengado'),
      casilla('71', 'resultado'),
    ])
    expect(grupos.map((g) => g.clave)).toEqual(['devengado', 'deducible', 'resultado'])
    expect(grupos[0]?.casillas.map((c) => c.casilla)).toEqual(['01', '03'])
  })

  it('no pierde un apartado desconocido', () => {
    expect(casillasPorApartado([casilla('99', 'nuevo')]).map((g) => g.clave)).toEqual(['nuevo'])
  })
})

function ficha(cuotas: Decimal | null): FichaDeclaracion {
  return {
    cuotas_a_compensar: cuotas,
    solicitar_devolucion: false,
    devolucion_mensual: false,
    forma_de_pago: '',
    iban: '',
    bic: '',
    criterio_caja: false,
    destinatario_criterio_caja: false,
    sii_voluntario: false,
    exonerado_390: false,
    gasolinas: false,
  } as FichaDeclaracion
}

describe('cambiosDePartida', () => {
  it('sin tocar nada no manda nada', () => {
    const guardada = ficha(new Decimal('150.5'))
    expect(cambiosDePartida(guardada, formularioDe(guardada))).toEqual({})
  })

  it('manda solo lo cambiado, con el importe en formato de la API', () => {
    const guardada = ficha(null)
    const formulario = { ...formularioDe(guardada), cuotasDeAnterior: false, cuotas: '1200,5', iban: ' ES12 ', gasolinas: true }
    expect(cambiosDePartida(guardada, formulario)).toEqual({
      cuotas_a_compensar: '1200.50',
      iban: 'ES12',
      gasolinas: true,
    })
  })

  it('volver a tomarlas de la anterior manda null', () => {
    const guardada = ficha(new Decimal(10))
    const formulario = { ...formularioDe(guardada), cuotasDeAnterior: true }
    expect(cambiosDePartida(guardada, formulario)).toEqual({ cuotas_a_compensar: null })
  })
})
