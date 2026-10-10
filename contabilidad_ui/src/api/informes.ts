import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { camposDelFiltro, type FiltroApuntes } from './asientos'
import { descargar, pedir, type Descarga } from './cliente'
import type { components } from './types'

/**
 * Informes de consulta. Nivel `consulta`: todo es de solo lectura.
 *
 * Los importes salen de aquí como `Decimal`, y **el saldo lo calcula la API**:
 * aquí no se suma ninguna columna para obtenerlo.
 */

/**
 * Un movimiento del mayor, con el saldo corriente ya calculado.
 *
 * `id_borrador` es el del borrador del que viene cuando `es_borrador` es cierto,
 * y **cero** cuando el apunte ya está en el libro: la columna vuelve a cero al
 * confirmar el asiento.
 */
export interface ApunteMayor
  extends Omit<components['schemas']['ApunteMayor'], 'debe' | 'haber' | 'saldo'> {
  debe: Decimal
  haber: Decimal
  /** Saldo de la cuenta después de este apunte. */
  saldo: Decimal
}

export interface Mayor {
  cuenta: string
  apuntes: ApunteMayor[]
  /** Movimientos del periodo entero, sin paginar. */
  total: number
  /** Lo que arrastraba la cuenta antes del primer apunte de esta página. */
  saldo_anterior: Decimal
  /**
   * El del periodo entero, no el de la página. **Cuenta los borradores** si se
   * han pedido: es el saldo de lo que se está viendo.
   */
  saldo: Decimal
  /** El mismo, pero contando solo lo que está en el libro. */
  saldo_firme: Decimal
  /** Cuántos de los apuntes del periodo son borradores. Cero = todo firme. */
  apuntes_en_borrador: number
}

export interface FiltroMayor {
  ejercicio: number
  cuenta: string
  /** Vacías, el ejercicio entero. */
  desde: string
  hasta: string
  incluirBorradores: boolean
  offset: number
  limit: number
}

/** Lo que la API admite de una vez. Más de esto lo rechaza con un 422. */
const TOPE_POR_LLAMADA = 1000

/** Los movimientos de una cuenta, en orden y con su saldo corriente. */
export async function mayorDeCuenta(filtro: FiltroMayor, senal?: AbortSignal): Promise<Mayor> {
  const salida = await pedir<components['schemas']['RespuestaMayor']>(
    '/contabilidad/informes/mayor',
    {
      ejercicio: filtro.ejercicio,
      cuenta: filtro.cuenta,
      ...(filtro.desde === '' ? {} : { desde: filtro.desde }),
      ...(filtro.hasta === '' ? {} : { hasta: filtro.hasta }),
      incluir_borradores: filtro.incluirBorradores,
      offset: filtro.offset,
      limit: filtro.limit,
    },
    senal,
  )

  return {
    cuenta: salida.cuenta,
    apuntes: (salida.apuntes ?? []).map((fila) => ({
      ...fila,
      debe: aDecimal(fila.debe),
      haber: aDecimal(fila.haber),
      saldo: aDecimal(fila.saldo),
    })),
    total: salida.total,
    saldo_anterior: aDecimal(salida.saldo_anterior),
    saldo: aDecimal(salida.saldo),
    saldo_firme: aDecimal(salida.saldo_firme),
    apuntes_en_borrador: salida.apuntes_en_borrador,
  }
}

/**
 * Una fila del balance: un epígrafe, o una cuenta que cuelga de él cuando se
 * pide el detalle.
 *
 * `nivel` y `agrupa` los da la API desde el 01/09/2026, así que **la sangría y
 * la negrita no se calculan aquí**: se pintan con lo que llega.
 */
export interface EpigrafeBalance
  extends Omit<components['schemas']['EpigrafeBalance'], 'saldo'> {
  saldo: Decimal
}

export interface BalanceDeSituacion {
  ejercicio: number
  tipo_pgc: string
  activo: EpigrafeBalance[]
  total_activo: Decimal
  pasivo: EpigrafeBalance[]
  total_pasivo: Decimal
  /** Ingresos menos gastos. Positivo es beneficio. */
  resultado_del_ejercicio: Decimal
}

/**
 * Hasta dónde baja el informe. Añadido por el backend el 01/09/2026.
 *
 * `epigrafes` es lo que se imprime; los otros dos cuelgan de cada epígrafe las
 * cuentas que lo componen. **Las cuentas sin saldo no salen**, lo decide la API.
 */
export type Detalle = 'epigrafes' | 'cuentas' | 'subcuentas'

export interface FiltroDeCorte {
  ejercicio: number
  /** Fecha de corte. Vacía, el ejercicio entero. */
  hasta: string
  incluirBorradores: boolean
  detalle: Detalle
}

function cuerpoDelCorte(filtro: FiltroDeCorte) {
  return {
    ejercicio: filtro.ejercicio,
    ...(filtro.hasta === '' ? {} : { hasta: filtro.hasta }),
    incluir_borradores: filtro.incluirBorradores,
    detalle: filtro.detalle,
  }
}

function aEpigrafes(lista: components['schemas']['EpigrafeBalance'][] | undefined) {
  return (lista ?? []).map((fila) => ({ ...fila, saldo: aDecimal(fila.saldo) }))
}

/**
 * El balance de situación. Nivel `consulta`.
 *
 * **Viene ya en positivo**: el pasivo y el patrimonio neto llegan con el signo
 * dado la vuelta por la API, que es como se imprime un balance. Aquí no se
 * cambia ningún signo.
 *
 * Cuadra con una **resta**: `total_activo - total_pasivo` es el resultado del
 * ejercicio, y mientras no se cierre los dos totales no son iguales. Eso no es
 * un error: el beneficio sigue repartido entre gastos e ingresos, que no forman
 * parte del balance.
 */
export async function balanceDeSituacion(
  filtro: FiltroDeCorte,
  senal?: AbortSignal,
): Promise<BalanceDeSituacion> {
  const salida = await pedir<components['schemas']['RespuestaBalance']>(
    '/contabilidad/informes/balance',
    cuerpoDelCorte(filtro),
    senal,
  )
  return {
    ejercicio: salida.ejercicio,
    tipo_pgc: salida.tipo_pgc,
    activo: aEpigrafes(salida.activo),
    total_activo: aDecimal(salida.total_activo),
    pasivo: aEpigrafes(salida.pasivo),
    total_pasivo: aDecimal(salida.total_pasivo),
    resultado_del_ejercicio: aDecimal(salida.resultado_del_ejercicio),
  }
}

/**
 * Los dos estados contables en Excel, en un fichero de **dos hojas**: el balance
 * y pérdidas y ganancias. Quien lo manda a la gestoría manda los dos, y en una
 * sola hoja no se leen porque no comparten columnas.
 *
 * Es una sola descarga para las dos pestañas de la pantalla: el informe se pide
 * como `balance` porque así se llama en la API, aunque traiga los dos.
 */
export function estadosContablesEnExcel(filtro: FiltroDeCorte): Promise<Descarga> {
  return descargar('/contabilidad/informes/excel', {
    informe: 'balance',
    ...cuerpoDelCorte(filtro),
  })
}

export interface PerdidasYGanancias {
  ejercicio: number
  tipo_pgc: string
  epigrafes: EpigrafeBalance[]
  /** Ingresos menos gastos. Positivo es beneficio. */
  resultado: Decimal
}

/**
 * La cuenta de pérdidas y ganancias, a fecha de corte. Nivel `consulta`.
 *
 * Misma forma que el balance y **también en positivo**: la API le da la vuelta
 * al signo de los ingresos al componer el informe. Aquí no se cambia ninguno ni
 * se suma nada; `resultado` lo da ella.
 *
 * No tiene Excel propio: el de `balance` ya trae las dos hojas.
 */
export async function perdidasYGanancias(
  filtro: FiltroDeCorte,
  senal?: AbortSignal,
): Promise<PerdidasYGanancias> {
  const salida = await pedir<components['schemas']['RespuestaPerdidasYGanancias']>(
    '/contabilidad/informes/perdidas_y_ganancias',
    cuerpoDelCorte(filtro),
    senal,
  )
  return {
    ejercicio: salida.ejercicio,
    tipo_pgc: salida.tipo_pgc,
    epigrafes: aEpigrafes(salida.epigrafes),
    resultado: aDecimal(salida.resultado),
  }
}

/**
 * Los dos estados contables en PDF, en **un solo documento**: el balance y
 * pérdidas y ganancias, cada uno empezando en su página y con su cabecera.
 *
 * El papel lo escribe entero la API —empresa, NIF, ejercicio, fecha de corte,
 * si cuentan los borradores, el detalle, la paginación—, igual que el Excel.
 *
 * `informe` va como `balance`, que es como se llama allí aunque traiga los dos.
 * Hoy es el único que `/informes/pdf` acepta; si se pide otro, la API contesta
 * con un 400 que dice cuáles hay.
 */
export function estadosContablesEnPdf(filtro: FiltroDeCorte): Promise<Descarga> {
  return descargar('/contabilidad/informes/pdf', {
    informe: 'balance',
    ...cuerpoDelCorte(filtro),
  })
}

/** Una línea del balance: una cuenta, o un grupo de ellas según el nivel. */
export interface LineaSumasYSaldos
  extends Omit<
    components['schemas']['LineaSumasYSaldos'],
    'saldo_anterior' | 'debe' | 'haber' | 'saldo'
  > {
  /** Lo que la cuenta traía al empezar el periodo. Cero si no se acotó. */
  saldo_anterior: Decimal
  debe: Decimal
  haber: Decimal
  /** Debe menos haber. Positivo es deudor; negativo, acreedor. */
  saldo: Decimal
}

export interface SumasYSaldos {
  lineas: LineaSumasYSaldos[]
  total_debe: Decimal
  total_haber: Decimal
}

/** Por cuántos dígitos se agrupa. Sin agrupar es cuenta a cuenta. */
export type NivelDeBalance = 0 | 1 | 2 | 3

export interface FiltroSumasYSaldos {
  ejercicio: number
  nivel: NivelDeBalance
  /** Vacíos, todo el plan. El rango va sobre el código **ya agrupado**. */
  cuentaDesde: string
  cuentaHasta: string
  /** Vacías, el ejercicio entero. */
  desde: string
  hasta: string
  incluirBorradores: boolean
}

function cuerpoDelBalance(filtro: FiltroSumasYSaldos) {
  return {
    ejercicio: filtro.ejercicio,
    nivel: filtro.nivel,
    ...(filtro.cuentaDesde === '' ? {} : { cuenta_desde: filtro.cuentaDesde }),
    ...(filtro.cuentaHasta === '' ? {} : { cuenta_hasta: filtro.cuentaHasta }),
    ...(filtro.desde === '' ? {} : { desde: filtro.desde }),
    ...(filtro.hasta === '' ? {} : { hasta: filtro.hasta }),
    incluir_borradores: filtro.incluirBorradores,
  }
}

/**
 * El balance de sumas y saldos. Nivel `consulta`.
 *
 * **El debe y el haber son los del periodo pedido**, no acumulados: lo que cada
 * cuenta traía al empezar va aparte, en `saldo_anterior`. Sin acotar fechas el
 * periodo es el ejercicio, así que no hay nada antes y viene a cero.
 *
 * `descripcion` la pone la API. Aquí no se puede componer: una línea agrupada
 * por dos dígitos no es ninguna de las cuentas del plan que hay en memoria.
 */
export async function sumasYSaldos(
  filtro: FiltroSumasYSaldos,
  senal?: AbortSignal,
): Promise<SumasYSaldos> {
  const salida = await pedir<components['schemas']['RespuestaSumasYSaldos']>(
    '/contabilidad/informes/sumas_y_saldos',
    cuerpoDelBalance(filtro),
    senal,
  )
  return {
    lineas: (salida.lineas ?? []).map((fila) => ({
      ...fila,
      saldo_anterior: aDecimal(fila.saldo_anterior),
      debe: aDecimal(fila.debe),
      haber: aDecimal(fila.haber),
      saldo: aDecimal(fila.saldo),
    })),
    total_debe: aDecimal(salida.total_debe),
    total_haber: aDecimal(salida.total_haber),
  }
}

/** El balance en Excel, con los mismos parámetros que se están viendo. */
export function balanceEnExcel(filtro: FiltroSumasYSaldos): Promise<Descarga> {
  return descargar('/contabilidad/informes/excel', {
    informe: 'sumas_y_saldos',
    ...cuerpoDelBalance(filtro),
  })
}

/**
 * El mayor entero, sin paginar: **en contabilidad la paginación estorba**. Un
 * mayor se recorre de arriba abajo buscando un apunte, y tener que ir pasando
 * páginas rompe justo eso.
 *
 * La API tope a mil apuntes por llamada, así que se piden en tandas hasta
 * juntar los que dice `total`. Los saldos vienen ya del periodo entero, así que
 * los de la primera tanda valen para todo.
 */
export async function mayorEntero(
  filtro: Omit<FiltroMayor, 'offset' | 'limit'>,
  senal?: AbortSignal,
): Promise<Mayor> {
  const primera = await mayorDeCuenta(
    { ...filtro, offset: 0, limit: TOPE_POR_LLAMADA },
    senal,
  )

  const apuntes = [...primera.apuntes]
  // `total` son los del periodo entero, no los de la tanda: mientras falten, se
  // sigue pidiendo. El corte por longitud evita dar vueltas si la API devolviera
  // menos de lo que dice.
  while (apuntes.length < primera.total) {
    const siguiente = await mayorDeCuenta(
      { ...filtro, offset: apuntes.length, limit: TOPE_POR_LLAMADA },
      senal,
    )
    if (siguiente.apuntes.length === 0) break
    apuntes.push(...siguiente.apuntes)
  }

  return { ...primera, apuntes }
}

/**
 * El informe en un fichero de Excel. Nivel `consulta`. Es un solo camino para
 * todos: se dice cuál en `informe` y se mandan sus parámetros de siempre.
 *
 * No pagina, así que el fichero lleva el periodo entero. Por encima de cien mil
 * apuntes la API pide que se acote en vez de tragar memoria, y ese texto se
 * enseña tal cual.
 */
export function mayorEnExcel(
  filtro: Omit<FiltroMayor, 'offset' | 'limit'>,
): Promise<Descarga> {
  return descargar('/contabilidad/informes/excel', {
    informe: 'mayor',
    ejercicio: filtro.ejercicio,
    cuenta: filtro.cuenta,
    ...(filtro.desde === '' ? {} : { desde: filtro.desde }),
    ...(filtro.hasta === '' ? {} : { hasta: filtro.hasta }),
    incluir_borradores: filtro.incluirBorradores,
  })
}

/**
 * El libro diario en un fichero de Excel. Nivel `consulta`.
 *
 * Se le mandan **los mismos filtros que a la consulta que llena la pantalla**,
 * así que lo que se baja es lo que se está viendo. Sin eso, quien tuviera el
 * diario filtrado por una cuenta se llevaría el ejercicio entero sin enterarse.
 *
 * `incluir` viaja con sus tres valores y no se traduce a un booleano: «solo
 * borradores» es un caso real —repasar lo que queda por confirmar antes de
 * cerrar el mes— y se perdería.
 */
export function diarioEnExcel(
  filtro: Omit<FiltroApuntes, 'offset' | 'limit'>,
): Promise<Descarga> {
  const { id_borrador: _sinBorrador, ...campos } = camposDelFiltro(filtro)
  return descargar('/contabilidad/informes/excel', {
    informe: 'libro_diario',
    ...campos,
    ejercicio: filtro.ejercicio ?? new Date().getFullYear(),
  })
}
