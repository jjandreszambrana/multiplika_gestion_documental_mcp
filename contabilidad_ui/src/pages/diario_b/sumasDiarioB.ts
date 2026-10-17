import Decimal from 'decimal.js'
import type { EquivalenciaCuenta, LineaDiarioB } from '../../api/diarioB'
import type { NivelDeBalance } from '../../api/informes'

export interface SumaDeCuenta {
  cuenta: string
  titulo: string
  /** Debe menos haber de la apertura y de lo anterior a «desde». Con signo. */
  inicial: Decimal
  /** Del periodo, sin la apertura. */
  debe: Decimal
  haber: Decimal
  /** Apertura y anterior más el periodo, en bruto. */
  acumDebe: Decimal
  acumHaber: Decimal
  deudor: Decimal
  acreedor: Decimal
}

export type ImportesDiarioB = Omit<SumaDeCuenta, 'cuenta' | 'titulo'>

export interface SumasDiarioB {
  cuentas: SumaDeCuenta[]
  total: ImportesDiarioB
}

export interface OpcionesSumasDiarioB {
  /** Nulo: sin aplicar equivalencias. */
  equivalencias: EquivalenciaCuenta[] | null
  tituloDelPlan: (cuenta: string) => string | null | undefined
  nivel: NivelDeBalance
  /** aaaa-mm-dd; vacías, el ejercicio entero. */
  desde: string
  hasta: string
  /** Descarta las líneas de regularización y de cierre. */
  sinRegularizacion: boolean
}

const CERO = new Decimal(0)

/** Las marcas del campo `diario`, comparadas sin mayúsculas ni espacios. */
function marcaDe(linea: LineaDiarioB): string {
  return (linea.diario ?? '').replace(/\s/g, '').toUpperCase()
}

/**
 * Sumas y saldos del diario B, con el formato del Excel del cliente. El SIF no
 * tiene este informe para el diario B, así que se suman aquí las líneas del
 * ejercicio entero, que hacen falta para el saldo inicial.
 *
 * - Saldo inicial: las líneas APERTURA y las de fecha anterior a `desde`.
 * - Periodo: entre `desde` y `hasta`, sin las APERTURA. Con alguna fecha puesta,
 *   una línea sin fecha no se puede situar y no entra.
 * - Acumulados: inicial más periodo, debe y haber por separado; de ahí salen
 *   los saldos deudor y acreedor.
 *
 * Con `equivalencias`, la línea cuya cuenta sea exactamente una cuenta de
 * origen se suma en su destino. Con `nivel` 1, 2 o 3 se junta después por los
 * primeros dígitos, y el título es el del plan para ese código. Por subcuenta,
 * una cuenta más corta que las demás (la apertura, la regularización y el
 * cierre vienen en cuentas de 4 cifras, p. ej. 1130) se completa con ceros
 * hasta subcuenta (11300000), para que solo salgan subcuentas. Las cuentas sin
 * importes no salen; los totales son los de todas las líneas que entran.
 */
export function sumarDiarioB(lineas: LineaDiarioB[], opciones: OpcionesSumasDiarioB): SumasDiarioB {
  const { equivalencias, tituloDelPlan, nivel, desde, hasta, sinRegularizacion } = opciones
  const destinoDe = new Map((equivalencias ?? []).map((e) => [e.cuenta_origen, e]))
  const conFechas = desde !== '' || hasta !== ''
  const largoSubcuenta = Math.max(0, ...lineas.map((l) => l.cuenta.trim().length))
  const porCuenta = new Map<
    string,
    { titulo: string; iniDebe: Decimal; iniHaber: Decimal; debe: Decimal; haber: Decimal }
  >()

  for (const linea of lineas) {
    const marca = marcaDe(linea)
    if (sinRegularizacion && (marca === 'REGULARIZA' || marca === 'CIERRE')) continue

    const fecha = (linea.fecha ?? '').slice(0, 10)
    let inicial: boolean
    if (marca === 'APERTURA') inicial = true
    else if (conFechas && fecha === '') continue
    else if (desde !== '' && fecha < desde) inicial = true
    else if (hasta !== '' && fecha > hasta) continue
    else inicial = false

    const original = linea.cuenta.trim()
    const completa = original.padEnd(largoSubcuenta, '0')
    const equivalencia = destinoDe.get(original) ?? destinoDe.get(completa)
    const destino = (equivalencia?.cuenta_destino ?? original).padEnd(largoSubcuenta, '0')
    const cuenta = nivel === 0 ? destino : destino.slice(0, nivel)
    let suma = porCuenta.get(cuenta)
    if (!suma) {
      const titulo =
        (nivel === 0 && equivalencia?.titulo_destino) || tituloDelPlan(cuenta) || ''
      suma = { titulo, iniDebe: CERO, iniHaber: CERO, debe: CERO, haber: CERO }
      porCuenta.set(cuenta, suma)
    }
    if (inicial) {
      suma.iniDebe = suma.iniDebe.plus(linea.debe)
      suma.iniHaber = suma.iniHaber.plus(linea.haber)
    } else {
      suma.debe = suma.debe.plus(linea.debe)
      suma.haber = suma.haber.plus(linea.haber)
    }
  }

  const cuentas: SumaDeCuenta[] = [...porCuenta.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cuenta, s]) => {
      const acumDebe = s.iniDebe.plus(s.debe)
      const acumHaber = s.iniHaber.plus(s.haber)
      const saldo = acumDebe.minus(acumHaber)
      return {
        cuenta,
        titulo: s.titulo,
        inicial: s.iniDebe.minus(s.iniHaber),
        debe: s.debe,
        haber: s.haber,
        acumDebe,
        acumHaber,
        deudor: saldo.isPositive() && !saldo.isZero() ? saldo : CERO,
        acreedor: saldo.isNegative() && !saldo.isZero() ? saldo.negated() : CERO,
      }
    })
    .filter((c) => !c.acumDebe.isZero() || !c.acumHaber.isZero())

  const total = cuentas.reduce<ImportesDiarioB>(
    (t, c) => ({
      inicial: t.inicial.plus(c.inicial),
      debe: t.debe.plus(c.debe),
      haber: t.haber.plus(c.haber),
      acumDebe: t.acumDebe.plus(c.acumDebe),
      acumHaber: t.acumHaber.plus(c.acumHaber),
      deudor: t.deudor.plus(c.deudor),
      acreedor: t.acreedor.plus(c.acreedor),
    }),
    {
      inicial: CERO,
      debe: CERO,
      haber: CERO,
      acumDebe: CERO,
      acumHaber: CERO,
      deudor: CERO,
      acreedor: CERO,
    },
  )

  return { cuentas, total }
}
