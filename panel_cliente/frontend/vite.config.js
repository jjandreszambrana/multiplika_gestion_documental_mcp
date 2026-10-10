import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// Pantallas de contabilidad (copia trabajada solo para la GD, en TS). Se
// importan como `@contabilidad/...` y las compila Vite junto al panel.
const CONTABILIDAD = fileURLToPath(new URL('../../contabilidad_ui/src', import.meta.url))

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version

function revisionGit() {
  // En decimal (número de commits), no el hash corto — más fácil de
  // comparar de un vistazo entre servidores ("¿cuál es más reciente?").
  try {
    return execSync('git rev-list --count HEAD', { cwd: import.meta.dirname }).toString().trim()
  } catch {
    return "0"
  }
}

// En desarrollo se sirve en la raíz de Vite; en producción vive bajo
// /gd detrás del mismo dominio (ver docs/despliegue.md del repo core),
// así que sus propios assets también llevan ese prefijo.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: { '@contabilidad': CONTABILIDAD },
    // El código de contabilidad_ui vive fuera de este proyecto y tiene su
    // propio node_modules: sin esto se cargarían dos React y dos Mantine, y
    // sus pantallas no verían el MantineProvider del panel.
    dedupe: [
      'react',
      'react-dom',
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/dates',
      '@tabler/icons-react',
      'clsx',
      'dayjs',
      'decimal.js',
      'mantine-react-table',
      'react-markdown',
    ],
  },
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), CONTABILIDAD] },
  },
  // Pie de la barra lateral (ver Sidebar.jsx) — para saber, mirando el
  // panel, exactamente qué build está desplegado en cada servidor sin
  // tener que entrar por SSH a comprobar el commit.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_REVISION__: JSON.stringify(revisionGit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
