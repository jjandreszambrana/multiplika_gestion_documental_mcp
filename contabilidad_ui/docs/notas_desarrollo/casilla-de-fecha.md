---
name: casilla-de-fecha
description: "Toda fecha va con CasillaFecha, nunca con DateInput suelto; calendario en español."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f582c5a6-5321-4c95-89a2-5dc8e0ea7127
  modified: 2026-08-28T04:28:29.821Z
---

Todas las casillas de fecha de la aplicación usan `src/components/CasillaFecha.tsx`.
Nunca un `DateInput` de Mantine directamente, ni "solo por esta vez". El parseo
de lo tecleado vive en `src/lib/fecha.ts` (`parsearFechaEscrita`), con tests, y
los meses y días salen en español por el `DatesProvider` de `src/main.tsx`, que
depende del `import 'dayjs/locale/es'`.

**Why:** el `DateInput` a pelo interpreta lo escrito a la americana y convierte
un 03/09/2026 en 9 de marzo sin avisar; el usuario lo detectó en producción el
28/08/2026 ("la cambia por la que le da la gana"). Arreglarlo campo por campo
garantizaba que el siguiente campo nuevo volviera a fallar, así que se
centralizó a petición suya.

**How to apply:** al montar cualquier pantalla con fechas (informes,
inmovilizado, fiscal, cierre), importar `CasillaFecha` y pasarle las
propiedades del `DateInput` que hagan falta. Si aparece un `DateInput` suelto en
una revisión, es un fallo. Queda escrito en la regla 5g de CLAUDE.md. Ver
[[textos-de-formulario-se-aprueban]] para las etiquetas de esos campos.
