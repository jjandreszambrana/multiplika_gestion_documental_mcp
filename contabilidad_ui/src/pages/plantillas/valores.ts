import type { Parametro, ValoresPlantilla } from '../../api/plantillas'

/** Una celda o un dato suelto, tal y como está en la casilla. */
export type ValorSimple = string | boolean
export type FilaTabla = Record<string, ValorSimple>
export type ValorDato = ValorSimple | FilaTabla[]

const NUMERICOS = new Set(['numero', 'importe', 'porcentaje'])

/** Lo de una casilla, listo para la API: los números con punto decimal. */
function simpleParaEnviar(p: Parametro, valor: ValorSimple | undefined): unknown {
  if (p.tipo === 'booleano') return valor === true
  const texto = typeof valor === 'string' ? valor.trim() : ''
  return NUMERICOS.has(p.tipo) ? texto.replace(',', '.') : texto
}

/**
 * Lo que se manda a calcular. De los datos sueltos, solo los que ha tocado el
 * contable: los demás los rellena el servidor con su valor por defecto, que
 * puede depender de otro dato y cambiar mientras se escribe. Las tablas van
 * siempre, porque sus filas solo existen aquí.
 */
export function valoresParaEnviar(
  parametros: Parametro[],
  valores: Record<string, ValorDato>,
  tocados: ReadonlySet<string>,
): ValoresPlantilla {
  const salida: ValoresPlantilla = {}
  for (const p of parametros) {
    const valor = valores[p.clave]
    if (p.tipo === 'tabla') {
      const filas = Array.isArray(valor) ? valor : []
      salida[p.clave] = filas.map((fila) =>
        Object.fromEntries((p.columnas ?? []).map((c) => [c.clave, simpleParaEnviar(c, fila[c.clave])])),
      )
    } else if (tocados.has(p.clave) && !Array.isArray(valor)) {
      salida[p.clave] = simpleParaEnviar(p, valor)
    }
  }
  return salida
}

/**
 * El valor que ha resuelto el servidor, para enseñarlo en la casilla de un dato
 * que no se ha tocado. Los números con coma, que es como los teclea el contable.
 */
export function textoDeResuelto(p: Parametro, valor: unknown): ValorSimple {
  if (p.tipo === 'booleano') return valor === true
  if (valor === null || valor === undefined) return ''
  if (p.tipo === 'tercero' && typeof valor === 'object') {
    const cuenta = (valor as Record<string, unknown>).cuenta
    return typeof cuenta === 'string' ? cuenta : ''
  }
  if (typeof valor === 'object') return ''
  const texto = String(valor)
  return NUMERICOS.has(p.tipo) ? texto.replace('.', ',') : texto
}

/** Una fila vacía de una tabla: las casillas de sí o no, sin marcar. */
export function filaVacia(p: Parametro): FilaTabla {
  return Object.fromEntries(
    (p.columnas ?? []).map((c) => [c.clave, c.tipo === 'booleano' ? false : '']),
  )
}

/** Cómo arranca el formulario: las tablas con las filas mínimas, vacías. */
export function valoresIniciales(parametros: Parametro[]): Record<string, ValorDato> {
  const valores: Record<string, ValorDato> = {}
  for (const p of parametros) {
    if (p.tipo === 'tabla') {
      valores[p.clave] = Array.from({ length: p.filas_minimas ?? 0 }, () => filaVacia(p))
    }
  }
  return valores
}
