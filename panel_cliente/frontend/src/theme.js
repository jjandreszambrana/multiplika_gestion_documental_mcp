import { createTheme } from '@mantine/core'

// Acento "teal tinta" — más contenido que el teal de serie de Mantine,
// pensado para una herramienta de trabajo diario, no para llamar la
// atención. defaultShade 6/7 da un botón sólido con buen contraste en
// ambos esquemas de color.
const acento = [
  '#eaf5f5', '#d3e9e9', '#a8d3d3', '#7cbcbc', '#56a6a6',
  '#3b8f8f', '#2c7878', '#235f5f', '#1c4a4a', '#163838',
]

export const theme = createTheme({
  primaryColor: 'acento',
  primaryShade: { light: 6, dark: 4 },
  colors: { acento },
  fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', ui-monospace, monospace",
  headings: {
    fontFamily: "'IBM Plex Serif', serif",
    fontWeight: '600',
  },
  defaultRadius: 'md',
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '12px' },
  components: {
    Badge: {
      defaultProps: { radius: 'xl' },
    },
  },
})
