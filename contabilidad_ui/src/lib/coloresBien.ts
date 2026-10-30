/**
 * Los diez colores con los que se destaca un bien de inmovilizado. Son fijos:
 * la API guarda solo el número (1 a 10; 0 es «sin color») y aquí se decide qué
 * tono es cada uno. Los nombres son los de la paleta de Mantine.
 */
export const COLORES_DE_BIEN = [
  { numero: 1, nombre: 'Rojo', mantine: 'red' },
  { numero: 2, nombre: 'Naranja', mantine: 'orange' },
  { numero: 3, nombre: 'Amarillo', mantine: 'yellow' },
  { numero: 4, nombre: 'Lima', mantine: 'lime' },
  { numero: 5, nombre: 'Verde', mantine: 'green' },
  { numero: 6, nombre: 'Turquesa', mantine: 'teal' },
  { numero: 7, nombre: 'Azul', mantine: 'blue' },
  { numero: 8, nombre: 'Violeta', mantine: 'violet' },
  { numero: 9, nombre: 'Rosa', mantine: 'pink' },
  { numero: 10, nombre: 'Gris', mantine: 'gray' },
] as const

/** El color del texto para un número, o nulo si no tiene (0 o desconocido). */
export function colorDelTexto(numero: number | null | undefined): string | undefined {
  const color = COLORES_DE_BIEN.find((c) => c.numero === numero)
  return color ? `var(--mantine-color-${color.mantine}-8)` : undefined
}
