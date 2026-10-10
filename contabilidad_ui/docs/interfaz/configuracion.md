# Configuración

En `Utilidades → Configuración`. Nivel `cierre`. Título `Configuración`.

Es lo que devuelve `/configuracion/obtener`, que se pide **una vez** al entrar y
al conmutar de empresa. Al guardar, `/configuracion/fijar_cuentas` **ya devuelve
la versión actualizada**, así que no hay que volver a pedirla.

## Qué se configura

- **Las cuentas por defecto**, quince. El rótulo de cada una lo da el backend,
  junto a la columna que declara: aquí no hay diccionario que mantener, y una
  cuenta nueva sale bien escrita sin tocar nada. Las obligatorias se marcan en
  pantalla antes de que el usuario lo descubra al guardar.
- `Diario por defecto` — «El libro donde se anotan los asientos si no se elige
  otro.»
- `Numeración de las cuentas de clientes` y
  `Numeración de las cuentas de proveedores`.

Al guardar: `Configuración guardada.`

## Lo que no se puede cambiar desde aquí

**El ancho de cuenta (`anchocuentas`) y el plan (`tipo_pgc`) no se cambian por
API.** El ancho necesitaría una migración, y el plan se cambia abriendo el
ejercicio siguiente con otro. No se ofrece como si se pudiera.

**Los diarios se listan pero no se crean ni se borran**: se crea el `GEN` al
activar la contabilidad y no hay más CRUD.

## Los avisos

`cuentas_sin_poner` y `avisos` salen de aquí, y se enseñan en la campana de la
cabecera, no en una franja fija. Ver `arranque.md`.
