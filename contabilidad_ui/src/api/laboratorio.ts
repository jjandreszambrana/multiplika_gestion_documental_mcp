import {
  descargar as descargarBase,
  pedir as pedirBase,
  type ConfiguracionCliente,
  type Descarga,
} from './cliente'
import { ErrorApi } from './errores'

/*
 * Módulo de laboratorio ([5.53], [5.54]; guía en
 * multiplika_compartida/contabilidad/contexto/api_laboratorio_para_frontend.md).
 *
 * Tipos escritos a mano a propósito: hoy solo existe en los SIF de Adimel y
 * `types.ts` se genera del OpenAPI de facturae, que aún no los trae. Cuando
 * se regenere con ellos, se cambian por los de `types.ts`.
 *
 * Los importes y límites pueden llegar como texto o como número según la
 * ruta: se tratan siempre con `Number()` donde se usan.
 */

const RAIZ = '/laboratorio'

/**
 * El laboratorio va por su propia conexión al SIF (otro proxy de la GD, con su
 * empresa), no por la de contabilidad: las dos pueden estar abiertas a la vez
 * y la configuración global del cliente es una sola.
 */
let conexion: ConfiguracionCliente | undefined

export function configurarLaboratorio(cfg: ConfiguracionCliente): void {
  conexion = cfg
}

const pedir = <T>(ruta: string, cuerpo: object = {}, senal?: AbortSignal) =>
  pedirBase<T>(ruta, cuerpo, senal, conexion)
const descargar = (ruta: string, cuerpo: object = {}) => descargarBase(ruta, cuerpo, undefined, conexion)

/** Tope de filas por llamada que admiten los listados. */
export const MAXIMO_FILAS = 1000

/** Códigos de estado de serie (no el id): el que deja la muestra a la vista del cliente. */
export const CODIGO_ENTREGADO = 3

// ---------- Activación ----------

/** `no`: la empresa no tiene el laboratorio. `sin_activar`: lo tiene pero no está en marcha. */
export type EstadoLaboratorio = 'no' | 'sin_activar' | 'activo'

/**
 * Se pregunta al SIF en vez de fiarse de la sesión: el 403 (no está
 * habilitado) y el 404 (este SIF no lo trae) dicen lo mismo, que no se enseña.
 */
export async function estadoLaboratorio(): Promise<EstadoLaboratorio> {
  try {
    const { activo } = await pedir<{ activo: boolean }>(`${RAIZ}/configuracion/obtener`)
    return activo ? 'activo' : 'sin_activar'
  } catch (fallo) {
    if (fallo instanceof ErrorApi) return 'no'
    throw fallo
  }
}

export async function activarLaboratorio(): Promise<void> {
  await pedir(`${RAIZ}/configuracion/activar`)
}

// ---------- Muestras ----------

export interface ResumenMuestra {
  id: number
  numero_entrada: number
  id_receptor: number | null
  cliente_nombre: string | null
  fecha_toma: string | null
  fecha_informe: string | null
  referencia: string | null
  punto_toma: string | null
  id_estado: number
  estado: string
  /** Color de fondo de la fila (hexadecimal) y código del estado. */
  color_estado?: string | null
  codigo_estado?: number
  importe_neto: number | string | null
  id_borrador: number | null
  id_factura: number | null
  oculto: number
}

export type Valoracion = 'cumple' | 'no_cumple' | 'sin_valorar'

export interface LineaResultado {
  id: number
  id_muestra: number
  id_parametro: number | null
  orden: number | null
  grupo: string | null
  parametro: string
  resultado: string | null
  unidad: string | null
  metodo: string | null
  limite: string | null
  marca: string | null
  valoracion: Valoracion | null
  id_laboratorio_externo: number | null
  fecha_envio_lab: string | null
  fecha_recepcion_lab: string | null
}

export interface CambioDeEstado {
  id_estado: number
  estado: string
  id_usuario: number | null
  fecha: string
}

export interface Informe {
  id: number
  id_muestra: number
  version: number
  fecha_emision: string
  id_usuario: number | null
  anulado: number
  motivo_anulacion: string | null
  huella: string | null
  tamano: number | null
}

/** Lo que se puede dar de alta o editar de una muestra, sin las líneas. */
export interface DatosMuestra {
  id_receptor?: number | null
  /** Cliente escrito a mano; solo vale si no hay `id_receptor`. */
  cliente_nif?: string | null
  cliente_nombre?: string | null
  cliente_direccion?: string | null
  cliente_localidad?: string | null
  cliente_codigo_postal?: string | null
  cliente_provincia?: string | null
  fecha_toma?: string | null
  fecha_entrada?: string | null
  fecha_prevista?: string | null
  fecha_informe?: string | null
  referencia?: string | null
  punto_toma?: string | null
  normativa?: string | null
  observaciones?: string | null
  descripcion_servicio?: string | null
  id_laboratorio_externo?: number | null
  codigo_analisis_externo?: string | null
  id_tarifa?: number | null
  /** Línea de muestreo de un contrato: rellena sola el cliente y el servicio. */
  id_linea_contrato?: number | null
  importe_neto?: number | null
  oculto?: number
}

export interface Muestra extends ResumenMuestra, Omit<DatosMuestra, keyof ResumenMuestra> {
  lineas: LineaResultado[]
  estados: CambioDeEstado[]
  informes: Informe[]
}

export interface FiltroMuestras {
  id_receptor?: number
  id_estado?: number
  oculto?: number
  texto?: string
  desde?: string
  hasta?: string
  limite: number
  desplazamiento: number
}

export async function listarMuestras(
  filtro: FiltroMuestras,
  senal?: AbortSignal,
): Promise<{ registros: ResumenMuestra[]; total: number }> {
  return pedir(`${RAIZ}/muestras/listar`, filtro, senal)
}

export const obtenerMuestra = (id: number) => pedir<Muestra>(`${RAIZ}/muestras/obtener`, { id })

export const crearMuestra = (datos: DatosMuestra) => pedir<Muestra>(`${RAIZ}/muestras/crear`, datos)

export const editarMuestra = (id: number, datos: DatosMuestra) =>
  pedir<Muestra>(`${RAIZ}/muestras/editar`, { id, ...datos })

export const eliminarMuestra = (id: number) => pedir(`${RAIZ}/muestras/eliminar`, { id })

export const cambiarEstado = (id: number, codigo_estado: number) =>
  pedir<Muestra>(`${RAIZ}/muestras/cambiar_estado`, { id, codigo_estado })

// ---------- Líneas de resultado ----------

export interface DatosLinea {
  id_parametro?: number | null
  grupo?: string | null
  parametro?: string | null
  resultado?: string | null
  unidad?: string | null
  metodo?: string | null
  limite?: string | null
  marca?: string | null
}

/** Las tres devuelven la muestra completa, con las líneas ya valoradas. */
export const crearLinea = (id_muestra: number, datos: DatosLinea) =>
  pedir<Muestra>(`${RAIZ}/muestras/lineas/crear`, { id_muestra, ...datos })

export const editarLinea = (id: number, datos: DatosLinea) =>
  pedir<Muestra>(`${RAIZ}/muestras/lineas/editar`, { id, ...datos })

export const eliminarLinea = (id: number) => pedir(`${RAIZ}/muestras/lineas/eliminar`, { id })

// ---------- Informes ----------

export const emitirInforme = (id_muestra: number) =>
  pedir<Informe>(`${RAIZ}/informes/emitir`, { id_muestra })

export const anularInforme = (id: number, motivo: string) =>
  pedir<Informe>(`${RAIZ}/informes/anular`, { id, motivo })

export const descargarInforme = (id: number): Promise<Descarga> =>
  descargar(`${RAIZ}/informes/descargar`, { id })

/** El informe que vale: el único sin anular. */
export const informeVigente = (m: Muestra): Informe | undefined =>
  m.informes.find((i) => !i.anulado)

// ---------- Facturación ----------

export interface MuestraPorFacturar {
  id: number
  numero_entrada: number
  id_receptor: number
  cliente_nombre: string | null
  referencia: string | null
  fecha_informe: string | null
  importe_neto: number | string | null
  id_tarifa: number
}

export async function muestrasPorFacturar(id_receptor?: number): Promise<MuestraPorFacturar[]> {
  const { registros } = await pedir<{ registros: MuestraPorFacturar[] }>(
    `${RAIZ}/facturacion/pendientes`,
    id_receptor ? { id_receptor } : {},
  )
  return registros
}

export const crearBorrador = (ids_muestras: number[], id_serie: number) =>
  pedir<{ id_borrador: number; muestras: number; importe_neto: number | string }>(
    `${RAIZ}/facturacion/crear_borrador`,
    { ids_muestras, id_serie },
  )

// ---------- Contratos y plan de muestreo (guía, apartado 7 bis) ----------

export interface ResumenContrato {
  id: number
  id_receptor: number | null
  cliente_nombre: string | null
  cliente_nif: string | null
  descripcion: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  importe: number | string | null
  id_serie: number | null
  estado: 'activo' | 'inactivo'
  lineas_facturacion: number
  lineas_muestreo: number
}

export interface LineaContrato {
  id: number
  tipo: 'facturacion' | 'muestreo'
  meses: number[] | string
  descripcion: string | null
  activo: number
  importe?: number | string | null
  id_articulo?: number | null
  texto?: string | null
}

export interface FacturacionHecha {
  id_linea: number
  anio_mes: string
  importe: number | string | null
  id_borrador: number | null
  origen: 'sif' | 'historico'
  factura_antigua: string | null
}

export interface Contrato extends ResumenContrato {
  observaciones: string | null
  id_articulo: number | null
  lineas: LineaContrato[]
  facturaciones: FacturacionHecha[]
}

export async function listarContratos(filtro: { estado?: string; texto?: string; id_receptor?: number } = {}) {
  return pedir<{ registros: ResumenContrato[]; total: number }>(`${RAIZ}/contratos/listar`, {
    ...filtro,
    limite: MAXIMO_FILAS,
    desplazamiento: 0,
  })
}

export const obtenerContrato = (id: number) => pedir<Contrato>(`${RAIZ}/contratos/obtener`, { id })

/** Lo que se da de alta o se edita de un contrato; todo es opcional. */
export interface DatosContrato {
  id_receptor?: number | null
  cliente_nif?: string | null
  cliente_nombre?: string | null
  cliente_direccion?: string | null
  cliente_localidad?: string | null
  cliente_codigo_postal?: string | null
  cliente_provincia?: string | null
  descripcion?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  importe?: number | null
  id_serie?: number | null
  id_articulo?: number | null
  estado?: 'activo' | 'inactivo'
  observaciones?: string | null
}

export interface DatosLineaContrato {
  tipo?: 'facturacion' | 'muestreo'
  meses?: number[]
  descripcion?: string | null
  activo?: number
  importe?: number | null
  id_articulo?: number | null
  texto?: string | null
}

export const crearContrato = (datos: DatosContrato) => pedir<Contrato>(`${RAIZ}/contratos/crear`, datos)
export const editarContrato = (id: number, datos: DatosContrato) => pedir<Contrato>(`${RAIZ}/contratos/editar`, { id, ...datos })
export const eliminarContrato = (id: number) => pedir(`${RAIZ}/contratos/eliminar`, { id })
export const crearLineaContrato = (id_contrato: number, datos: DatosLineaContrato) =>
  pedir(`${RAIZ}/contratos/lineas/crear`, { id_contrato, ...datos })
export const editarLineaContrato = (id: number, datos: DatosLineaContrato) =>
  pedir(`${RAIZ}/contratos/lineas/editar`, { id, ...datos })
export const eliminarLineaContrato = (id: number) => pedir(`${RAIZ}/contratos/lineas/eliminar`, { id })

export interface ContratoAFacturar {
  id: number
  id_receptor: number | null
  cliente_nombre: string | null
  descripcion: string | null
  id_serie: number | null
  importe: number | string | null
  lineas: { id: number; descripcion: string | null; importe: number | string | null }[]
  puede_facturarse: boolean
  problemas: string[]
}

export async function contratosAFacturar(anio: number, mes: number): Promise<ContratoAFacturar[]> {
  const { registros } = await pedir<{ registros: ContratoAFacturar[] }>(`${RAIZ}/contratos/a_facturar`, { anio, mes })
  return registros
}

export interface ResultadoFacturarContratos {
  facturados: { id_contrato: number; cliente_nombre: string | null; ids_borradores: number[]; importe: number | string }[]
  errores: { id_contrato: number; motivo: string }[]
}

export const facturarContratos = (anio: number, mes: number, ids_contratos: number[], separar_lineas: boolean) =>
  pedir<ResultadoFacturarContratos>(`${RAIZ}/contratos/facturar`, { anio, mes, ids_contratos, separar_lineas })

export interface MuestreoDelMes {
  id_linea: number
  linea: string | null
  texto: string | null
  id_contrato: number
  cliente_nombre: string | null
  descripcion: string | null
  tomadas: number
  pendiente: boolean
}

export async function muestreoDelMes(anio: number, mes: number): Promise<MuestreoDelMes[]> {
  const { registros } = await pedir<{ registros: MuestreoDelMes[] }>(`${RAIZ}/contratos/muestreo_del_mes`, { anio, mes })
  return registros
}

/** Artículo con que se facturan los contratos que no traen uno propio. */
export async function articuloContratos(): Promise<string | null> {
  const r = await pedir<{ id_articulo_contratos?: number | null; configuracion?: { id_articulo_contratos?: number | null } | null }>(
    `${RAIZ}/configuracion/obtener`,
  )
  const id = r.configuracion?.id_articulo_contratos ?? r.id_articulo_contratos
  return id ? String(id) : null
}

export const fijarArticuloContratos = (id: number | null) =>
  pedir(`${RAIZ}/configuracion/actualizar`, { id_articulo_contratos: id })

// ---------- Usuarios del portal de clientes ----------

export interface UsuarioPortal {
  id: number
  id_receptor: number
  usuario: string
  nombre: string | null
  email: string | null
  activo: number
  debe_cambiar_clave: number
  bloqueado_hasta: string | null
  ultimo_acceso: string | null
  fecha_alta: string
}

/** Al crear o restablecer, la clave solo viene esta vez. */
export type UsuarioConClave = UsuarioPortal & { clave_temporal: string }

export async function listarUsuariosPortal(id_receptor?: number): Promise<UsuarioPortal[]> {
  const { registros } = await pedir<{ registros: UsuarioPortal[] }>(
    `${RAIZ}/portal_usuarios/listar`,
    id_receptor ? { id_receptor } : {},
  )
  return registros
}

export const crearUsuarioPortal = (datos: {
  id_receptor: number
  usuario: string
  nombre?: string
  email?: string
}) => pedir<UsuarioConClave>(`${RAIZ}/portal_usuarios/crear`, datos)

export const cambiarActivoUsuarioPortal = (id: number, activo: boolean) =>
  pedir(`${RAIZ}/portal_usuarios/editar`, { id, activo: activo ? 1 : 0 })

export const restablecerClavePortal = (id: number) =>
  pedir<UsuarioConClave>(`${RAIZ}/portal_usuarios/restablecer_clave`, { id })

export const eliminarUsuarioPortal = (id: number) => pedir(`${RAIZ}/portal_usuarios/eliminar`, { id })

// ---------- Catálogos ----------

/** Una fila de cualquier catálogo: siempre lleva `id`; el resto depende del catálogo. */
export type FilaCatalogo = { id: number } & Record<string, string | number | null>

export async function listarCatalogo(
  catalogo: string,
  filtros: Record<string, number> = {},
): Promise<FilaCatalogo[]> {
  const { registros } = await pedir<{ registros: FilaCatalogo[] }>(`${RAIZ}/${catalogo}/listar`, {
    limite: MAXIMO_FILAS,
    ...filtros,
  })
  return registros
}

export const crearEnCatalogo = (catalogo: string, datos: object) =>
  pedir(`${RAIZ}/${catalogo}/crear`, datos)

export const editarEnCatalogo = (catalogo: string, id: number, datos: object) =>
  pedir(`${RAIZ}/${catalogo}/editar`, { id, ...datos })

export const eliminarDeCatalogo = (catalogo: string, id: number) =>
  pedir(`${RAIZ}/${catalogo}/eliminar`, { id })

// ---------- Datos de otras partes del SIF ----------

export interface Opcion {
  value: string
  label: string
}

/** Los clientes de la empresa (receptores), para elegirlos por nombre. */
export async function listarClientes(): Promise<Opcion[]> {
  const { registros } = await pedir<{ registros: { id: number; NombreRazon: string; NIF?: string }[] }>(
    '/obligados/receptores/listar',
    { limit: MAXIMO_FILAS, orden: 'NombreRazon' },
  )
  return registros.map((c) => ({
    value: String(c.id),
    label: c.NIF ? `${c.NombreRazon} (${c.NIF})` : c.NombreRazon,
  }))
}

/** Series de factura normales (tipo 0): las que sirven para un albarán de venta. */
export async function listarSeries(): Promise<Opcion[]> {
  const { registros } = await pedir<{ registros: { id: number; serie: string; descripcion: string | null }[] }>(
    '/maestros/series/listar',
    { limit: MAXIMO_FILAS, id_tipo_serie: 0 },
  )
  return registros.map((s) => ({ value: String(s.id), label: s.descripcion ? `${s.serie} · ${s.descripcion}` : s.serie }))
}

export async function listarArticulos(): Promise<Opcion[]> {
  const { registros } = await pedir<{ registros: { id: number; codigo: string | null; descripcion: string }[] }>(
    '/maestros/articulos/listar',
    { limit: MAXIMO_FILAS },
  )
  return registros.map((a) => ({ value: String(a.id), label: a.codigo ? `${a.codigo} · ${a.descripcion}` : a.descripcion }))
}
