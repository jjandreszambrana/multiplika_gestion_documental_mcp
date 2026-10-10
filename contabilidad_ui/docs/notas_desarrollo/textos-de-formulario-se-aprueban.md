---
name: textos-de-formulario-se-aprueban
description: Los textos de formularios y diálogos se proponen y se aprueban antes de escribir el código, con una explicación llana de cada control.
metadata:
  type: feedback
---

Ningún texto que el usuario vaya a leer dentro de un formulario o un diálogo se
escribe en el código sin proponerlo antes: etiquetas, textos de ayuda, avisos,
botones, títulos y confirmaciones. Se presentan tal como saldrán en pantalla y,
al lado de cada uno, una frase sin tecnicismos que diga qué hace ese control y
por qué está. Un control que no se sabe explicar en una frase clara, sobra.

**Por qué:** el 26/08/2026 el usuario paró el desarrollo diciendo que no
entendía los textos que le estaba poniendo y que algunos controles no tenían
sentido, y que así iba a acabar malgastando el tiempo en correcciones. Lo llamó
regla fundamental del desarrollo.

**Cómo aplicarlo:** proponer la lista antes de escribir el componente, no
después, y esperar. Está también en la regla 5f de CLAUDE.md. Lo ya aprobado se
copia tal cual al mover o partir componentes: ver [[textos-decididos-no-se-tocan]]
y [[textos-en-lenguaje-llano]].
