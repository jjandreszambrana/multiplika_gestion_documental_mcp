---
name: pendientes-en-fichero
description: Lo que depende del backend o de una decisión sin tomar se anota en docs/planificacion/pendientes.md, no se resuelve por cuenta propia.
metadata:
  type: project
---

Cuando algo no se puede hacer desde el frontend —falta un endpoint, falta un
campo en la respuesta, o hay una decisión de negocio sin tomar— se escribe en
`docs/planificacion/pendientes.md` y se avisa. No se inventa un apaño.

**Por qué:** el usuario lo pidió al detectar que varias cosas quedaban dichas de
palabra y se perdían. El fichero se creó el 25/08/2026.

**Cómo aplicarlo:** una entrada por asunto, diciendo qué falta y qué se
desbloquea con ello. Al resolverse se borra, y si condiciona código se anota en
`docs/planificacion/decisiones.md`.
