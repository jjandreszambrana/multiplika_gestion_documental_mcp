/**
 * Los datos que se tecleó en una ejecución, en una línea para el historial:
 * `fecha_op: 2026-10-31 · valor: 1200.00 · detalle: 3 filas`. Se enseñan tal
 * cual los guardó el servidor; aquí no se interpreta ninguno.
 */
export function resumenDeDatos(parametros: unknown): string {
  return entradas(parametros)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([clave, v]) => `${clave}: ${valorEnTexto(v)}`)
    .join(' · ')
}

/**
 * El servidor guarda los datos ya resueltos, como `[{clave, valor, visible}]`;
 * los ocultos no se teclearon y no se enseñan. Se acepta también un objeto
 * `{clave: valor}`.
 */
function entradas(parametros: unknown): [string, unknown][] {
  if (Array.isArray(parametros)) {
    return parametros.flatMap((p: unknown): [string, unknown][] => {
      if (typeof p !== 'object' || p === null) return []
      const { clave, valor, visible } = p as Record<string, unknown>
      return typeof clave === 'string' && visible !== false ? [[clave, valor]] : []
    })
  }
  if (typeof parametros === 'object' && parametros !== null)
    return Object.entries(parametros as Record<string, unknown>)
  return []
}

function valorEnTexto(v: unknown): string {
  if (Array.isArray(v)) return v.length === 1 ? '1 fila' : `${v.length} filas`
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    const razon = o.razon
    const cuenta = o.cuenta
    if (typeof razon === 'string' && razon !== '') return razon
    if (typeof cuenta === 'string') return cuenta
    return ''
  }
  return String(v)
}
