/**
 * Lo que usa `medirFila` del virtualizador de la rejilla: el índice de una fila y
 * lo ya medido de cada una. Escrito aquí y no importado: esa librería viene
 * dentro de mantine-react-table y no se instala aparte.
 */
interface Medidas<E extends Element> {
  indexFromElement: (elemento: E) => number
  measurementsCache: { size: number }[]
}

/** Alto por defecto de una fila en densidad `xs`, el mismo que estima MRT. */
const ALTO_ESTIMADO = 42.7

/**
 * Cómo mide sus filas una rejilla que solo pinta las que están a la vista
 * (`enableRowVirtualization`). **Un alto de 0 no se cree**: se devuelve el que
 * ya tenía la fila.
 *
 * Una fila mide 0 cuando la rejilla está oculta con `display: none`, sea por un
 * apartado del menú o desde fuera (la GD oculta la contabilidad entera con
 * `hidden`, y la pestaña «Contabilidad» con las de Mantine). Si en ese mismo
 * repintado se vuelven a medir las filas, todas dan 0, las de más abajo suben a
 * ocupar su sitio, se pintan, miden 0 otra vez… y React corta con el #185
 * («Maximum update depth exceeded»). Sin aceptar el 0, oculta no cambia nada y
 * al volver a verse mide de verdad.
 */
export function medirFila<E extends Element>(
  elemento: E,
  _entrada: unknown,
  rejilla: Medidas<E>,
): number {
  const alto = elemento.getBoundingClientRect().height
  if (alto > 0) return alto
  return rejilla.measurementsCache[rejilla.indexFromElement(elemento)]?.size ?? ALTO_ESTIMADO
}
