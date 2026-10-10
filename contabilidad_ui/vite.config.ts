import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const API = 'https://facturae.multiplika.net'

/**
 * Cuándo se compiló esto, congelado al arrancar el build y escrito en el
 * paquete. Se enseña al pie de la aplicación: es la única forma de saber, ante
 * un servidor, si lo que se está mirando es la versión que se subió.
 *
 * En `npm run dev` es el momento en que se arrancó el servidor de desarrollo.
 */
const COMPILADO = new Date().toISOString()

/**
 * La cookie de sesión es SameSite=strict, así que el navegador tiene que ver
 * el mismo origen para la API y para la aplicación. En desarrollo eso se
 * consigue con este proxy; sin él, ninguna petición autenticada funciona.
 *
 * Además hay que retocar la cookie que devuelve la API: como hacia ella la
 * conexión es HTTPS, la marca `Secure` y le pone su dominio, y el navegador
 * la descarta al estar la aplicación en `http://localhost`. Se le quitan las
 * dos cosas. Esto es solo del servidor de desarrollo: en producción, servido
 * desde el mismo dominio y por HTTPS, la cookie llega intacta.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    __COMPILADO__: JSON.stringify(COMPILADO),
  },
  server: {
    proxy: {
      '/apisif': {
        target: API,
        changeOrigin: true,
        secure: true,
        configure(proxy) {
          proxy.on('proxyRes', (respuesta) => {
            const galletas = respuesta.headers['set-cookie']
            if (!galletas) return
            respuesta.headers['set-cookie'] = galletas.map((c) =>
              c.replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]*/gi, ''),
            )
          })
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
