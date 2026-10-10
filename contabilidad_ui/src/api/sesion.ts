import { pedir } from './cliente'
import type { components } from './types'

/** Llamadas de sesión y de elección de empresa. */

export type Empresa = components['schemas']['ModeloEmpresa']
export type RespuestaEmpresas = components['schemas']['RespuestaEmpresas']
export type RespuestaConmutar = components['schemas']['RespuestaConmutar']

/** Los cuatro niveles, de menor a mayor. Deciden qué se pinta. */
export const NIVELES = ['consulta', 'apuntes', 'cierre', 'admin'] as const
export type Nivel = (typeof NIVELES)[number]

/**
 * Quién ha entrado. Sale de `/contabilidad/sesion/me`, que es `/usuarios/me`
 * con la respuesta declarada: los campos se generan, no se escriben a mano.
 * Casi todos son opcionales de verdad, porque dependen del rol.
 */
export type Usuario = components['schemas']['ModeloUsuarioSesion']

export function iniciarSesion(usuario: string, contrasena: string): Promise<unknown> {
  return pedir('/usuarios/login', { username: usuario, password: contrasena })
}

export async function cerrarSesion(): Promise<void> {
  await pedir('/usuarios/logout')
}

export async function usuarioActual(): Promise<Usuario> {
  const { user } = await pedir<components['schemas']['RespuestaMe']>('/contabilidad/sesion/me')
  return user
}

export function listarEmpresas(): Promise<RespuestaEmpresas> {
  return pedir<RespuestaEmpresas>('/contabilidad/sesion/empresas')
}

/** Abre la contabilidad de una empresa. La empresa activa vive en el token. */
export function conmutar(idObligado: number): Promise<RespuestaConmutar> {
  return pedir<RespuestaConmutar>('/contabilidad/sesion/conmutar', { id_obligado: idObligado })
}

export type Ejercicio = components['schemas']['Ejercicio']

export async function listarEjercicios(): Promise<Ejercicio[]> {
  const { ejercicios = [] } = await pedir<components['schemas']['RespuestaListarEjercicios']>(
    '/contabilidad/ejercicios/listar',
  )
  return ejercicios
}

/** Un ejercicio no admite apuntes si está cerrado, cerrándose o bloqueado. */
export function estaAbierto(ejercicio: Ejercicio): boolean {
  return !ejercicio.cerrado && !ejercicio.cerrando && !ejercicio.bloqueado
}

/** Texto del bloqueo, o nulo si el ejercicio admite apuntes. */
export function motivoBloqueo(ejercicio: Ejercicio): string | null {
  if (ejercicio.cerrado) return 'Cerrado'
  if (ejercicio.cerrando) return 'Cerrándose'
  if (ejercicio.bloqueado) return 'Bloqueado'
  return null
}

/**
 * Si el nivel llega desconocido se deniega: esconder de más es un incordio,
 * enseñar de más acaba en un 403 en la cara del usuario.
 */
export function alcanza(nivel: string, minimo: Nivel): boolean {
  const tiene = NIVELES.indexOf(nivel as Nivel)
  return tiene >= 0 && tiene >= NIVELES.indexOf(minimo)
}

/**
 * Quién ve la pantalla de activar contabilidad: superadministrador (1),
 * administrador (2) y asesoría (3), que son los que gestionan empresas
 * ajenas. Al obligado y al operario no se les ofrece: activar la contabilidad
 * de su propia empresa no es una operación suya.
 */
const ROLES_QUE_ACTIVAN = [1, 2, 3]

export function puedeActivarContabilidad(usuario: Usuario | null): boolean {
  return usuario !== null && usuario.id_rol != null && ROLES_QUE_ACTIVAN.includes(usuario.id_rol)
}
