import type Decimal from 'decimal.js'
import { aDecimal } from '../lib/dinero'
import { pedir } from './cliente'
import type { components } from './types'

/**
 * Bienes de inmovilizado: lo que la empresa compra para usarlo durante años y
 * se va llevando a gasto poco a poco.
 *
 * Los importes llegan de la API como número y salen de aquí como `Decimal`:
 * ningún componente recibe un importe sin normalizar. Los cinco totales que
 * acompañan a cada bien los calcula el backend, no esta capa.
 */

type BienApi = components['schemas']['Bien']
type FichaApi = components['schemas']['FichaDeBien']

/** Lo que la API guarda de un bien, con los importes ya en `Decimal`. */
export interface Bien
  extends Omit<
    BienApi,
    | 'valor_adquisicion'
    | 'valor_residual'
    | 'amortizado'
    | 'valor_neto'
    | 'pendiente_de_amortizar'
    | 'dotacion_anual'
    | 'amortizado_inicial'
    | 'amortizado_regularizado'
    | 'valor_con_mejoras'
    | 'amortizado_con_mejoras'
    | 'valor_neto_con_mejoras'
    | 'mejoras'
  > {
  /** Borrador de un cambio de cuentas sin confirmar. 0 o ausente: ninguno. */
  traslado_pendiente?: number
  /** Color con el que se destaca en la lista: 0 = ninguno, 1 a 10 = uno de los fijos. */
  color?: number
  valor_adquisicion: Decimal
  valor_residual: Decimal
  /**
   * Lo ya amortizado al entrar en este programa, para el bien que viene de otra
   * contabilidad. No corresponde a ninguna dotación de aquí y no hizo asiento.
   */
  amortizado_inicial: Decimal
  /** Lo de arranque más lo contabilizado aquí en dotaciones. */
  amortizado: Decimal
  /** El ajuste acumulado por correcciones de valor, con su signo. */
  amortizado_regularizado: Decimal
  /** Lo que costó menos lo amortizado: lo que sigue en los libros. */
  valor_neto: Decimal
  /** Lo que queda por llevar a gasto, ya descontado el valor residual. */
  pendiente_de_amortizar: Decimal
  /** Cuota de un año entero al ritmo de hoy. El último año será menor. */
  dotacion_anual: Decimal
  /**
   * Las mejoras que cuelgan de este bien. **No salen como filas sueltas del
   * listado**: cuelgan de aquí. La cadena tiene dos niveles, así que una mejora
   * nunca trae mejoras propias.
   */
  mejoras: Bien[]
  /** El bien más sus mejoras. Es el número del inventario. */
  valor_con_mejoras: Decimal
  amortizado_con_mejoras: Decimal
  valor_neto_con_mejoras: Decimal
}

/** Una dotación ya contabilizada. `asiento` lleva al apunte en el diario. */
export interface LineaDeAmortizacion
  extends Omit<components['schemas']['LineaDeAmortizacion'], 'importe'> {
  importe: Decimal
}

/**
 * Un ajuste por haber corregido el valor. **No es una dotación** y por eso va
 * aparte del cuadro: cada fila del cuadro es un asiento que se hizo de verdad y
 * sigue contando lo que pasó.
 */
export interface CorreccionDeAmortizacion
  extends Omit<components['schemas']['CorreccionDeAmortizacion'], 'debe' | 'haber'> {
  debe: Decimal
  haber: Decimal
}

/** La ficha: los datos del listado, el cuadro y los ajustes de valor. */
export interface FichaDeBien extends Bien {
  amortizaciones: LineaDeAmortizacion[]
  correcciones: CorreccionDeAmortizacion[]
}

function aBien(fila: BienApi): Bien {
  return {
    ...fila,
    valor_adquisicion: aDecimal(fila.valor_adquisicion),
    valor_residual: aDecimal(fila.valor_residual),
    amortizado_inicial: aDecimal(fila.amortizado_inicial),
    amortizado: aDecimal(fila.amortizado),
    amortizado_regularizado: aDecimal(fila.amortizado_regularizado),
    valor_neto: aDecimal(fila.valor_neto),
    pendiente_de_amortizar: aDecimal(fila.pendiente_de_amortizar),
    dotacion_anual: aDecimal(fila.dotacion_anual),
    mejoras: (fila.mejoras ?? []).map(aBien),
    valor_con_mejoras: aDecimal(fila.valor_con_mejoras),
    amortizado_con_mejoras: aDecimal(fila.amortizado_con_mejoras),
    valor_neto_con_mejoras: aDecimal(fila.valor_neto_con_mejoras),
  }
}

export interface ListadoDeBienes {
  bienes: Bien[]
  cuantos: number
}

/**
 * Los bienes de la empresa. Nivel `consulta`. Con `soloActivos` en falso vienen
 * también los dados de baja, que se quedan en la tabla con `estado = 0`: un
 * bien no se borra nunca.
 */
export async function listarBienes(
  soloActivos: boolean,
  senal?: AbortSignal,
): Promise<ListadoDeBienes> {
  const respuesta = await pedir<components['schemas']['RespuestaListarBienes']>(
    '/contabilidad/inmovilizado/listar',
    { solo_activos: soloActivos },
    senal,
  )
  return { bienes: (respuesta.bienes ?? []).map(aBien), cuantos: respuesta.cuantos }
}

/** La ficha de un bien con su cuadro de amortización. Nivel `consulta`. */
export async function obtenerBien(idInmovilizado: number): Promise<FichaDeBien> {
  const ficha = await pedir<FichaApi>('/contabilidad/inmovilizado/obtener', {
    id_inmovilizado: idInmovilizado,
  })
  return aFicha(ficha)
}

function aFicha(ficha: FichaApi): FichaDeBien {
  return {
    ...aBien(ficha),
    amortizaciones: (ficha.amortizaciones ?? []).map((linea) => ({
      ...linea,
      importe: aDecimal(linea.importe),
    })),
    correcciones: (ficha.correcciones ?? []).map((linea) => ({
      ...linea,
      debe: aDecimal(linea.debe),
      haber: aDecimal(linea.haber),
    })),
  }
}

/**
 * Alta de un bien. Nivel `apuntes`. **No hace ningún asiento**: solo apunta el
 * bien para que entre en las dotaciones. Los importes van como cadena.
 */
export function altaDeBien(
  datos: components['schemas']['ModeloAlta'],
): Promise<components['schemas']['RespuestaAlta']> {
  return pedir<components['schemas']['RespuestaAlta']>('/contabilidad/inmovilizado/alta', datos)
}

/**
 * Corrige la ficha. Nivel `apuntes`. En cuanto el bien tiene amortizaciones
 * hechas hay cuatro campos que la API rechaza con un 400 que dice cuál y por
 * qué: el valor, la fecha de inicio y las cuentas del activo y de amortización.
 * La pantalla los bloquea antes, para no dejar teclear algo que se va a perder.
 */
export async function editarBien(
  datos: components['schemas']['ModeloEditarBien'],
): Promise<FichaDeBien> {
  return aFicha(await pedir<FichaApi>('/contabilidad/inmovilizado/editar', datos))
}

/**
 * Saca el bien de la lista de los que se amortizan. Nivel `apuntes`. **No toca
 * los libros**: es para el bien que se dio de alta por error. Un bien nunca se
 * borra; queda con `estado = 0` y su fecha de baja.
 */
export function dejarDeAmortizar(
  idInmovilizado: number,
  fechaBaja: string,
): Promise<components['schemas']['RespuestaBaja']> {
  return pedir<components['schemas']['RespuestaBaja']>('/contabilidad/inmovilizado/baja', {
    id_inmovilizado: idInmovilizado,
    fecha_baja: fechaBaja,
  })
}

/** Cómo queda una baja con asiento, con los importes ya en `Decimal`. */
export interface ResultadoDeBaja
  extends Omit<
    components['schemas']['RespuestaBajaConAsiento'],
    | 'valor_adquisicion'
    | 'amortizado'
    | 'valor_neto'
    | 'importe_venta'
    | 'resultado'
    | 'se_dan_de_baja'
  > {
  valor_adquisicion: Decimal
  amortizado: Decimal
  valor_neto: Decimal
  importe_venta: Decimal
  resultado: Decimal
  /** Todo lo que sale de los libros: el bien y sus mejoras. Al simular ya viene. */
  se_dan_de_baja: PiezaDadaDeBaja[]
}

/** Una ficha que sale de los libros en la baja: el bien, o una de sus mejoras. */
export interface PiezaDadaDeBaja
  extends Omit<
    components['schemas']['PiezaDadaDeBaja'],
    'valor_adquisicion' | 'amortizado' | 'valor_neto'
  > {
  valor_adquisicion: Decimal
  amortizado: Decimal
  valor_neto: Decimal
}

/**
 * Vende o tira el bien y lo saca de los libros. Nivel `apuntes`. Con `simular`
 * en cierto no escribe nada y devuelve cómo quedaría, con el resultado ya
 * calculado: es lo que la pantalla enseña antes de que nadie acepte.
 *
 * El IVA no va en este asiento: la venta se factura aparte.
 */
export async function bajaConAsiento(
  datos: components['schemas']['ModeloBajaConAsiento'],
): Promise<ResultadoDeBaja> {
  const salida = await pedir<components['schemas']['RespuestaBajaConAsiento']>(
    '/contabilidad/inmovilizado/baja_con_asiento',
    datos,
  )
  return {
    ...salida,
    valor_adquisicion: aDecimal(salida.valor_adquisicion),
    amortizado: aDecimal(salida.amortizado),
    valor_neto: aDecimal(salida.valor_neto),
    importe_venta: aDecimal(salida.importe_venta),
    resultado: aDecimal(salida.resultado),
    se_dan_de_baja: (salida.se_dan_de_baja ?? []).map((pieza) => ({
      ...pieza,
      valor_adquisicion: aDecimal(pieza.valor_adquisicion),
      amortizado: aDecimal(pieza.amortizado),
      valor_neto: aDecimal(pieza.valor_neto),
    })),
  }
}

/** Un bien (o mejora) dentro de un cambio de cuentas. Los importes son los de la fecha del asiento. */
export interface BienCambiado {
  id_inmovilizado: number
  descripcion: string
  es_mejora: boolean
  /** Distinto de 0: no se pidió, va con ese bien por estar en su misma cuenta. */
  con_su_bien: number
  valor_adquisicion: Decimal
  amortizado: Decimal
  cuenta_activo: string
  cuenta_amortizacion: string
  cuenta_gasto: string
  nueva_cuenta_activo: string
  nueva_cuenta_amortizacion: string
  nueva_cuenta_gasto: string
  dotaciones_posteriores: { ejercicio: number; periodo: string; importe: number; cuenta: string }[]
  /** False: no hay saldo que mover y su ficha cambia en el acto. */
  con_asiento: boolean
}

export interface LineaDeTraslado {
  cuenta: string
  debe: Decimal
  haber: Decimal
  concepto: string
  id_inmovilizado: number
}

export interface ResultadoDeCambiarCuentas {
  simulado: boolean
  solo_fichas: boolean
  fecha: string
  ejercicio: number
  /** Borrador creado. 0 si no hace falta asiento o se simuló. */
  id_borrador: number
  asiento: number
  bienes: BienCambiado[]
  lineas: LineaDeTraslado[]
  total_debe: Decimal
  total_haber: Decimal
  fichas_cambiadas: number[]
  avisos: string[]
}

export interface PeticionCambiarCuentas {
  ids: number[]
  cuenta_activo: string
  cuenta_amortizacion: string
  cuenta_gasto: string
  /** AAAA-MM-DD. */
  fecha: string
  simular: boolean
  solo_fichas: boolean
}

/**
 * Cambia las cuentas de uno o varios bienes. Nivel `apuntes`. Con `simular`
 * no escribe nada y devuelve el asiento propuesto. Sin él, deja el asiento en
 * **borrador**: las fichas cambian cuando el contable lo confirma en el diario.
 * Con `solo_fichas` cambia las fichas en el acto, sin asiento.
 *
 * Es la única vía para cambiar la cuenta del activo o de la amortización de un
 * bien que ya tiene dotaciones.
 */
export async function cambiarCuentas(
  datos: PeticionCambiarCuentas,
): Promise<ResultadoDeCambiarCuentas> {
  const { ids, ...resto } = datos
  const salida = await pedir<
    Omit<
      ResultadoDeCambiarCuentas,
      'total_debe' | 'total_haber' | 'lineas' | 'bienes'
    > & {
      total_debe: number
      total_haber: number
      lineas: (Omit<LineaDeTraslado, 'debe' | 'haber'> & { debe: number; haber: number })[]
      bienes: (Omit<BienCambiado, 'valor_adquisicion' | 'amortizado'> & {
        valor_adquisicion: number
        amortizado: number
      })[]
    }
  >('/contabilidad/inmovilizado/cambiar_cuentas', {
    bienes: ids.map((id) => ({ id_inmovilizado: id })),
    ...resto,
  })
  return {
    ...salida,
    total_debe: aDecimal(salida.total_debe),
    total_haber: aDecimal(salida.total_haber),
    lineas: salida.lineas.map((l) => ({ ...l, debe: aDecimal(l.debe), haber: aDecimal(l.haber) })),
    bienes: salida.bienes.map((b) => ({
      ...b,
      valor_adquisicion: aDecimal(b.valor_adquisicion),
      amortizado: aDecimal(b.amortizado),
    })),
  }
}

/** Un bien dentro de la dotación de un mes, con su cuota. */
export interface BienDotado extends Omit<components['schemas']['BienDotado'], 'importe'> {
  importe: Decimal
}

/** Cómo queda la dotación de un mes. `total` y las cuotas las calcula la API. */
export interface ResultadoDeDotar
  extends Omit<components['schemas']['RespuestaDotar'], 'total' | 'detalle'> {
  total: Decimal
  detalle: BienDotado[]
  saltados_detalle: components['schemas']['BienSaltado'][]
}

/**
 * Dota la amortización de un mes. Nivel `apuntes`. Un único asiento con todos
 * los bienes. Con `simular` en cierto no escribe nada y devuelve el desglose,
 * que es lo que se enseña antes de aceptar.
 *
 * `saltados` cuenta **todos los que no entran**, no solo los ya dotados: cada
 * uno trae su motivo en `saltados_detalle`.
 */
export async function dotarAmortizacion(
  ejercicio: number,
  periodo: string,
  simular: boolean,
): Promise<ResultadoDeDotar> {
  const salida = await pedir<components['schemas']['RespuestaDotar']>(
    '/contabilidad/inmovilizado/dotar',
    { ejercicio, periodo, simular },
  )
  return {
    ...salida,
    total: aDecimal(salida.total),
    detalle: (salida.detalle ?? []).map((bien) => ({ ...bien, importe: aDecimal(bien.importe) })),
    saltados_detalle: salida.saltados_detalle ?? [],
  }
}

export type TablaDeAmortizacion = components['schemas']['RespuestaTablaAmortizacion']
export type ElementoAmortizable = components['schemas']['ElementoAmortizable']

/**
 * La tabla del artículo 12.1.a) de la Ley del Impuesto sobre Sociedades, para
 * proponer el porcentaje por tipo de bien. Nivel `consulta`.
 *
 * `advertencia` viene escrita para enseñarla tal cual. Los coeficientes son un
 * **máximo fiscal**, y la tabla es fiscal y no contable: amortizar distinto no
 * es un error, así que aquí se avisa pero no se impide.
 */
export function tablaDeAmortizacion(): Promise<TablaDeAmortizacion> {
  return pedir<TablaDeAmortizacion>('/contabilidad/inmovilizado/tabla_amortizacion')
}

/** Un apunte al debe de una cuenta de inmovilizado que todavía no tiene ficha. */
export interface ApuntePideFicha
  extends Omit<components['schemas']['ApuntePideFicha'], 'importe'> {
  importe: Decimal
}

export interface ApuntesSinFicha {
  apuntes: ApuntePideFicha[]
  cuantos: number
  /** La que decide qué es inmovilizado. La fija la configuración, no el código. */
  cuenta_mayor_de_inmovilizado: string
}

/**
 * Lo que entró al debe de una cuenta de inmovilizado y no tiene ficha de bien.
 * Nivel `consulta`. Sin ficha no se amortiza nunca, y nadie se entera.
 *
 * Sirve para tres cosas con la misma llamada: el aviso justo después de
 * confirmar un asiento a mano (con `asiento`), lo que queda de un mes (con
 * `ejercicio` y `periodo`) y el repaso de todo lo que entró antes de que el
 * camino desde la factura existiera (sin filtros).
 *
 * No salen los ya resueltos ni los que tienen ficha creada desde su factura.
 */
export async function apuntesSinFicha(
  filtro: components['schemas']['ModeloApuntesSinFicha'] = {},
  senal?: AbortSignal,
): Promise<ApuntesSinFicha> {
  const salida = await pedir<components['schemas']['RespuestaApuntesSinFicha']>(
    '/contabilidad/inmovilizado/apuntes_sin_ficha',
    filtro,
    senal,
  )
  return {
    apuntes: (salida.apuntes ?? []).map((fila) => ({ ...fila, importe: aDecimal(fila.importe) })),
    cuantos: salida.cuantos,
    cuenta_mayor_de_inmovilizado: salida.cuenta_mayor_de_inmovilizado,
  }
}

/**
 * La ficha del bien y el asiento de la factura, de una vez. Nivel `apuntes`.
 *
 * `respuesta` es `bien`, `mejora` —con `id_bien_padre`— o `no_es_bien`, que no
 * crea nada y **no vuelve a preguntar por esa factura**. En los tres casos se
 * contabiliza después esa factura, y solo esa: arreglar una no debe hacer los
 * asientos de las demás.
 *
 * El valor sale de la base de la factura, sin IVA, salvo que se imponga otro.
 */
export function fichaDesdeFactura(
  datos: components['schemas']['ModeloDesdeFactura'],
): Promise<components['schemas']['RespuestaDesdeFactura']> {
  return pedir<components['schemas']['RespuestaDesdeFactura']>(
    '/contabilidad/inmovilizado/desde_factura',
    datos,
  )
}

/**
 * Deja constancia de que un apunte ya se miró, para que el aviso no vuelva a
 * salir. Nivel `apuntes`. Es lo que se usa desde un asiento manual, donde no
 * hay factura: la ficha se crea con `/alta` y aquí se dice cuál, o que no era
 * un bien y por qué.
 */
export function marcarRevisado(
  datos: components['schemas']['ModeloMarcarRevisado'],
): Promise<components['schemas']['RespuestaMarcarRevisado']> {
  return pedir<components['schemas']['RespuestaMarcarRevisado']>(
    '/contabilidad/inmovilizado/marcar_revisado',
    datos,
  )
}

/** Cómo queda una corrección de valor, con los importes en `Decimal`. */
export interface ResultadoDeCorregir
  extends Omit<
    components['schemas']['RespuestaCorregirValor'],
    | 'valor_anterior'
    | 'valor_adquisicion'
    | 'amortizado_en_los_libros'
    | 'amortizado_correcto'
    | 'diferencia'
  > {
  valor_anterior: Decimal
  valor_adquisicion: Decimal
  /** Lo que se dotó de verdad, con el valor equivocado. */
  amortizado_en_los_libros: Decimal
  /** Lo que se habría dotado con el valor bueno. */
  amortizado_correcto: Decimal
  diferencia: Decimal
}

/**
 * Corrige un valor mal tecleado. Nivel `apuntes`.
 *
 * **No es lo mismo que `/editar`**, que sigue sin dejar cambiar el valor con
 * dotaciones hechas: allí lo dotado está bien y no hay nada que deshacer. Aquí
 * está mal, así que además de cambiar la ficha hace **un asiento** por la
 * diferencia entre lo dotado y lo que tocaba.
 *
 * No toca el cuadro de amortización —cada fila es un asiento que se hizo— ni la
 * cuenta del activo. Con `simular` dice cuánto se dotó de más sin escribir nada.
 */
export async function corregirValor(
  datos: components['schemas']['ModeloCorregirValor'],
): Promise<ResultadoDeCorregir> {
  const salida = await pedir<components['schemas']['RespuestaCorregirValor']>(
    '/contabilidad/inmovilizado/corregir_valor',
    datos,
  )
  return {
    ...salida,
    valor_anterior: aDecimal(salida.valor_anterior),
    valor_adquisicion: aDecimal(salida.valor_adquisicion),
    amortizado_en_los_libros: aDecimal(salida.amortizado_en_los_libros),
    amortizado_correcto: aDecimal(salida.amortizado_correcto),
    diferencia: aDecimal(salida.diferencia),
  }
}
