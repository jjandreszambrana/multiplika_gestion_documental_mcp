import { pedir } from './cliente'
import type { components } from './types'

/**
 * Conexiones de la empresa con otro programa (hoy, Codiplika), de donde la
 * bandeja trae facturas, cobros y pagos. Viven fuera de contabilidad
 * (`/maestros/conexiones_externas/`). Las crean, prueban, cambian o quitan el
 * superadministrador, los administradores y el usuario de la propia empresa.
 */

type S = components['schemas']

export type Conexion = S['ConexionExterna']
export type ResultadoPrueba = S['RespuestaProbarConexionExterna']
export type Tunel = S['TunelConexionExterna']
export type Tuneles = S['RespuestaTunelesConexionExterna']

/** Al crear, la empresa la pone el proxy de la GD: es la que se está viendo. */
export type DatosNueva = Omit<S['ModeloCrearConexionExterna'], 'id_obligado'>
export type Cambios = Omit<S['ModeloEditarConexionExterna'], 'id'>

const BASE = '/maestros/conexiones_externas'

/** Por dónde puede salir este servidor del SIF hacia otros programas. */
export function listarTuneles(): Promise<Tuneles> {
  return pedir<Tuneles>(`${BASE}/tuneles`)
}

export async function listarConexiones(idObligado: number): Promise<Conexion[]> {
  const { conexiones = [] } = await pedir<S['RespuestaListarConexionesExternas']>(`${BASE}/listar`, {
    id_obligado: idObligado,
  })
  return conexiones
}

export function crearConexion(idObligado: number, datos: DatosNueva): Promise<Conexion> {
  return pedir<Conexion>(`${BASE}/crear`, { ...datos, id_obligado: idObligado })
}

export function editarConexion(id: number, cambios: Cambios): Promise<Conexion> {
  return pedir<Conexion>(`${BASE}/editar`, { ...cambios, id })
}

export function probarConexion(id: number): Promise<ResultadoPrueba> {
  return pedir<ResultadoPrueba>(`${BASE}/probar`, { id })
}

export async function eliminarConexion(id: number): Promise<void> {
  await pedir(`${BASE}/eliminar`, { id })
}
