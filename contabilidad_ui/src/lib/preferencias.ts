/**
 * Preferencias de disposición que se guardan en el equipo de quien las cambia:
 * qué columnas tiene encendidas en una tabla, y poco más.
 *
 * Van en `localStorage` con una clave por usuario, para que dos personas que
 * comparten ordenador no se pisen. No es un ajuste del programa: si esa persona
 * entra desde otro equipo o desde otro navegador, le sale la disposición de
 * fábrica, y eso está admitido.
 *
 * Nunca se guarda aquí nada de la sesión ni del token.
 */

const PREFIJO = 'conta.preferencias'

function clave(usuario: string, nombre: string): string {
  return `${PREFIJO}.${usuario}.${nombre}`
}

/**
 * Lo guardado, o `null` si no hay nada o no se puede leer. El navegador puede
 * tener el almacenamiento desactivado, y eso no debe romper la pantalla.
 */
export function leerPreferencia<T>(usuario: string, nombre: string): T | null {
  try {
    const crudo = localStorage.getItem(clave(usuario, nombre))
    return crudo === null ? null : (JSON.parse(crudo) as T)
  } catch {
    return null
  }
}

/** Guarda. Si el navegador no deja, se sigue trabajando sin guardar. */
export function guardarPreferencia(usuario: string, nombre: string, valor: unknown): void {
  try {
    localStorage.setItem(clave(usuario, nombre), JSON.stringify(valor))
  } catch {
    // Almacenamiento lleno o desactivado: la pantalla funciona igual, solo que
    // la próxima vez saldrá la disposición de fábrica.
  }
}

/** Borra la preferencia, para volver a la disposición de fábrica. */
export function olvidarPreferencia(usuario: string, nombre: string): void {
  try {
    localStorage.removeItem(clave(usuario, nombre))
  } catch {
    // Igual que arriba: no hay nada que hacer y nada que romper.
  }
}
