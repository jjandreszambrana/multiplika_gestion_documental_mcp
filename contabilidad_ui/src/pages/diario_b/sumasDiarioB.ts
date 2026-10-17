import Decimal from 'decimal.js'
import type { EquivalenciaCuenta, LineaDiarioB } from '../../api/diarioB'

export interface SumaDeCuenta {
  cuenta: string
  titulo: string
  debe: Decimal
  haber: Decimal
  deudor: Decimal
  acreedor: Decimal
}

export interface SumasDiarioB {
  cuentas: SumaDeCuenta[]
  total: Omit<SumaDeCuenta, 'cuenta' | 'titulo'>
}

const CERO = new Decimal(0)

/**
 * Sumas y saldos del diario B, cuenta a cuenta. El SIF no tiene este informe
 * para el diario B, así que se suman aquí las líneas que ha devuelto.
 *
 * Con `equivalencias`, la línea cuya cuenta sea exactamente una cuenta de
 * origen se suma en su cuenta de destino. `tituloDelPlan` da el título cuando
 * la equivalencia no lo trae; si no se conoce, queda vacío.
 *
 * Las cuentas sin debe ni haber no salen. Los totales son los de todas las
 * líneas, así que cuadran con el diario.
 */
export function sumarDiarioB(
  lineas: LineaDiarioB[],
  equivalencias: EquivalenciaCuenta[] | null,
  tituloDelPlan: (cuenta: string) => string | null | undefined,
): SumasDiarioB {
  const destinoDe = new Map((equivalencias ?? []).map((e) => [e.cuenta_origen, e]))
  const porCuenta = new Map<string, { titulo: string; debe: Decimal; haber: Decimal }>()

  for (const linea of lineas) {
    const equivalencia = destinoDe.get(linea.cuenta)
    const cuenta = equivalencia?.cuenta_destino ?? linea.cuenta
    let suma = porCuenta.get(cuenta)
    if (!suma) {
      const titulo = equivalencia?.titulo_destino || tituloDelPlan(cuenta) || ''
      suma = { titulo, debe: CERO, haber: CERO }
      porCuenta.set(cuenta, suma)
    }
    suma.debe = suma.debe.plus(linea.debe)
    suma.haber = suma.haber.plus(linea.haber)
  }

  const cuentas = [...porCuenta.entries()]
    .filter(([, s]) => !s.debe.isZero() || !s.haber.isZero())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cuenta, s]) => {
      const saldo = s.debe.minus(s.haber)
      return {
        cuenta,
        titulo: s.titulo,
        debe: s.debe,
        haber: s.haber,
        deudor: saldo.isPositive() && !saldo.isZero() ? saldo : CERO,
        acreedor: saldo.isNegative() && !saldo.isZero() ? saldo.negated() : CERO,
      }
    })

  const total = cuentas.reduce(
    (t, c) => ({
      debe: t.debe.plus(c.debe),
      haber: t.haber.plus(c.haber),
      deudor: t.deudor.plus(c.deudor),
      acreedor: t.acreedor.plus(c.acreedor),
    }),
    { debe: CERO, haber: CERO, deudor: CERO, acreedor: CERO },
  )

  return { cuentas, total }
}
