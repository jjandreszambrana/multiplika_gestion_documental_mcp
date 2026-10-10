/**
 * Textos de pantalla decididos para un maestro concreto. La lista de maestros
 * la sigue mandando el servidor —si aparece uno nuevo, sale con su texto—;
 * esto solo sustituye la explicación y la etiqueta del botón allí donde se ha
 * acordado una redacción propia.
 */
interface TextoDeMaestro {
  queEs?: string
  /** Etiqueta del botón que abre las cuentas de una ficha. */
  accion?: string
}

const TEXTOS: Record<string, TextoDeMaestro> = {
  tipos_iva: {
    queEs:
      'Las cuentas contables heredadas, asignadas a cada tipo, se pueden personalizar para su plan.',
    accion: 'Personalizar…',
  },
}

export function queEsDe(idMaestro: string, delServidor: string): string {
  return TEXTOS[idMaestro]?.queEs ?? delServidor
}

export function accionDe(idMaestro: string): string {
  return TEXTOS[idMaestro]?.accion ?? 'Asignar…'
}
