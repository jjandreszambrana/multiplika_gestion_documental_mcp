import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { AsientoCalculado, LineaCalculada } from '../../api/plantillas'
import { claveDeCelda, claveDeLinea, repartirErrores } from './errores'

function linea(lineaPlantilla: number | null, fila: number | null = null): LineaCalculada {
  return {
    cuenta: '6400001',
    debe: new Decimal(0),
    haber: new Decimal(0),
    concepto: '',
    lineaPlantilla,
    fila,
    autocuadre: lineaPlantilla === null,
  }
}

function asiento(orden: number, papel: string, lineas: LineaCalculada[]): AsientoCalculado {
  return {
    orden,
    papel,
    asientoPlantilla: 0,
    fecha: '2026-10-31',
    concepto: '',
    diario: 'GEN',
    lineas,
    totalDebe: new Decimal(0),
    totalHaber: new Decimal(0),
    diferencia: new Decimal(0),
    cuadra: true,
  }
}

// Plantilla de nómina: línea 0 fija, línea 1 repetida por empleado (filas 1 y 2),
// línea 2 de cero omitida, y una línea de cuadre al final.
const asientos = [
  asiento(0, 'principal', [linea(0), linea(1, 1), linea(1, 2), linea(null)]),
  asiento(1, 'reversion', [linea(0), linea(1, 1), linea(1, 2), linea(null)]),
]

describe('repartirErrores', () => {
  it('pone los errores de los datos junto a su dato o su celda', () => {
    const r = repartirErrores(
      [
        { ruta: 'parametros.valor', mensaje: 'Este dato es obligatorio.' },
        { ruta: 'parametros.detalle[2].importe', mensaje: 'Como mucho 2 decimales.' },
        { ruta: 'parametros.detalle', mensaje: 'Hacen falta al menos 1 filas.' },
      ],
      asientos,
    )
    expect(r.porDato.get('valor')).toEqual(['Este dato es obligatorio.'])
    expect(r.porDato.get('detalle')).toEqual(['Hacen falta al menos 1 filas.'])
    expect(r.porCelda.get(claveDeCelda('detalle', 2, 'importe'))).toEqual([
      'Como mucho 2 decimales.',
    ])
  })

  it('casa la línea de la plantilla con la calculada por su fila', () => {
    const r = repartirErrores(
      [
        { ruta: 'asientos[0].lineas[1].cuenta', mensaje: 'No existe.', fila: 2 },
        { ruta: 'asientos[0].lineas[0].cuenta', mensaje: 'No admite apuntes.' },
      ],
      asientos,
    )
    expect(r.porLinea.get(claveDeLinea(0, 2))).toEqual(['No existe.'])
    expect(r.porLinea.get(claveDeLinea(0, 0))).toEqual(['No admite apuntes.'])
  })

  it('lleva al asiento el error de una línea que no ha salido', () => {
    const r = repartirErrores([{ ruta: 'asientos[0].lineas[2].debe', mensaje: 'Raro.' }], asientos)
    expect(r.porAsiento.get(0)).toEqual(['Raro.'])
  })

  it('reversión, cuadre y lo que no tiene sitio', () => {
    const r = repartirErrores(
      [
        { ruta: 'asientos[0]', mensaje: 'El asiento no cuadra.' },
        { ruta: 'opciones.reversion.fecha', mensaje: 'Ejercicio cerrado.' },
        { ruta: 'opciones.autocuadre.cuenta', mensaje: 'Cuenta de mayor.' },
        { ruta: 'variables.cuota', mensaje: 'División por cero.' },
        { ruta: 'general', mensaje: 'Plantilla retirada.' },
      ],
      asientos,
    )
    expect(r.porAsiento.get(0)).toEqual(['El asiento no cuadra.'])
    expect(r.porAsiento.get(1)).toEqual(['Ejercicio cerrado.'])
    expect(r.porLinea.get(claveDeLinea(0, 3))).toEqual(['Cuenta de mayor.'])
    expect(r.generales).toEqual(['División por cero.', 'Plantilla retirada.'])
  })

  it('sin asientos calculados, todo lo del asiento va arriba', () => {
    const r = repartirErrores([{ ruta: 'asientos[0].lineas[0].cuenta', mensaje: 'X.' }], [])
    expect(r.generales).toEqual(['X.'])
  })
})
