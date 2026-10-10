---
name: sin-paginacion-en-listados
description: En contabilidad la paginación estorba; los listados se traen enteros y el scroll se queda en las filas.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 08c1ab0b-86f5-4e02-9c73-3b4d74490ed4
  modified: 2026-08-30T08:34:08.010Z
---

Las vistas de contabilidad **no se paginan**. Se traen enteras y se recorren con
el scroll, con la cabecera fija que ya trae `opcionesDeTabla`.

**Por qué:** un listado contable se recorre de arriba abajo buscando una fila
—un apunte, una cuenta, un bien—, y tener que ir pasando páginas rompe justo
eso. El usuario lo dijo el 30/08/2026 sobre el mayor: «la paginación en
contabilidad es un estorbo».

**Cómo se aplica:** `enablePagination: false` y `enableBottomToolbar: false`. Si
la API topa el número de filas por llamada —el mayor está en mil—, se piden en
tandas hasta juntar el `total` que ella misma devuelve, en la capa de
`src/api/`, no en el componente. Ver `mayorEntero` en `src/api/informes.ts`.

No vale «es que pueden ser muchas filas»: si de verdad son demasiadas, se
pregunta antes de paginar.

Relacionado: [[pantallas-por-tarea-no-por-endpoint]],
[[agilidad-precargar-de-fondo]].
