import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo se sirve en la raíz de Vite; en producción vive bajo
// /gd detrás del mismo dominio (ver docs/despliegue.md del repo core),
// así que sus propios assets también llevan ese prefijo.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
