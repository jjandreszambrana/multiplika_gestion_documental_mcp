import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/code-highlight/styles.css'
// Tema fijo (oscuro) para los bloques de código, independiente del tema
// claro/oscuro del panel — igual que la mayoría de sitios de
// documentación, más simple que sincronizar dos hojas de estilo con el
// selector de tema de Mantine.
import 'highlight.js/styles/github-dark.css'
import hljs from 'highlight.js'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { CodeHighlightAdapterProvider, createHighlightJsAdapter } from '@mantine/code-highlight'
import './index.css'
import { theme } from './theme.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      <CodeHighlightAdapterProvider adapter={createHighlightJsAdapter(hljs)}>
        <Notifications />
        <App />
      </CodeHighlightAdapterProvider>
    </MantineProvider>
  </StrictMode>,
)
