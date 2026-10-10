import type { Descarga } from '../api/cliente'

/** Dos dígitos siempre: `9` es `09`. */
function dos(numero: number): string {
  return String(numero).padStart(2, '0')
}

/**
 * La marca que lleva en el nombre todo fichero que se baja: `ddmmaaaahhmmss`,
 * en la hora del ordenador del usuario.
 *
 * Sin ella, bajar dos veces el mismo informe deja dos ficheros con el mismo
 * nombre y el segundo pisa al primero, o el navegador le pega un `(1)` que no
 * dice nada. Con la marca, cada descarga se queda y se sabe cuál es cuál.
 */
export function marcaDeTiempo(cuando: Date = new Date()): string {
  return (
    dos(cuando.getDate()) +
    dos(cuando.getMonth() + 1) +
    String(cuando.getFullYear()) +
    dos(cuando.getHours()) +
    dos(cuando.getMinutes()) +
    dos(cuando.getSeconds())
  )
}

/**
 * El nombre de un fichero que se baja: la parte que dice qué es, la marca de
 * tiempo y la extensión.
 *
 * `nombreDeFichero('pyg', 'xlsx')` → `pyg_01092025062401.xlsx`
 *
 * **Todo lo que se baje pasa por aquí.** No se compone ningún nombre suelto en
 * una pantalla.
 */
export function nombreDeFichero(base: string, extension: string, cuando?: Date): string {
  return `${base}_${marcaDeTiempo(cuando)}.${extension}`
}

/**
 * Deja un fichero en el disco del usuario. El navegador no tiene otra forma:
 * se crea un enlace, se pulsa y se tira.
 *
 * **El nombre lo pone siempre la aplicación**, no el servidor. Antes mandaba el
 * de la cabecera del servidor, pero ese no lleva la marca de tiempo y dos
 * descargas seguidas se pisaban.
 *
 * La dirección temporal se suelta después, o el fichero se queda en memoria
 * hasta que se recargue la página.
 */
export function guardarFichero({ contenido }: Descarga, nombre: string): void {
  const direccion = URL.createObjectURL(contenido)
  const enlace = document.createElement('a')
  enlace.href = direccion
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(direccion)
}
