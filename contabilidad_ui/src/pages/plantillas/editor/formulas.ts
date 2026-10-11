import type { FuncionDelCatalogo } from '../../../api/plantillas'

/** Lo que se está escribiendo al final de una fórmula: un nombre o un número. */
export function palabraFinal(texto: string): string {
  return /[\p{L}_][\p{L}\p{N}_]*$|\d+$/u.exec(texto)?.[0] ?? ''
}

/**
 * La función cuyo paréntesis sigue abierto al final, para enseñar su firma
 * mientras se escriben sus argumentos. `redondear(valor * ` → `redondear`.
 */
export function funcionAbierta(texto: string, funciones: FuncionDelCatalogo[]): FuncionDelCatalogo | null {
  const abiertas: string[] = []
  const nombre = /[\p{L}_][\p{L}\p{N}_]*$/u
  for (let i = 0; i < texto.length; i += 1) {
    if (texto[i] === '(') abiertas.push(nombre.exec(texto.slice(0, i))?.[0] ?? '')
    else if (texto[i] === ')') abiertas.pop()
  }
  for (let i = abiertas.length - 1; i >= 0; i -= 1) {
    const f = funciones.find((x) => x.nombre === abiertas[i])
    if (f) return f
  }
  return null
}
