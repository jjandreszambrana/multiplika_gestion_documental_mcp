---
name: vocabulario-del-contable
description: En pantalla se usan los términos del oficio contable, no los nombres de campo de la API.
metadata:
  type: feedback
---

Las etiquetas y los mensajes usan el nombre que el contable le da a cada cosa,
aunque la API lo llame de otra forma. Un dígito es un **grupo**, dos un
**subgrupo**, tres o cuatro una **cuenta de mayor**, y la que admite apuntes es
una **subcuenta**. El `auxiliar: 1` de la API no sale nunca a pantalla.

**Por qué:** «admite apuntes» o «auxiliar» no son términos contables; el usuario
los rechazó por ese motivo.

**Cómo aplicarlo:** cuando un campo de la API tenga nombre técnico, traducirlo
en la capa de presentación. En este proyecto vive en `nombreDeTipo`, en
`src/lib/cuenta.ts`. Antes de nombrar algo nuevo, preguntar cómo lo llaman
ellos. Ver [[textos-en-lenguaje-llano]].
