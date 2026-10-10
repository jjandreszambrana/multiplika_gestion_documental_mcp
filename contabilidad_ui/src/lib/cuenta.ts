/**
 * El punto en un código de cuenta es un comodín: se rellena con ceros hasta
 * completar el ancho de cuenta de la empresa. Escribiendo `431.10` con ancho 9
 * sale `431000010`. Es la forma en que un contable teclea, y vale en cualquier
 * sitio donde se escriba una cuenta: buscador, alta y entrada de asientos.
 *
 * El ancho no se fija aquí: sale de `/plan/preferencias` (`anchocuentas`),
 * porque cada empresa puede tener el suyo.
 */

const COMODIN = '.'

/**
 * Devuelve el código con el comodín resuelto. Si no hay punto, o el resultado
 * no cabe en el ancho, se devuelve lo tecleado tal cual: no es tarea de esto
 * decidir si una cuenta es válida, eso lo dice la API.
 */
export function expandirCuenta(texto: string, ancho: number): string {
  const limpio = texto.trim()
  const punto = limpio.indexOf(COMODIN)
  if (punto === -1) return limpio

  const izquierda = limpio.slice(0, punto)
  const derecha = limpio.slice(punto + 1)
  if (derecha.includes(COMODIN)) return limpio

  const ceros = ancho - izquierda.length - derecha.length
  if (ceros < 0) return limpio

  return `${izquierda}${'0'.repeat(ceros)}${derecha}`
}

/**
 * Quita de lo tecleado todo lo que no puede formar parte de un código: una
 * cuenta son dígitos, y el punto porque es el comodín. Se aplica mientras se
 * escribe, así que la letra no llega ni a verse.
 *
 * No decide si la cuenta existe ni si cabe en el ancho: eso lo dice la API.
 */
export function soloCodigoDeCuenta(texto: string): string {
  return texto.replace(/[^0-9.]/g, '')
}

/**
 * Cómo llama el contable a una cuenta según sus dígitos. Las que admiten
 * apuntes son subcuentas, y las demás se nombran por el nivel: un dígito es un
 * grupo, dos un subgrupo, y de tres en adelante una cuenta de mayor.
 *
 * Es nomenclatura de pantalla, no una regla contable: quien decide qué admite
 * apuntes es el plan de la empresa, y viene en `auxiliar`.
 */
export function nombreDeTipo(nivel: number, auxiliar: boolean): string {
  if (auxiliar) return 'Subcuenta'
  if (nivel <= 1) return 'Grupo'
  if (nivel === 2) return 'Subgrupo'
  return 'Cuenta de mayor'
}

/** Las opciones del buscador se enseñan como «430000001 · Título». */
export const SEPARADOR_DE_OPCION = ' · '

/**
 * El código que tiene que quedar en la casilla del buscador de cuentas.
 *
 * Al aceptar una opción, Mantine avisa además por `onChange` con la etiqueta
 * entera, así que el título se colaba en la casilla. Se corta **solo cuando
 * viene el separador**, que es lo que distingue una opción elegida de lo que se
 * está tecleando: si se recortara siempre —o se quitaran las letras—, no se
 * podría buscar una cuenta por su título, que es la mitad de para lo que sirve
 * el buscador.
 */
export function codigoDeOpcion(texto: string): string {
  const corte = texto.indexOf(SEPARADOR_DE_OPCION)
  return corte === -1 ? texto : texto.slice(0, corte)
}
