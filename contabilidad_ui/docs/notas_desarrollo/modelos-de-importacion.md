---
name: modelos-de-importacion
description: La importación se hace con modelos definidos aparte; emparejar columnas dentro de cada importación se rechazó.
metadata:
  type: feedback
---

El importador son **dos pantallas**: una donde se definen los modelos y otra
donde se elige el modelo, se elige el archivo y adelante. Emparejar las columnas
dentro de cada importación **no vale**, y el usuario lo dijo con claridad el
27/08/2026, después de que se montara así.

**Por qué:** ata cada importación a un archivo concreto. Los archivos que llegan
del programa antiguo son siempre iguales, así que el trabajo de explicar sus
columnas se hace una vez y se reutiliza; repetirlo cada mes es tiempo perdido.

**Cómo aplicarlo:** el emparejamiento admite el **número de columna** además del
título, y eso es lo que hace que un modelo valga para cualquier archivo con ese
mismo orden aunque no traiga fila de títulos. La lección general, que vale para
otras pantallas: cuando algo se repite igual cada vez, se define una vez y se
elige, no se vuelve a teclear. Ver [[pantallas-por-tarea-no-por-endpoint]] y
[[importador-existe]].
