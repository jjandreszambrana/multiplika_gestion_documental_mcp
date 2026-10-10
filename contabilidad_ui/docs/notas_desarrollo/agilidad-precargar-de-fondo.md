---
name: agilidad-precargar-de-fondo
description: La agilidad es premisa del proyecto: los datos que se usan al teclear se precargan de fondo, no se piden por pulsación.
metadata:
  type: feedback
---

Nada de esperar a una llamada mientras el usuario teclea. Lo que haga falta para
autocompletar o para orientar (el plan contable entero, listas de apoyo) se trae
de fondo al entrar en la empresa y vive en memoria; el usuario nunca ve un
cargando en un campo.

**Por qué:** el usuario lo pidió expresamente: «la agilidad es una premisa
importante con la que tenemos que trabajar». Un plan real son pocos cientos de
cuentas y ocupa nada.

**Cómo aplicarlo:** precarga al entrar, refresco cuando algo la invalida
(escrituras, cambio de ejercicio o de empresa), y nunca un temporizador
repitiendo consultas. Si hace falta saber si algo cambió sin recargarlo todo, se
pide una huella al backend en vez de sondear; está anotado en
`docs/planificacion/pendientes.md`.
