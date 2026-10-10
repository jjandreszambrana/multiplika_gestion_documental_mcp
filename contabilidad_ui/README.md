# Contabilidad — Multiplika SIF (interfaz)

Cliente web del módulo de contabilidad. La lógica de negocio vive en la API;
esto es solo la interfaz. Las reglas del proyecto están en [CLAUDE.md](CLAUDE.md)
y la guía de la API en [docs/contexto/api_para_frontend.md](docs/contexto/api_para_frontend.md).

## Puesta en marcha

```
npm install
npm run dev        # http://localhost:5173
```

El proxy de desarrollo redirige `/apisif` a `https://facturae.multiplika.net`.
Es obligatorio: la cookie de sesión es `SameSite=strict` y el navegador tiene
que ver el mismo origen para la aplicación y la API.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con el proxy |
| `npm run build` | Comprueba tipos y compila a `dist/` |
| `npm test` | Tests de formato e importes (Vitest) |
| `npm run api:types` | Regenera `src/api/types.ts` desde el OpenAPI |
| `npm run lint` | oxlint |
| `scripts/desplegar.sh` | Compila y sube al servidor de desarrollo |

El despliegue va a `https://contabilidad-dev.multiplika.net`. Los detalles y lo
que queda pendiente ahí están en `CLAUDE.md`, apartado **Despliegue**.

## Qué hay

```
src/api/     cliente HTTP, errores, empresa activa y tipos generados
src/lib/     formato español y utilidades de Decimal, con tests
src/         App.tsx es todavía una pantalla puente
```

Ninguna pantalla real está construida aún.
