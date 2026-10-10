import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
// Nombres de meses y días en español en todos los calendarios. Sin esto salen
// en inglés, que es el idioma que trae dayjs de serie.
import 'dayjs/locale/es'
import 'mantine-react-table/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el elemento #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
        <App />
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
)
