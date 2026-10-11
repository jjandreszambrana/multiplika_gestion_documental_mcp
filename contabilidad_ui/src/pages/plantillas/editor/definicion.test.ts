import { describe, expect, it } from 'vitest'
import type { Definicion } from '../../../api/plantillas'
import { definicionParaEnviar, dondeEsta, mover } from './definicion'

const definicion: Definicion = {
  diario: 'GEN',
  parametros: [
    { clave: 'fecha_op', tipo: 'fecha', etiqueta: 'Fecha', defecto: 'hoy()', obligatorio: true },
    {
      clave: 'obra',
      tipo: 'seleccion',
      etiqueta: '',
      origen: 'obras',
      // Lo que trae /obtener: no se manda.
      opciones: [{ valor: 3, etiqueta: 'Nave' }],
      visible_si: '',
      filtro: '681*',
    },
    {
      clave: 'detalle',
      tipo: 'tabla',
      columnas: [{ clave: 'base', tipo: 'importe', visible_si: 'True', defecto: '' }],
      filas_minimas: 1,
    },
  ],
  variables: [{ clave: 'cuota', expr: 'redondear(valor * pct / 100)' }],
  asientos: [
    {
      fecha: 'fecha_op',
      concepto: '',
      lineas: [
        { cuenta: "'6810001'", debe: 'cuota', haber: '', si: '' },
        { cuenta: '', debe: '', haber: 'cuota' },
      ],
    },
  ],
  opciones: { autocuadre: null, reversion: { fecha: 'fin_de_mes(asiento_fecha)', concepto: '' } },
}

describe('definicionParaEnviar', () => {
  it('quita lo vacío y lo que no pinta en cada tipo', () => {
    expect(definicionParaEnviar(definicion)).toEqual({
      diario: 'GEN',
      parametros: [
        { clave: 'fecha_op', tipo: 'fecha', etiqueta: 'Fecha', obligatorio: true, defecto: 'hoy()' },
        { clave: 'obra', tipo: 'seleccion', origen: 'obras' },
        {
          clave: 'detalle',
          tipo: 'tabla',
          columnas: [{ clave: 'base', tipo: 'importe' }],
          filas_minimas: 1,
        },
      ],
      variables: [{ clave: 'cuota', expr: 'redondear(valor * pct / 100)' }],
      asientos: [
        {
          fecha: 'fecha_op',
          lineas: [
            { cuenta: "'6810001'", debe: 'cuota' },
            { cuenta: '', haber: 'cuota' },
          ],
        },
      ],
      opciones: { estado_inicial: 'borrador', reversion: { fecha: 'fin_de_mes(asiento_fecha)' } },
    })
  })
})

describe('dondeEsta', () => {
  it('dice el sitio con las palabras de la pantalla', () => {
    expect(dondeEsta('parametros[0].defecto', definicion)).toBe('Dato «fecha_op» › Valor por defecto')
    expect(dondeEsta('parametros[2].columnas[0].clave', definicion)).toBe(
      'Dato «detalle» › Columna «base» › Clave',
    )
    expect(dondeEsta('asientos[0].lineas[1].cuenta', definicion)).toBe('Asiento 1 › Línea 2 › Cuenta')
    expect(dondeEsta('opciones.reversion.fecha', definicion)).toBe(
      'Asiento que deshace al principal › Fecha',
    )
    expect(dondeEsta('variables[0].expr', definicion)).toBe('Cálculo «cuota» › Fórmula')
    expect(dondeEsta('general', definicion)).toBe('La plantilla')
  })
})

describe('mover', () => {
  it('sube y baja sin salirse', () => {
    expect(mover(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(mover(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  })
})
