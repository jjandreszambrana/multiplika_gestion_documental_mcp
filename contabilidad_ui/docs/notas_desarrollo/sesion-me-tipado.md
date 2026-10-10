---
name: sesion-me-tipado
description: Hay un /contabilidad/sesion/me tipado que sustituye a GET /usuarios/me para el arranque; escrito el 27/08/2026 y pendiente de desplegar.
metadata:
  type: reference
---

El backend creó `POST /apisif/v1/contabilidad/sesion/me` (cuerpo `{}`, sin
exigir nivel). Devuelve lo mismo que `GET /usuarios/me`, envuelto igual en
`{"user": {…}}`, pero con la respuesta declarada campo a campo, así que **sale
en el OpenAPI y el tipo se genera solo**. Trae también `conta_id_obligado`.

Dos diferencias: **no devuelve `api_key`** (es una credencial y la pantalla no la
usa) y casi todos los campos son opcionales de verdad, porque dependen del rol.
`id_rol` viene siempre.

**Por qué:** `/usuarios/me` se queda como está a propósito. En cuanto se le
declara la respuesta, FastAPI deja de enviar en silencio cualquier campo no
declarado, y ese endpoint lo llama toda la aplicación al arrancar, no solo
contabilidad. Los datos de los dos salen de la misma función, no de una copia.

**Ya hecho** el 27/08/2026: `Usuario` es `ModeloUsuarioSesion` generado y el
arranque llama aquí. Consecuencia: **ya no queda ninguna llamada GET en el
frontend**, se quitó `pedirGet` de `src/api/cliente.ts`. Al leer un campo hay que
contar con que puede venir nulo; solo `id_rol` viene siempre.
