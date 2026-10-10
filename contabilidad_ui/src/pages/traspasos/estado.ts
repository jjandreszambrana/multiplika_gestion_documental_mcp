/**
 * El nombre del estado y su explicación, que el servidor manda juntos: «Sin
 * aprobar (no traspasa hasta que se apruebe)». En la celda solo cabe el
 * nombre; el paréntesis se lee al posarse encima.
 */
export function partirEstado(estado: string): { nombre: string; explicacion: string } {
  const abre = estado.indexOf('(')
  if (abre === -1) return { nombre: estado, explicacion: '' }
  return {
    nombre: estado.slice(0, abre).trim(),
    explicacion: estado.slice(abre).replace(/^\(|\)$/g, '').trim(),
  }
}
