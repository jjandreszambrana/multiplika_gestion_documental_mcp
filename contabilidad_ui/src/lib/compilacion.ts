/**
 * Cuándo se compiló esta versión. Lo pone Vite al construir, desde
 * `vite.config.ts`, y llega como una cadena en formato ISO.
 */
declare const __COMPILADO__: string

/** Dos dígitos siempre. */
function dos(numero: number): string {
  return String(numero).padStart(2, '0')
}

/**
 * La fecha y la hora de compilación, en formato español y sin segundos:
 * `01/09/2026 07:23`.
 *
 * Se compone aquí y no con `formatearFecha`, que es solo de fechas: esta lleva
 * hora, y es la del ordenador de quien mira, igual que la marca de los ficheros
 * que se bajan.
 */
export function compiladoEl(): string {
  const cuando = new Date(__COMPILADO__)
  if (Number.isNaN(cuando.getTime())) return ''
  return (
    `${dos(cuando.getDate())}/${dos(cuando.getMonth() + 1)}/${cuando.getFullYear()}` +
    ` ${dos(cuando.getHours())}:${dos(cuando.getMinutes())}`
  )
}
