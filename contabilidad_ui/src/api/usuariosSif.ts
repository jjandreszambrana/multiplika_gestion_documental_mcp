import { pedir } from './cliente'
import type { Nivel } from './sesion'

/**
 * Usuarios del SIF, solo para su superadministrador y solo dentro de la GD:
 * el proxy de la GD atiende `/superadmin/...`, comprueba que la clave con la
 * que se entra es de rol 1 y no impone la empresa de la pantalla. Fuera de la
 * GD estas rutas no existen.
 */

const BASE = '/superadmin'

export interface UsuarioSif {
  id: number
  nombre_real: string
  usuario: string
  email: string
  id_rol: number
  id_obligado: number | null
  id_representante: number | null
  id_administrador: number | null
  id_estado: number
  fecha_alta?: string | null
  NombreRazon_obligado?: string | null
  NombreRazon_representante?: string | null
  NombreRazon_administrador?: string | null
}

export interface Entidad {
  id: number
  NombreRazon?: string | null
  NIF?: string | null
}

export interface Perfil {
  id: number
  nombre?: string | null
}

export interface Operario {
  id: number
  id_usuario: number | null
  id_perfil: number
}

export interface AccesoContable {
  id_obligado: number
  empresa: string
  nivel: Nivel
}

export type DatosUsuario = Partial<Omit<UsuarioSif, 'id'>> & { password?: string }

interface Lista<T> {
  registros?: T[]
}

export async function listarUsuarios(): Promise<UsuarioSif[]> {
  const { registros = [] } = await pedir<Lista<UsuarioSif>>(`${BASE}/usuarios/listar`, { limit: 40000 })
  return registros
}

export function crearUsuario(datos: DatosUsuario): Promise<{ id: number }> {
  return pedir(`${BASE}/usuarios/crear`, datos)
}

export function modificarUsuario(id: number, cambios: DatosUsuario): Promise<unknown> {
  return pedir(`${BASE}/usuarios/modificar`, { id, ...cambios })
}

export type TipoEntidad = 'empresas' | 'asesorias' | 'administradores'

export async function listarEntidades(tipo: TipoEntidad): Promise<Entidad[]> {
  const { registros = [] } = await pedir<Lista<Entidad>>(`${BASE}/${tipo}`, { limit: 5000 })
  return registros
}

export async function listarPerfiles(idObligado: number): Promise<Perfil[]> {
  const { registros = [] } = await pedir<Lista<Perfil>>(`${BASE}/perfiles`, { id_obligado: idObligado, limit: 500 })
  return registros
}

/** La ficha de operario de un usuario, si la tiene. */
export async function operarioDe(idObligado: number, idUsuario: number): Promise<Operario | null> {
  const { registros = [] } = await pedir<Lista<Operario>>(`${BASE}/operarios/listar`, {
    id_obligado: idObligado,
    limit: 40000,
  })
  return registros.find((o) => o.id_usuario === idUsuario) ?? null
}

/** Un operario sin su ficha entra pero no puede hacer nada: se crea o se cambia aquí. */
export function guardarPerfilOperario(
  idObligado: number,
  usuario: { id: number; nombre_real: string; email: string },
  idPerfil: number,
  actual: Operario | null,
): Promise<unknown> {
  if (actual) {
    return pedir(`${BASE}/operarios/actualizar`, { id: actual.id, id_obligado: idObligado, id_perfil: idPerfil })
  }
  return pedir(`${BASE}/operarios/crear`, {
    id_obligado: idObligado,
    id_perfil: idPerfil,
    nombre: usuario.nombre_real,
    email: usuario.email,
    tiene_acceso: 1,
    id_usuario: usuario.id,
  })
}

export async function accesosDe(idUsuario: number): Promise<AccesoContable[]> {
  const { accesos = [] } = await pedir<{ accesos?: AccesoContable[] }>(`${BASE}/accesos/usuario`, {
    id_usuario: idUsuario,
  })
  return accesos
}

export function concederAcceso(idObligado: number, idUsuario: number, nivel: Nivel): Promise<unknown> {
  return pedir(`${BASE}/accesos/conceder`, { id_obligado: idObligado, id_usuario: idUsuario, nivel })
}

export function revocarAcceso(idObligado: number, idUsuario: number): Promise<unknown> {
  return pedir(`${BASE}/accesos/revocar`, { id_obligado: idObligado, id_usuario: idUsuario })
}
