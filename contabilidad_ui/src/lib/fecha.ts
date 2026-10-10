/**
 * Las fechas del calendario de Mantine y las de la API, que van en `aaaa-mm-dd`.
 * Se convierten con la fecha local, no en UTC: en España, `toISOString()` de un
 * 1 de marzo devuelve el 28 de febrero y el asiento se iría de mes.
 */

export function fechaParaApi(fecha: Date | null): string {
  if (fecha === null) return ''
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

export function fechaDeApi(texto: string | null | undefined): Date | null {
  if (!texto) return null
  const [aaaa, mm, dd] = texto.slice(0, 10).split('-').map(Number)
  if (!aaaa || !mm || !dd) return null
  return new Date(aaaa, mm - 1, dd)
}

/**
 * Lo que se teclea en la casilla de fecha. Sin esto, Mantine lo entiende a la
 * americana y un 03/09/2026 se convierte en 9 de marzo.
 *
 * Se acepta `dd/mm/aaaa`, con guiones o puntos en vez de barras, sin ceros a la
 * izquierda (`3/9/26`) y del tirón (`030926`, `03092026`). Un año de dos cifras
 * se toma como 20xx. Mientras la fecha esté a medias o no exista en el
 * calendario se devuelve null, y la casilla deja seguir escribiendo.
 */
export function parsearFechaEscrita(texto: string): Date | null {
  const limpio = texto.trim()
  if (!limpio) return null

  const partes = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2}|\d{4})$/.exec(limpio)
  const seguidas = /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(limpio)
  const trozos = partes ?? seguidas
  if (!trozos) return null

  const dia = Number(trozos[1])
  const mes = Number(trozos[2])
  const anno = trozos[3].length === 2 ? 2000 + Number(trozos[3]) : Number(trozos[3])

  const fecha = new Date(anno, mes - 1, dia)
  if (
    fecha.getFullYear() !== anno ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null
  }
  return fecha
}
