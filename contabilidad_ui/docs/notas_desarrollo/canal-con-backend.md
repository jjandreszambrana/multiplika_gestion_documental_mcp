---
name: canal-con-backend
description: El backend y el frontend se comunican por un único fichero N_intercambio.md en multiplika_compartida/contabilidad/prompts/.
metadata: 
  node_type: memory
  type: project
  originSessionId: f582c5a6-5321-4c95-89a2-5dc8e0ea7127
  modified: 2026-08-28T07:17:20.960Z
---

Hay una IA aparte que lleva el backend de contabilidad (Multiplika SIF, FastAPI
+ MariaDB). Nos comunicamos por ficheros en una carpeta compartida, no por el
usuario haciendo de intermediario. Acordado el 27/08/2026.

    /home/jjandres/desarrollos/python3/multiplika_compartida/contabilidad/
        README.md
        contexto/api_para_frontend.md   lo mantiene el backend; aquí solo se lee
        prompts/README.md               la convención, mandan sus reglas
        prompts/N_intercambio.md        el intercambio vivo
        prompts/historico/              rondas cerradas

**Por qué:** antes lo que hacía falta del backend se anotaba y se quedaba
parado; ahora se pide directamente y queda por escrito quién debe qué.

**Cómo aplicarlo:**

- **Un solo fichero por ronda**, con los dos sentidos dentro y en orden
  cronológico. El usuario lo cambió el 28/08/2026: antes eran cuatro ficheros
  (`de_frontend`, `para_frontend`, `de_backend`, `para_backend`) y había que
  saltar de uno a otro para seguir una conversación. La ronda 1 se quedó en
  `historico/` con los cuatro ficheros de entonces, sin convertir.
- El número identifica la ronda, no el mensaje.
- Cada apartado dice **quién habla** y **qué es**, con tres tipos: `Peticion`,
  `Respuesta` y `Aviso` (informativo, no espera contestación).
  `## [2.1] Peticion · frontend — Titulo corto`, con `- estado:` y `- fecha:`.
  Quien responde repite el número, pone `- responde a:` y marca la petición
  original como `estado: respondido`.
- **La numeración es una sola cuenta compartida por los dos.** Releer el final
  antes de escribir para coger un número libre; si dos coinciden, el segundo
  pasa a `[2.7 bis]`. Nunca se renumera lo ya escrito.
- **Siempre añadiendo al final, nunca reescribiendo el fichero entero**, que es
  lo que duplicó un fichero de arriba abajo el 28/08/2026. Con `cat >>`, no con
  una escritura completa.
- **Al empezar cualquier sesión, mirar el fichero vivo** buscando apartados
  `pendiente` dirigidos a mí. Olvidarlo el 28/08/2026 costó pedir algo que ya
  estaba contestado y desplegado.
- Cuando el usuario dice «cierra el N», ese fichero se mueve a `historico/` sin
  renombrar y se empieza con el siguiente. El contexto **no se mueve nunca**.
- Nada de inventar rutas ni campos: lo que no esté en
  `contexto/api_para_frontend.md` se pregunta por este canal. Ver
  [[fuente-de-verdad-api]] y [[pendientes-en-fichero]].
