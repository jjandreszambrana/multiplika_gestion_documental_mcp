import type Decimal from 'decimal.js'
import { aDecimal, type ImporteApi } from '../lib/dinero'
import { pedir } from './cliente'
import { ErrorApi } from './errores'

/*
 * Diario B y equivalencias de cuentas ([5.31], apartado 17 septies de la guía).
 *
 * Tipos escritos a mano a propósito: hoy solo existen en sif.icomase.com y
 * `types.ts` se genera del OpenAPI de facturae, que aún no los tiene. Copiados
 * de `LineaDiarioB`, `ModeloDatosDiarioB` y `RespuestaListarDiarioEquivalencias`
 * del OpenAPI de Icomase. Cuando lleguen a facturae, se regeneran y se cambian
 * por los de `types.ts`.
 */

interface LineaDiarioBApi {
  pase: number
  ejercicio: number
  asiento: number
  fecha: string | null
  cuenta: string
  debe: ImporteApi
  haber: ImporteApi
  concepto: string | null
  documento: string | null
  diario: string | null
  contabilizado: number
}

/** Una línea del diario B con los importes ya normalizados. */
export interface LineaDiarioB extends Omit<LineaDiarioBApi, 'debe' | 'haber'> {
  debe: Decimal
  haber: Decimal
}

/** Lo que se teclea en el formulario. Importes como cadena con punto. */
export interface DatosLineaB {
  ejercicio?: number
  asiento?: number
  fecha?: string
  cuenta?: string
  debe?: string
  haber?: string
  concepto?: string
  documento?: string
  diario?: string
  contabilizado?: number
}

export interface FiltroDiarioB {
  ejercicio: number | null
  asiento: number | null
  cuenta: string
  fecha_desde: string
  fecha_hasta: string
  /** 1 = del libro, 0 = borradores, nulo = todas. */
  contabilizado: number | null
  offset: number
  limit: number
}

const RUTA_B = '/contabilidad/diario_b'

function normalizar(linea: LineaDiarioBApi): LineaDiarioB {
  return { ...linea, debe: aDecimal(linea.debe), haber: aDecimal(linea.haber) }
}

export async function listarDiarioB(
  filtro: FiltroDiarioB,
  senal?: AbortSignal,
): Promise<{ total: number; lineas: LineaDiarioB[] }> {
  const { total, lineas } = await pedir<{ total: number; lineas: LineaDiarioBApi[] }>(
    `${RUTA_B}/listar`,
    {
      ...(filtro.ejercicio !== null && { ejercicio: filtro.ejercicio }),
      ...(filtro.asiento !== null && { asiento: filtro.asiento }),
      ...(filtro.cuenta !== '' && { cuenta: filtro.cuenta }),
      ...(filtro.fecha_desde !== '' && { fecha_desde: filtro.fecha_desde }),
      ...(filtro.fecha_hasta !== '' && { fecha_hasta: filtro.fecha_hasta }),
      ...(filtro.contabilizado !== null && { contabilizado: filtro.contabilizado }),
      offset: filtro.offset,
      limit: filtro.limit,
    },
    senal,
  )
  return { total, lineas: lineas.map(normalizar) }
}

/** Tope de líneas por llamada que admite el SIF en los dos listados. */
const TOPE_POR_LLAMADA = 1000

/**
 * Todas las líneas que cumplen el filtro, pidiendo en tandas de mil hasta
 * juntar el `total` que da el propio SIF. El corte por tanda vacía evita dar
 * vueltas si devolviera menos de lo que dice.
 */
export async function diarioBEntero(
  filtro: Omit<FiltroDiarioB, 'offset' | 'limit'>,
  senal?: AbortSignal,
): Promise<LineaDiarioB[]> {
  const primera = await listarDiarioB({ ...filtro, offset: 0, limit: TOPE_POR_LLAMADA }, senal)
  const lineas = [...primera.lineas]
  while (lineas.length < primera.total) {
    const siguiente = await listarDiarioB(
      { ...filtro, offset: lineas.length, limit: TOPE_POR_LLAMADA },
      senal,
    )
    if (siguiente.lineas.length === 0) break
    lineas.push(...siguiente.lineas)
  }
  return lineas
}

/**
 * Si este SIF tiene el diario B. Solo Icomase lo tiene: en el resto la ruta no
 * existe (404) y el menú no lo enseña. Cualquier otro fallo lo deja a la
 * vista: la pantalla dirá qué pasa.
 */
export async function hayDiarioB(): Promise<boolean> {
  try {
    await pedir(`${RUTA_B}/listar`, { limit: 1 })
    return true
  } catch (fallo) {
    return !(fallo instanceof ErrorApi && fallo.estado === 404)
  }
}

export async function crearLineaB(datos: DatosLineaB): Promise<LineaDiarioB> {
  return normalizar(await pedir<LineaDiarioBApi>(`${RUTA_B}/crear`, datos))
}

/** Solo los campos que cambian. */
export async function editarLineaB(pase: number, cambios: DatosLineaB): Promise<LineaDiarioB> {
  return normalizar(await pedir<LineaDiarioBApi>(`${RUTA_B}/editar`, { pase, ...cambios }))
}

export async function eliminarLineaB(pase: number): Promise<void> {
  await pedir(`${RUTA_B}/eliminar`, { pase })
}

/**
 * Cuenta de origen → cuenta de destino. No es el cambio de plan contable de
 * `/contabilidad/equivalencias`: son las de cada empresa.
 */
export interface EquivalenciaCuenta {
  id: number
  cuenta_origen: string
  titulo_origen: string | null
  cuenta_destino: string
  titulo_destino: string | null
  observaciones: string | null
}

export type DatosEquivalencia = Partial<Omit<EquivalenciaCuenta, 'id'>>

const RUTA_EQ = '/contabilidad/diario_equivalencias'

export function listarEquivalenciasCuenta(
  texto: string,
  offset: number,
  limit: number,
  senal?: AbortSignal,
): Promise<{ total: number; equivalencias: EquivalenciaCuenta[] }> {
  return pedir(
    `${RUTA_EQ}/listar`,
    { ...(texto !== '' && { texto }), offset, limit },
    senal,
  )
}

/** Todas las equivalencias de la empresa, en tandas de mil. */
export async function equivalenciasEnteras(senal?: AbortSignal): Promise<EquivalenciaCuenta[]> {
  const primera = await listarEquivalenciasCuenta('', 0, TOPE_POR_LLAMADA, senal)
  const todas = [...primera.equivalencias]
  while (todas.length < primera.total) {
    const siguiente = await listarEquivalenciasCuenta('', todas.length, TOPE_POR_LLAMADA, senal)
    if (siguiente.equivalencias.length === 0) break
    todas.push(...siguiente.equivalencias)
  }
  return todas
}

export function crearEquivalenciaCuenta(datos: DatosEquivalencia): Promise<EquivalenciaCuenta> {
  return pedir(`${RUTA_EQ}/crear`, datos)
}

export function editarEquivalenciaCuenta(
  id: number,
  cambios: DatosEquivalencia,
): Promise<EquivalenciaCuenta> {
  return pedir(`${RUTA_EQ}/editar`, { id, ...cambios })
}

export async function eliminarEquivalenciaCuenta(id: number): Promise<void> {
  await pedir(`${RUTA_EQ}/eliminar`, { id })
}
