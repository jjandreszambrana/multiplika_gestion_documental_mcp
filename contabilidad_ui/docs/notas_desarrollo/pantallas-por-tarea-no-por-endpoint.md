---
name: pantallas-por-tarea-no-por-endpoint
description: Los formularios se organizan por lo que hace el usuario, no por cómo estén partidos los endpoints de la API.
metadata:
  type: feedback
---

Que la API tenga dos endpoints no significa que la pantalla lleve dos botones.
Lo que manda es la tarea: qué quiere hacer el usuario y con qué datos cuenta. Si
un dato se puede deducir de lo que ya ha escrito, no se le pregunta.

**Por qué:** hubo un «Nueva cuenta» y un «Nueva subcuenta» calcados de los
endpoints, y el propio usuario dijo que ni él los entendía. Y preguntar «cuenta
de la que cuelga» era pedirle algo que el número de cuenta ya dice.

**Cómo aplicarlo:** partir de la tarea, teclear una sola cosa, y que la pantalla
enseñe lo que va deduciendo (por ejemplo, de qué grupo y subgrupo colgará la
cuenta según se escribe). Las acciones van donde está el problema que arreglan
—en su aviso, en su fila— y no todas amontonadas en la cabecera.
